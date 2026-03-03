# backend/api/ai.py

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
from bs4 import BeautifulSoup

from backend.services.ai_service import AIService
from backend.models import EmailEvent
from backend.utils.response import build_response
from backend.core.dependencies import get_current_user
from backend.core.database import db

router = APIRouter(prefix="/ai", tags=["ai"])

ai_service = AIService()


# ======================================================
# UTIL: LIMPIAR HTML PARA EL MODELO
# ======================================================

def extract_text_from_html(html_content: str) -> str:
    if not html_content:
        return ""

    try:
        soup = BeautifulSoup(html_content, "html.parser")

        # eliminar scripts y estilos
        for tag in soup(["script", "style"]):
            tag.decompose()

        text = soup.get_text(separator=" ")

        # limpiar espacios duplicados
        cleaned = " ".join(text.split())

        # límite defensivo (evita explotar tokens)
        return cleaned[:8000]

    except Exception:
        return html_content[:8000]


# ======================================================
# SUMMARIZE EMAIL
# ======================================================

@router.post("/summarize")
async def summarize_email(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    email_id = payload.get("email_id")

    print("=== DEBUG SUMMARIZE ===")
    print("Incoming email_id:", email_id)

    if not email_id:
        raise HTTPException(status_code=400, detail="email_id requerido")

    # Ver ejemplo real
    example_doc = await db.emails.find_one({})
    print("Example email document in DB:", example_doc)

    # 🔥 búsqueda robusta (evita futuros bugs)
    email_doc = await db.emails.find_one(
        {
            "$or": [
                {"id": email_id},
                {"_id": email_id},
                {"gmail_id": email_id},
            ]
        },
        {"_id": 0},
    )

    print("Result of robust search:", email_doc)

    if not email_doc:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    # 🔥 limpiar HTML antes de enviar al modelo
    clean_body = extract_text_from_html(email_doc.get("body", ""))

    email_doc["body"] = clean_body

    email = EmailEvent(**email_doc)

    summary = await ai_service.summarize_email(
        email=email,
        user_id=user["id"],
    )

    data = {"summary": summary}

    return build_response(request, data=data, legacy=data)


# ======================================================
# DRAFT REPLY (EDITABLE)
# ======================================================

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

    email_doc = await db.emails.find_one(
        {
            "$or": [
                {"id": email_id},
                {"_id": email_id},
                {"gmail_id": email_id},
            ]
        },
        {"_id": 0},
    )

    if not email_doc:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    clean_body = extract_text_from_html(email_doc.get("body", ""))
    email_doc["body"] = clean_body

    email = EmailEvent(**email_doc)

    drafts = await ai_service.draft_reply(
        email=email,
        instructions=instructions,
        user_id=user["id"],
    )

    data = {"drafts": drafts}

    return build_response(request, data=data, legacy=data)


# ======================================================
# AUTO REPLY (IA RESPONDE POR TI)
# ======================================================

@router.post("/auto-reply")
async def auto_reply(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    email_id = payload.get("email_id")

    if not email_id:
        raise HTTPException(status_code=400, detail="email_id requerido")

    email_doc = await db.emails.find_one(
        {
            "$or": [
                {"id": email_id},
                {"_id": email_id},
                {"gmail_id": email_id},
            ]
        },
        {"_id": 0},
    )

    if not email_doc:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    clean_body = extract_text_from_html(email_doc.get("body", ""))
    email_doc["body"] = clean_body

    email = EmailEvent(**email_doc)

    reply = await ai_service.auto_reply(
        email=email,
        user_id=user["id"],
    )

    data = {"reply": reply}

    return build_response(request, data=data, legacy=data)