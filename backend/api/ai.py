# backend/api/ai.py

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any

from backend.services.ai_service import AIService
from backend.models import EmailEvent
from backend.utils.response import build_response
from backend.core.dependencies import get_current_user
from backend.core.database import db

router = APIRouter(prefix="/ai", tags=["ai"])

ai_service = AIService()


# ===============================================
# SUMMARIZE EMAIL
# ===============================================

@router.post("/summarize")
async def summarize_email(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    email_id = payload.get("email_id")

    if not email_id:
        raise HTTPException(status_code=400, detail="email_id requerido")

    # Buscar email previamente guardado en Mongo si existe
    email_doc = await db.emails.find_one({"id": email_id}, {"_id": 0})

    if not email_doc:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    email = EmailEvent(**email_doc)

    summary = await ai_service.summarize_email(
        email=email,
        user_id=user["id"],
    )

    data = {"summary": summary}

    return build_response(request, data=data, legacy=data)


# ===============================================
# DRAFT REPLY
# ===============================================

@router.post("/draft-reply")
async def draft_reply(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    email_id = payload.get("email_id")
    instructions = payload.get("instructions", "")

    if not email_id:
        raise HTTPException(status_code=400, detail="email_id requerido")

    email_doc = await db.emails.find_one({"id": email_id}, {"_id": 0})

    if not email_doc:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    email = EmailEvent(**email_doc)

    drafts = await ai_service.draft_reply(
        email=email,
        instructions=instructions,
        user_id=user["id"],
    )

    data = {"drafts": drafts}

    return build_response(request, data=data, legacy=data)
