from __future__ import annotations


import json
import logging
import os
import requests
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.models import EmailEvent
from backend.server import get_current_user
from backend.services.gmail_reader import read_gmail_events

logger = logging.getLogger("emailsystem.assistant")

router = APIRouter(prefix="/assistant", tags=["Assistant"])


# ═══════════════════════════════════════
# MODELS  (contract unchanged)
# ═══════════════════════════════════════

class AssistantMessage(BaseModel):
    text: str


class AssistantAction(BaseModel):
    type: str
    payload: Dict[str, Any]


class AssistantResponse(BaseModel):
    assistant_text: str
    actions: Optional[List[AssistantAction]] = None
    status: str = "ok"
    timestamp: str


# ═══════════════════════════════════════
# EMAIL CONTEXT BUILDER
# ═══════════════════════════════════════

def _build_email_context(events: List[EmailEvent]) -> Dict[str, Any]:
    """Compute counts & a compact text digest for the LLM prompt."""

    total = len(events)
    prioritarios = [e for e in events if "IMPORTANT" in (e.labels or [])]
    seguimiento  = [e for e in events if "STARRED" in (e.labels or [])]
    adjuntos     = [e for e in events if e.has_attachments]

    counts = {
        "total": total,
        "prioritarios": len(prioritarios),
        "seguimiento": len(seguimiento),
        "adjuntos": len(adjuntos),
    }

    # Build a compact digest for the LLM (subject + sender + labels, ~first 20)
    lines: List[str] = []
    for e in events[:20]:
        labels_str = ", ".join(e.labels[:4]) if e.labels else "—"
        snippet = (e.snippet or "")[:100]
        lines.append(
            f"• De: {e.from_name}  |  Asunto: {e.subject}  |  "
            f"Etiquetas: {labels_str}  |  Extracto: {snippet}"
        )

    digest = "\n".join(lines) if lines else "(sin correos disponibles)"

    return {"counts": counts, "digest": digest}


# ═══════════════════════════════════════
# OPENAI LLM LAYER
# ═══════════════════════════════════════

_SYSTEM_PROMPT = """\
Eres el asistente ejecutivo del sistema Email Control.
Tu rol es ayudar al usuario a gestionar su bandeja de correo de forma eficiente.

REGLAS:
1. Responde en español neutro profesional, conciso y orientado a decisiones.
2. Nunca inventes correos que no estén en el CONTEXTO proporcionado.
3. Si no hay correos, indícalo con naturalidad.
4. Cuando detectes que el usuario quiere ver correos filtrados, incluye UNA acción
   en el JSON de tu respuesta.

ACCIONES DISPONIBLES (devuélvelas SOLO cuando el usuario lo pida o tenga sentido):
- {"type":"navigate","payload":{"path":"/app/messages","filter":"priority"}}
  → Mostrar correos prioritarios
- {"type":"navigate","payload":{"path":"/app/messages","filter":"attachments"}}
  → Mostrar correos con adjuntos
- {"type":"navigate","payload":{"path":"/app/messages","filter":"followup"}}
  → Mostrar correos de seguimiento
- {"type":"navigate","payload":{"path":"/app/messages","filter":"all"}}
  → Mostrar todos los correos

FORMATO DE RESPUESTA (SIEMPRE JSON ESTRICTO, sin markdown):
{
  "assistant_text": "<tu respuesta al usuario>",
  "actions": []
}
Si no hay acciones, devuelve "actions": [].
"""


def _build_user_prompt(user_text: str, ctx: Dict[str, Any]) -> str:
    counts = ctx["counts"]
    return (
        f"CONTEXTO DE BANDEJA:\n"
        f"Total correos: {counts['total']}  |  "
        f"Prioritarios: {counts['prioritarios']}  |  "
        f"Seguimiento: {counts['seguimiento']}  |  "
        f"Con adjuntos: {counts['adjuntos']}\n\n"
        f"CORREOS RECIENTES:\n{ctx['digest']}\n\n"
        f"MENSAJE DEL USUARIO:\n{user_text}"
    )


