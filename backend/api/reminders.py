# backend/api/reminders.py

from __future__ import annotations

import os
import re
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from bson import ObjectId

from backend.utils.response import build_response
from backend.core.dependencies import get_current_user
from backend.core.database import db
from backend.utils.logger import logger


router = APIRouter(prefix="/reminders", tags=["reminders"])


def _serialize(doc: Dict) -> Dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# =====================================================
# LISTAR RECORDATORIOS
# =====================================================

@router.get("")
async def list_reminders(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
    done: Optional[bool] = None,
):
    query: Dict[str, Any] = {"user_id": user["id"]}
    if done is not None:
        query["done"] = done

    cursor = db.reminders.find(query).sort("remind_at", 1)
    reminders = []
    async for doc in cursor:
        reminders.append(_serialize(doc))

    return build_response(request, data={"reminders": reminders}, legacy={"reminders": reminders})


# =====================================================
# CREAR RECORDATORIO
# =====================================================

@router.post("")
async def create_reminder(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    text = (payload.get("text") or "").strip()
    remind_at = payload.get("remind_at")  # ISO format: "2026-03-15T17:00:00"

    if not text:
        raise HTTPException(status_code=400, detail="El texto es obligatorio")
    if not remind_at:
        raise HTTPException(status_code=400, detail="La fecha/hora es obligatoria")

    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "user_id": user["id"],
        "text": text,
        "remind_at": remind_at,
        "done": False,
        "notified": False,
        "created_at": now,
    }

    result = await db.reminders.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    return build_response(request, data={"reminder": doc}, legacy={"reminder": doc})


# =====================================================
# CHECK — recordatorios pendientes de notificar
# =====================================================

@router.get("/check")
async def check_reminders(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Devuelve recordatorios cuya hora ya pasó y aún no se notificaron.
    El frontend los muestra y luego llama a /mark para marcarlos.
    """
    now = datetime.now(timezone.utc)

    # Buscar recordatorios que ya deben dispararse
    cursor = db.reminders.find({
        "user_id": user["id"],
        "done": False,
        "notified": False,
        "remind_at": {"$lte": now.isoformat()},
    }).sort("remind_at", 1).limit(5)

    due = []
    async for doc in cursor:
        due.append(_serialize(doc))

    return build_response(request, data={"due": due}, legacy={"due": due})


# =====================================================
# MARCAR COMO NOTIFICADO
# =====================================================

@router.post("/{reminder_id}/mark")
async def mark_notified(
    reminder_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        oid = ObjectId(reminder_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.reminders.update_one(
        {"_id": oid, "user_id": user["id"]},
        {"$set": {"notified": True, "done": True}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")

    return build_response(request, data={"marked": reminder_id}, legacy={"marked": reminder_id})


# =====================================================
# ELIMINAR RECORDATORIO
# =====================================================

@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        oid = ObjectId(reminder_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.reminders.delete_one({"_id": oid, "user_id": user["id"]})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")

    return build_response(request, data={"deleted": reminder_id}, legacy={"deleted": reminder_id})


# =====================================================
# EXTRACCIÓN DE RECORDATORIO DESDE LENGUAJE NATURAL
# =====================================================

REMINDER_KEYWORDS = [
    "recuérdame", "recuerdame", "recordar", "avísame", "avisame",
    "no me dejes olvidar", "que no se me olvide", "recordatorio",
    "acuérdame", "acuerdame",
]


def is_reminder_intent(text: str) -> bool:
    t = text.lower().strip()
    return any(kw in t for kw in REMINDER_KEYWORDS)


async def extract_reminder_data(user_text: str) -> Optional[Dict[str, Any]]:
    """Usa el LLM para extraer qué recordar y cuándo."""
    from backend.services.ai_service import generate_llm_response

    now = datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        pass

    today_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M")
    weekday = now.strftime("%A")

    prompt = f"""Eres un extractor de datos de recordatorios.
Hoy es {today_str} ({weekday}), hora actual: {time_str}. Zona horaria: Europe/Madrid.

El usuario dice: "{user_text}"

Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional ni backticks.

Formato exacto:
{{
  "text": "qué debe recordar el usuario (frase clara y corta)",
  "remind_at": "YYYY-MM-DDTHH:MM:00",
  "friendly_time": "descripción legible en español de cuándo (ej: 'hoy a las 17:00', 'mañana a las 9:00')"
}}

Reglas:
- Si dice "esta tarde" sin hora, usa las 17:00.
- Si dice "mañana por la mañana", usa las 09:00 del día siguiente.
- Si dice "en 2 horas", calcula desde la hora actual.
- Si dice "a las 5", interpreta PM si es por la tarde (17:00).
- Si no especifica hora, usa una hora razonable según el contexto.
- "text" debe ser la acción a recordar, no la instrucción completa del usuario.
"""

    raw = await generate_llm_response(prompt)
    clean = raw.strip().replace("```json", "").replace("```", "").strip()

    try:
        data = json.loads(clean)
        if data.get("text") and data.get("remind_at"):
            return data
    except Exception:
        pass

    # Fallback regex
    match = re.search(r'\{[^{}]+\}', clean, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if data.get("text") and data.get("remind_at"):
                return data
        except Exception:
            pass

    return None