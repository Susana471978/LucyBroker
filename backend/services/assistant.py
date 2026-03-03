from __future__ import annotations

from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.server import get_current_user
from backend.api.gmail import fetch_enriched_messages
from backend.core.database import db
from backend.services.executive_memory import set_memory
from backend.services.ai_service import generate_llm_response  # 👈 NUEVO IMPORT


router = APIRouter(prefix="/assistant", tags=["Assistant"])


# =========================
# MODELOS
# =========================

class AssistantMessage(BaseModel):
    text: Optional[str] = None
    message: Optional[str] = None


class AssistantAction(BaseModel):
    type: str
    payload: Dict[str, Any]


class AssistantResponse(BaseModel):
    assistant_text: str
    actions: Optional[List[AssistantAction]] = None
    status: str = "ok"
    timestamp: str


# =========================
# NUEVO MODELO PARA MENSAJE INDIVIDUAL
# =========================

class AssistantMessageAction(BaseModel):
    mode: str
    message_content: str
    audio_enabled: Optional[bool] = False


# =========================
# ENDPOINT ORIGINAL (NO TOCADO)
# =========================

@router.post("", response_model=AssistantResponse)
async def assistant_endpoint(
    payload: AssistantMessage,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        user_text = payload.text or payload.message

        if not user_text:
            raise HTTPException(status_code=400, detail="Mensaje vacío")

        text_lower = user_text.lower()

        items = await fetch_enriched_messages(user, max_results=20)
        total = len(items)

        prioritarios = [
            i for i in items
            if i["priority"]["priority_label"] == "PRIORITARIO"
        ]

        seguimiento = [
            i for i in items
            if i["priority"]["priority_label"] == "SEGUIMIENTO"
        ]

        adjuntos = [
            i for i in items
            if i["email"].get("has_attachments", False)
        ]

        counts = {
            "total": total,
            "prioritarios": len(prioritarios),
            "seguimiento": len(seguimiento),
            "adjuntos": len(adjuntos),
        }

        actions: Optional[List[AssistantAction]] = None

        if any(k in text_lower for k in ["responder", "reply", "contestar", "redactar", "borrador"]):

            assistant_text = "Selecciona el correo al que deseas responder."

            actions = [
                AssistantAction(
                    type="reply_mode",
                    payload={
                        "enabled": True
                    }
                )
            ]

            last_focus = "REPLY"

        elif "prioritario" in text_lower or "importante" in text_lower:
            last_focus = "PRIORITARIO"
            if counts["prioritarios"] > 0:
                assistant_text = f"Tienes {counts['prioritarios']} correos prioritarios."
            else:
                assistant_text = "No tienes correos prioritarios."

        elif "seguimiento" in text_lower or "pendiente" in text_lower:
            last_focus = "SEGUIMIENTO"
            if counts["seguimiento"] > 0:
                assistant_text = f"Tienes {counts['seguimiento']} correos en seguimiento."
            else:
                assistant_text = "No tienes correos en seguimiento."

        elif "adjunto" in text_lower or "archivo" in text_lower:
            last_focus = "ADJUNTOS"
            if counts["adjuntos"] > 0:
                assistant_text = f"Tienes {counts['adjuntos']} correos con adjuntos."
            else:
                assistant_text = "No tienes correos con adjuntos."

        else:
            last_focus = "ALL"
            assistant_text = (
                f"Tienes {total} correos. "
                f"{counts['prioritarios']} prioritarios. "
                f"{counts['seguimiento']} en seguimiento. "
                f"{counts['adjuntos']} con adjuntos."
            )

        try:
            await set_memory(
                db=db,
                user_id=user["id"],
                fields={
                    "last_action": "assistant_query",
                    "last_focus": last_focus,
                    "last_intent": "ASSISTANT_QUERY",
                },
            )
        except Exception as mem_error:
            print("Executive memory save error:", mem_error)

        return AssistantResponse(
            assistant_text=assistant_text,
            actions=actions,
            status="ok",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        print("Assistant error:", e)

        return AssistantResponse(
            assistant_text="No he podido analizar tu bandeja en este momento.",
            actions=None,
            status="error",
            timestamp=datetime.utcnow().isoformat(),
        )


# =========================
# NUEVO ENDPOINT PARA MENSAJE INDIVIDUAL
# =========================

@router.post("/message")
async def assistant_message_endpoint(
    payload: AssistantMessageAction,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:

        if not payload.message_content:
            raise HTTPException(status_code=400, detail="Contenido vacío")

        # =========================
        # RESUMEN NATURAL (3-4 FRASES)
        # =========================

        if payload.mode == "summarize":

            prompt = f"""
Resume el siguiente correo en un máximo de 4 frases.
Debe sonar natural, claro y conversacional, como si me lo estuvieras contando mientras camino escuchándolo.
No uses encabezados ni fórmulas repetitivas.
No hagas análisis ni clasificaciones.
Solo síntesis clara y ejecutiva.

Correo:
{payload.message_content}
"""

            summary = await generate_llm_response(
                prompt=prompt,
                temperature=0.4,
                max_tokens=180,
            )

            return {
                "type": "summary",
                "text": summary.strip(),
                "audio": payload.audio_enabled,
                "timestamp": datetime.utcnow().isoformat(),
            }

        # =========================
        # RESPUESTA FORMAL AUTOMÁTICA
        # =========================

        elif payload.mode == "auto_reply":

            prompt = f"""
Redacta una respuesta formal, profesional y clara al siguiente correo.
Debe ser concisa, directa y adecuada para un entorno profesional.
No excesivamente larga.
Debe poder enviarse tal cual.

Correo:
{payload.message_content}
"""

            reply = await generate_llm_response(
                prompt=prompt,
                temperature=0.5,
                max_tokens=220,
            )

            return {
                "type": "auto_reply",
                "text": reply.strip(),
                "audio": payload.audio_enabled,
                "timestamp": datetime.utcnow().isoformat(),
            }

        else:
            raise HTTPException(status_code=400, detail="Modo no válido")

    except Exception as e:
        print("Assistant message error:", e)
        raise HTTPException(status_code=500, detail="Error procesando el mensaje")