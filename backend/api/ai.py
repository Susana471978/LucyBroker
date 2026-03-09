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

# ======================================================
# SUMMARIZE ATTACHMENT
# ======================================================

@router.post("/summarize-attachment")
async def summarize_attachment(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Descarga un adjunto de Gmail y genera un resumen con IA.
    Body: { email_id, attachment_id, filename, mime_type }
    """
    import io
    import base64
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build as build_service

    email_id      = payload.get("email_id", "")
    attachment_id = payload.get("attachment_id", "")
    filename      = payload.get("filename", "archivo")
    mime_type     = payload.get("mime_type", "")

    if not email_id or not attachment_id:
        raise HTTPException(status_code=400, detail="email_id y attachment_id son obligatorios")

    if not user.get("gmail_connected"):
        raise HTTPException(status_code=400, detail="Gmail no conectado")

    # ── Descargar adjunto desde Gmail ──────────────────
    tokens = user.get("gmail_tokens") or {}
    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri"),
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
    )
    service = build_service("gmail", "v1", credentials=creds)

    try:
        att = service.users().messages().attachments().get(
            userId="me", messageId=email_id, id=attachment_id
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error descargando adjunto: {exc}")

    raw_data = att.get("data", "")
    file_bytes = base64.urlsafe_b64decode(raw_data.encode("utf-8"))

    # ── Extraer texto según tipo ───────────────────────
    text = ""
    try:
        if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text = " ".join(page.extract_text() or "" for page in reader.pages)

        elif mime_type in (
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ) or filename.lower().endswith((".doc", ".docx")):
            import mammoth
            result = mammoth.extract_raw_text(io.BytesIO(file_bytes))
            text = result.value

        elif mime_type in ("text/plain", "text/csv") or filename.lower().endswith((".txt", ".csv")):
            text = file_bytes.decode("utf-8", errors="ignore")

        else:
            raise HTTPException(status_code=415, detail=f"Tipo de archivo no soportado: {mime_type}")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error extrayendo texto: {exc}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No se pudo extraer texto del documento")

    # Limitar tokens
    text = text[:12000]

    # ── Resumir con IA ────────────────────────────────
    from openai import AsyncOpenAI
    import os as _os
    api_key = _os.getenv("OPENAI_API_KEY")
    summary = ""

    if api_key:
        try:
            client = AsyncOpenAI(api_key=api_key)
            prompt = f"""Resume este documento adjunto en 4-6 frases claras y directas.
Lenguaje natural, como si me lo explicaras en persona.
Si hay fechas, cifras o acciones requeridas, menciónalas explícitamente.
No uses encabezados ni listas.

Documento: {filename}

Contenido:
{text}"""
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=300,
            )
            summary = response.choices[0].message.content.strip()
        except Exception as exc:
            summary = ""

    if not summary:
        # Fallback: primeras frases del texto
        sentences = text.replace("\n", " ").split(".")
        summary = ". ".join(s.strip() for s in sentences[:4] if s.strip())
        if summary and not summary.endswith("."):
            summary += "."

    data = {
        "summary": summary,
        "filename": filename,
        "mime_type": mime_type,
        "size": len(file_bytes),
    }
    return build_response(request, data=data, legacy=data)

