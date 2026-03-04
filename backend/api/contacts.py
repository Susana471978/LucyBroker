from __future__ import annotations

"""
backend/api/contacts.py

Endpoints para la memoria relacional por contacto.
Esta es la feature de diferenciación de ECS.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.core.dependencies import get_current_user
from backend.core.database import db
from backend.services.contact_memory import (
    get_contact_memory,
    get_all_contacts,
    record_interaction,
    mark_pending_action,
    clear_contact_memory,
    build_contact_insight,
)

router = APIRouter(prefix="/contacts", tags=["Contacts Memory"])


# ======================================================
# MODELOS
# ======================================================

class InteractionPayload(BaseModel):
    contact_email: str
    contact_name: str
    subject: str
    action: str                          # read | summarize | draft_reply | auto_reply
    topic_hint: Optional[str] = None
    tone_used: Optional[str] = None
    is_vip: bool = False
    has_pending_action: bool = False


class PendingPayload(BaseModel):
    contact_email: str
    pending: bool = True


# ======================================================
# GET /contacts — todos los contactos del usuario
# ======================================================

@router.get("", response_model=List[Dict[str, Any]])
async def list_contacts(
    only_vip: bool = Query(False),
    only_pending: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Devuelve todos los contactos memorizados del usuario,
    ordenados por frecuencia de interacción.
    """
    contacts = await get_all_contacts(
        db=db,
        user_id=user["id"],
        limit=limit,
        only_vip=only_vip,
        only_pending=only_pending,
    )
    return contacts


# ======================================================
# GET /contacts/{email} — memoria de un contacto
# ======================================================

@router.get("/{contact_email}", response_model=Dict[str, Any])
async def get_contact(
    contact_email: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Devuelve la memoria completa de un contacto específico,
    incluyendo historial de interacciones y contexto.
    """
    memory = await get_contact_memory(
        db=db,
        user_id=user["id"],
        contact_email=contact_email,
    )

    if not memory:
        raise HTTPException(
            status_code=404,
            detail=f"No hay memoria para {contact_email}"
        )

    # Añadir insight de texto generado
    memory["insight"] = build_contact_insight(memory)

    return memory


# ======================================================
# POST /contacts/interaction — registrar interacción
# ======================================================

@router.post("/interaction", response_model=Dict[str, Any])
async def register_interaction(
    payload: InteractionPayload,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Registra una interacción con un contacto.
    Se llama automáticamente al resumir, responder o leer un correo.
    """
    memory = await record_interaction(
        db=db,
        user_id=user["id"],
        contact_email=payload.contact_email,
        contact_name=payload.contact_name,
        subject=payload.subject,
        action=payload.action,
        topic_hint=payload.topic_hint,
        tone_used=payload.tone_used,
        is_vip=payload.is_vip,
        has_pending_action=payload.has_pending_action,
    )

    memory["insight"] = build_contact_insight(memory)

    return memory


# ======================================================
# PATCH /contacts/pending — marcar acción pendiente
# ======================================================

@router.patch("/pending", response_model=Dict[str, Any])
async def set_pending(
    payload: PendingPayload,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Marca o desmarca una acción pendiente con un contacto."""
    await mark_pending_action(
        db=db,
        user_id=user["id"],
        contact_email=payload.contact_email,
        pending=payload.pending,
    )

    memory = await get_contact_memory(
        db=db,
        user_id=user["id"],
        contact_email=payload.contact_email,
    )

    if not memory:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")

    memory["insight"] = build_contact_insight(memory)
    return memory


# ======================================================
# DELETE /contacts/{email} — borrar memoria de contacto
# ======================================================

@router.delete("/{contact_email}")
async def delete_contact_memory(
    contact_email: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Elimina toda la memoria de un contacto específico."""
    await clear_contact_memory(
        db=db,
        user_id=user["id"],
        contact_email=contact_email,
    )
    return {"status": "ok", "deleted": contact_email}