from __future__ import annotations

"""
backend/api/contacts.py
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta

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
    action: str
    topic_hint: Optional[str] = None
    tone_used: Optional[str] = None
    is_vip: bool = False
    has_pending_action: bool = False


class PendingPayload(BaseModel):
    contact_email: str
    pending: bool = True


# ======================================================
# GET /contacts
# ======================================================

@router.get("", response_model=List[Dict[str, Any]])
async def list_contacts(
    only_vip: bool = Query(False),
    only_pending: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    user: Dict[str, Any] = Depends(get_current_user),
):
    contacts = await get_all_contacts(
        db=db, user_id=user["id"], limit=limit,
        only_vip=only_vip, only_pending=only_pending,
    )
    return contacts


# ======================================================
# GET /contacts/radar — Radar de oportunidades Lucy
# ======================================================

@router.get("/radar", response_model=List[Dict[str, Any]])
async def get_radar(
    days_silent: int = Query(7, ge=1, le=90, description="Días sin contacto para considerar silenciado"),
    limit: int = Query(20, ge=1, le=50),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Radar de oportunidades de Lucy.

    Devuelve contactos que necesitan atención, ordenados por urgencia:
    - VIPs con acción pendiente
    - Contactos frecuentes sin respuesta en X días
    - Contactos con seguimiento caducado
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days_silent)

    all_contacts = await get_all_contacts(db=db, user_id=user["id"], limit=200)

    radar: List[Dict[str, Any]] = []

    for c in all_contacts:
        score = 0
        reasons = []

        last_interaction = c.get("last_interaction_at")
        interaction_count = c.get("interaction_count", 0)
        is_vip = c.get("is_vip", False)
        has_pending = c.get("has_pending_action", False)
        last_subject = c.get("last_subject", "")

        # Parsear fecha
        last_dt = None
        if last_interaction:
            try:
                if isinstance(last_interaction, str):
                    last_dt = datetime.fromisoformat(last_interaction.replace("Z", "+00:00"))
                elif isinstance(last_interaction, datetime):
                    last_dt = last_interaction
                if last_dt and last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass

        days_since = None
        if last_dt:
            days_since = (now - last_dt).days

        # ── Scoring ──────────────────────────────────────
        # VIP con pendiente → máxima urgencia
        if is_vip and has_pending:
            score += 100
            reasons.append("VIP con acción pendiente")

        # VIP sin contacto reciente
        elif is_vip and days_since is not None and days_since >= days_silent:
            score += 80
            reasons.append(f"Cliente VIP sin respuesta hace {days_since} días")

        # Contacto frecuente silenciado
        elif interaction_count >= 3 and days_since is not None and days_since >= days_silent:
            score += 60 + min(interaction_count * 2, 20)
            reasons.append(f"Contacto frecuente sin actividad hace {days_since} días")

        # Pendiente sin ser VIP
        elif has_pending:
            score += 50
            reasons.append("Acción pendiente sin resolver")

        # Contacto con 1-2 interacciones silenciado
        elif interaction_count >= 1 and days_since is not None and days_since >= days_silent:
            score += 30
            reasons.append(f"Sin contacto hace {days_since} días")

        # Solo incluir si tiene score
        if score > 0:
            radar.append({
                "contact_email": c.get("contact_email", ""),
                "contact_name": c.get("contact_name", ""),
                "score": score,
                "reasons": reasons,
                "days_since_contact": days_since,
                "interaction_count": interaction_count,
                "last_subject": last_subject,
                "is_vip": is_vip,
                "has_pending_action": has_pending,
                "insight": build_contact_insight(c),
            })

    # Ordenar por score descendente
    radar.sort(key=lambda x: x["score"], reverse=True)

    return radar[:limit]


# ======================================================
# GET /contacts/{email}
# ======================================================

@router.get("/{contact_email}", response_model=Dict[str, Any])
async def get_contact(
    contact_email: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    memory = await get_contact_memory(db=db, user_id=user["id"], contact_email=contact_email)
    if not memory:
        raise HTTPException(status_code=404, detail=f"No hay memoria para {contact_email}")
    memory["insight"] = build_contact_insight(memory)
    return memory


# ======================================================
# POST /contacts/interaction
# ======================================================

@router.post("/interaction", response_model=Dict[str, Any])
async def register_interaction(
    payload: InteractionPayload,
    user: Dict[str, Any] = Depends(get_current_user),
):
    memory = await record_interaction(
        db=db, user_id=user["id"],
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
# PATCH /contacts/pending
# ======================================================

@router.patch("/pending", response_model=Dict[str, Any])
async def set_pending(
    payload: PendingPayload,
    user: Dict[str, Any] = Depends(get_current_user),
):
    await mark_pending_action(db=db, user_id=user["id"],
        contact_email=payload.contact_email, pending=payload.pending)
    memory = await get_contact_memory(db=db, user_id=user["id"], contact_email=payload.contact_email)
    if not memory:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    memory["insight"] = build_contact_insight(memory)
    return memory


# ======================================================
# DELETE /contacts/{email}
# ======================================================

@router.delete("/{contact_email}")
async def delete_contact_memory(
    contact_email: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    await clear_contact_memory(db=db, user_id=user["id"], contact_email=contact_email)
    return {"status": "ok", "deleted": contact_email}