async def _call_openai(user_text: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    try:
        prompt = _build_user_prompt(user_text, ctx)

        response = requests.post(
            "https://api-inference.huggingface.co/models/google/flan-t5-large",
            headers={
                "Authorization": f"Bearer {os.environ.get('HF_API_KEY','')}"
            },
            json={
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 300,
                    "temperature": 0.4
                }
            },
            timeout=15
        )

        result = response.json()

        if isinstance(result, list) and len(result) > 0:
            generated_text = result[0].get("generated_text", "")
        else:
            generated_text = "No pude generar respuesta en este momento."

        return {
            "assistant_text": generated_text,
            "actions": []
        }

    except Exception as e:
        logger.warning("HF call failed: %s", str(e))
        return _fallback_response(user_text, ctx)


# ═══════════════════════════════════════
# FALLBACK  (no API key / error)
# ═══════════════════════════════════════

def _fallback_response(user_text: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic fallback when OpenAI is unavailable."""

    counts = ctx["counts"]
    total = counts["total"]

    # Build human-readable summary
    parts: List[str] = []
    if total == 0:
        parts.append("No tienes correos recientes. Todo está bajo control.")
    else:
        parts.append(f"Tienes {total} correos recientes.")
        if counts["prioritarios"]:
            parts.append(f"{counts['prioritarios']} son prioritarios.")
        if counts["seguimiento"]:
            parts.append(f"{counts['seguimiento']} requieren seguimiento.")
        if counts["adjuntos"]:
            parts.append(f"{counts['adjuntos']} contienen archivos adjuntos.")
        if counts["prioritarios"] == 0:
            parts.append("No hay nada crítico pendiente ahora mismo.")
        else:
            parts.append("Hay correos importantes que requieren tu atención.")

    # Simple keyword-based action detection (same as previous version)
    actions: List[Dict[str, Any]] = []
    text_lower = user_text.lower()

    if ("prioritario" in text_lower or "importante" in text_lower) and counts["prioritarios"] > 0:
        actions.append({"type": "navigate", "payload": {"path": "/app/messages", "filter": "priority"}})
    if ("adjunto" in text_lower or "archivo" in text_lower) and counts["adjuntos"] > 0:
        actions.append({"type": "navigate", "payload": {"path": "/app/messages", "filter": "attachments"}})
    if ("seguimiento" in text_lower or "pendiente" in text_lower) and counts["seguimiento"] > 0:
        actions.append({"type": "navigate", "payload": {"path": "/app/messages", "filter": "followup"}})

    return {
        "assistant_text": " ".join(parts),
        "actions": actions,
    }


# ═══════════════════════════════════════
# ENDPOINT  (contract unchanged)
# ═══════════════════════════════════════

@router.post("", response_model=AssistantResponse)
async def assistant_endpoint(
    payload: AssistantMessage,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        user_id = user["id"]
    except KeyError:
        raise HTTPException(status_code=401, detail="Usuario no válido")

    # 1. Read real emails from Gmail (safe — returns [] if not connected)
    try:
        events = read_gmail_events(user_id=user_id, max_results=25)
    except Exception:
        logger.warning("Gmail read failed for user %s — continuing without emails", user_id)
        events = []

    # 2. Build context
    ctx = _build_email_context(events)

    # 3. LLM response (falls back gracefully)
    result = await _call_openai(payload.text, ctx)

    # 4. Validate & build actions
    validated_actions: Optional[List[AssistantAction]] = None
    if result.get("actions"):
        try:
            validated_actions = [
                AssistantAction(type=a["type"], payload=a["payload"])
                for a in result["actions"]
                if isinstance(a, dict) and "type" in a and "payload" in a
            ]
        except Exception:
            validated_actions = None

    return AssistantResponse(
        assistant_text=result.get("assistant_text", "No pude procesar tu solicitud."),
        actions=validated_actions or None,
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
