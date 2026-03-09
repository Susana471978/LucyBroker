# backend/api/gmail.py

import os
import base64
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service

from datetime import datetime, timezone

from backend.models import EmailEvent
from backend.services.rules_engine import calculate_priority
from backend.services.contact_memory import record_interaction
from backend.utils.response import build_response


BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Permite OAuth en http local
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


# =========================================================
# FLOW
# =========================================================

def _get_flow(redirect_uri: str, state: str | None = None) -> Flow:
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


# =========================================================
# BODY EXTRACTION + CLEANING
# =========================================================

_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_TRACKING_GARBAGE_RE = re.compile(
    r"(utm_[a-zA-Z0-9_]+=[^&\s]+|source=email|digest\.reader|email-[0-9a-fA-F-]{6,})",
    re.IGNORECASE,
)
_LONG_DASH_RE = re.compile(r"-{10,}")

def _decode_gmail_body(data: str) -> str:
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _iter_parts(payload: Dict[str, Any]):
    """Yield parts recursively (DFS)."""
    if not payload:
        return
    parts = payload.get("parts") or []
    for p in parts:
        yield p
        if (p.get("mimeType") or "").startswith("multipart/"):
            yield from _iter_parts(p)


def _find_part_data(payload: Dict[str, Any], wanted_mime: str) -> Optional[str]:
    """
    Busca el primer body.data para un mimeType exacto en TODO el árbol.
    Importante: NO devolver text/plain antes de confirmar que no existe text/html.
    """
    if not payload:
        return None

    # 1) Si el payload actual coincide
    mime = payload.get("mimeType", "")
    body_data = (payload.get("body") or {}).get("data")
    if body_data and mime == wanted_mime:
        return body_data

    # 2) Buscar en partes recursivamente
    for part in _iter_parts(payload):
        part_mime = part.get("mimeType", "")
        part_body_data = (part.get("body") or {}).get("data")
        if part_body_data and part_mime == wanted_mime:
            return part_body_data

    return None


def _extract_best_body(payload: Dict[str, Any]) -> Tuple[str, str]:
    """
    Devuelve (html, text) ya decodificados (strings).
    - Si existe text/html en cualquier parte => lo usamos.
    - Si no, usamos text/plain.
    """
    if not payload:
        return ("", "")

    html_data = _find_part_data(payload, "text/html")
    text_data = _find_part_data(payload, "text/plain")

    html = _decode_gmail_body(html_data) if html_data else ""
    text = _decode_gmail_body(text_data) if text_data else ""

    # fallback: a veces body.data viene en payload root aunque el mime no cuadre del todo
    if not html and not text:
        root_data = (payload.get("body") or {}).get("data")
        if root_data:
            decoded = _decode_gmail_body(root_data)
            # si parece HTML, lo tratamos como html
            if "<html" in decoded.lower() or "<body" in decoded.lower() or "</" in decoded:
                html = decoded
            else:
                text = decoded

    return (html, text)


def _extract_attachments(payload):
    SUPPORTED = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv",
    }
    attachments = []
    for part in _iter_parts(payload):
        disposition = ""
        for h in (part.get("headers") or []):
            if h.get("name", "").lower() == "content-disposition":
                disposition = h.get("value", "").lower()
        mime = part.get("mimeType", "")
        body = part.get("body") or {}
        attachment_id = body.get("attachmentId", "")
        filename = part.get("filename", "")
        size = body.get("size", 0)
        if not attachment_id or not filename:
            continue
        if "inline" in disposition and mime.startswith("image/"):
            continue
        attachments.append({"id": attachment_id, "name": filename, "size": size, "mime_type": mime})
    return attachments


def _extract_attachments(payload):
    SUPPORTED = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv",
    }
    attachments = []
    for part in _iter_parts(payload):
        disposition = ""
        for h in (part.get("headers") or []):
            if h.get("name", "").lower() == "content-disposition":
                disposition = h.get("value", "").lower()
        mime = part.get("mimeType", "")
        body = part.get("body") or {}
        attachment_id = body.get("attachmentId", "")
        filename = part.get("filename", "")
        size = body.get("size", 0)
        if not attachment_id or not filename:
            continue
        if "inline" in disposition and mime.startswith("image/"):
            continue
        attachments.append({"id": attachment_id, "name": filename, "size": size, "mime_type": mime})
    return attachments


def _strip_html_to_text(html: str) -> str:
    """
    Convierte HTML a texto. Si bs4 está disponible lo usa; si no, fallback por regex.
    """
    if not html:
        return ""

    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(html, "html.parser")

        # eliminar scripts/styles/noscript
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        # convertir links: mantener texto visible, ignorar href con tracking
        for a in soup.find_all("a"):
            txt = (a.get_text(" ", strip=True) or "").strip()
            a.replace_with(txt if txt else "")

        text = soup.get_text(separator="\n")
        return text.strip()
    except Exception:
        # fallback simple
        cleaned = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html)
        cleaned = re.sub(r"(?is)<br\s*/?>", "\n", cleaned)
        cleaned = re.sub(r"(?is)</p\s*>", "\n", cleaned)
        cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
        cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()


def _clean_text_for_ai(text: str) -> str:
    """
    Limpieza agresiva para mejorar coherencia del resumen:
    - elimina URLs
    - elimina tracking/utm
    - elimina separadores largos
    - compacta espacios
    """
    if not text:
        return ""

    # quitar urls enteras
    text = _URL_RE.sub("", text)

    # quitar tracking / basura típica
    text = _TRACKING_GARBAGE_RE.sub("", text)

    # quitar líneas de guiones largos
    text = _LONG_DASH_RE.sub("", text)

    # normalizar espacios
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # limpiar líneas demasiado vacías
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]  # elimina vacías
    return "\n".join(lines).strip()


def _text_to_safe_html(text: str) -> str:
    """
    Convierte texto a HTML simple y legible.
    """
    if not text:
        return ""
    # escapado mínimo (evitar que texto plano se interprete como HTML)
    safe = (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )
    # saltos de línea
    safe = safe.replace("\n", "<br/>")
    return f"<div>{safe}</div>"


def _clean_html_for_display(html: str) -> str:
    """
    Devuelve un HTML más 'limpio' y legible:
    - elimina scripts/styles/noscript
    - elimina tracking en anchors (dejando texto)
    - reduce imágenes (opcional: quitarlas)
    """
    if not html:
        return ""

    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(html, "html.parser")

        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        # opcional: fuera imágenes para evitar bloques gigantes / tracking pixels
        for img in soup.find_all("img"):
            img.decompose()

        # links -> solo texto (evita bloques de URL/utm)
        for a in soup.find_all("a"):
            txt = (a.get_text(" ", strip=True) or "").strip()
            a.replace_with(txt if txt else "")

        # compactar espacios
        out = str(soup)
        out = re.sub(r">\s+<", "><", out)
        return out.strip()
    except Exception:
        # fallback: quitar scripts/styles
        out = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", "", html)
        return out.strip()


# =========================================================
# FETCH + SAVE
# =========================================================

async def fetch_enriched_messages(
    user: Dict[str, Any],
    db,
    max_results: int = 20,
    label: str = "inbox",
) -> List[Dict[str, Any]]:
    """
    Devuelve una lista enriquecida:
    [
      { "email": <EmailEvent dict>, "priority": <priority dict> },
      ...
    ]
    Además persiste cada email en Mongo (db.emails).
    """

    if not user.get("gmail_connected"):
        return []

    tokens = user.get("gmail_tokens") or {}
    if not tokens.get("token"):
        # Estado inconsistente: marcado conectado pero sin token
        return []

    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri"),
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=tokens.get("scopes") or SCOPES,
    )

    service = build_service("gmail", "v1", credentials=creds)

    # Mapeo simple de label del frontend -> labelIds Gmail
    label_ids = ["INBOX"]
    if label and label.lower() in ("all", "todo", "todos"):
        label_ids = ["INBOX"]
    elif label and label.lower() in ("inbox", "entrada"):
        label_ids = ["INBOX"]
    elif label and label.lower() in ("unread", "no_leidos", "no leidos"):
        label_ids = ["INBOX", "UNREAD"]

    results = service.users().messages().list(
        userId="me",
        labelIds=label_ids,
        maxResults=max_results,
    ).execute()

    message_ids = results.get("messages", []) or []
    enriched: List[Dict[str, Any]] = []

    for msg_stub in message_ids:
        msg_id = msg_stub["id"]

        detail = service.users().messages().get(
            userId="me",
            id=msg_id,
            format="full",
        ).execute()

        headers = {
            h["name"].lower(): h["value"]
            for h in (detail.get("payload", {}) or {}).get("headers", []) or []
        }

        snippet = detail.get("snippet", "")
        payload = detail.get("payload", {}) or {}

        # ✅ Extraer siempre HTML si existe (aunque text/plain venga antes)
        html_raw, text_raw = _extract_best_body(payload)

        # ✅ HTML para UI: limpio (sin scripts/images, links -> texto)
        html_display = _clean_html_for_display(html_raw) if html_raw else ""

        # ✅ Texto para IA: preferimos texto derivado del HTML (más real) y lo limpiamos fuerte
        text_from_html = _strip_html_to_text(html_raw) if html_raw else ""
        ai_base_text = text_from_html or text_raw or snippet or ""
        text_for_ai = _clean_text_for_ai(ai_base_text)

        # ✅ Body final que verá el frontend:
        # - Si hay HTML -> HTML limpio
        # - Si no hay HTML -> texto convertido a HTML (legible)
        if html_display:
            body_for_ui = html_display
        else:
            body_for_ui = _text_to_safe_html(text_raw or snippet or "")

        email_event = EmailEvent(
            id=detail["id"],
            thread_id=detail.get("threadId", ""),
            from_name=headers.get("from", ""),
            from_email=headers.get("from", ""),
            subject=headers.get("subject", "(Sin asunto)"),
            date=datetime.now(timezone.utc).isoformat(),
            snippet=snippet,
            # ⚠️ Conservamos compatibilidad:
            # body se usa en UI (HTML legible).
            # Además guardamos en Mongo un campo extra `body_text` para IA/depuración.
            body=body_for_ui or _text_to_safe_html(snippet or ""),
            labels=detail.get("labelIds", []) or [],
            has_attachments=len(_extract_attachments(payload)) > 0,
            attachments=[],
        )

        priority = calculate_priority(email_event)
        email_dict = email_event.model_dump()

        now = datetime.now(timezone.utc).isoformat()

        # Persistencia en Mongo
        await db.emails.update_one(
            {"_id": msg_id},
            {
                "$set": {
                    "_id": msg_id,
                    "gmail_id": msg_id,
                    "user_id": user["id"],
                    **email_dict,
                    # 🔥 EXTRA: texto limpio para IA y para debug
                    "body_text": text_for_ai,
                    "attachments_raw": _extract_attachments(payload),
                    "has_attachments": len(_extract_attachments(payload)) > 0,
                    "attachments_raw": _extract_attachments(payload),
                    "has_attachments": len(_extract_attachments(payload)) > 0,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

        # Registrar contacto en contact_memory automáticamente
        try:
            from_raw = headers.get("from", "")
            import re as _re
            email_match = _re.search(r'[\w\.\+\-]+@[\w\.\-]+', from_raw)
            contact_email = email_match.group(0).lower() if email_match else from_raw.lower()
            name_match = _re.match(r'^"?([^"<]+)"?\s*<', from_raw)
            contact_name = name_match.group(1).strip() if name_match else contact_email
            priority_label = priority.model_dump().get("priority_label", "INFORMATIVO")
            is_vip = priority_label == "PRIORITARIO"
            await record_interaction(
                db=db,
                user_id=user["id"],
                contact_email=contact_email,
                contact_name=contact_name,
                subject=email_event.subject,
                action="read",
                is_vip=is_vip,
            )
        except Exception as _ce:
            pass  # nunca romper el flujo principal

        enriched.append(
            {
                "email": email_dict,
                "priority": priority.model_dump(),
            }
        )

    return enriched


# =========================================================
# ROUTER
# =========================================================

def create_gmail_router(db, get_current_user: Callable) -> APIRouter:
    router = APIRouter(tags=["gmail"])

    REDIRECT_URI = os.environ.get(
        "GMAIL_REDIRECT_URI",
        "http://127.0.0.1:8000/api/gmail/callback",
    )

    # ================= STATUS (🔴 FALTABA Y ROMPE LAS CARDS) =================

    @router.get("/gmail/status")
    async def gmail_status(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        """
        Endpoint usado por el frontend para decidir si mostrar:
        - banner 'Conectar mi correo'
        - o cards/resúmenes/Executive

        Si esto da 404, el frontend se cae al modo "no conectado".
        """
        data = {
            "gmail_connected": bool(user.get("gmail_connected", False)),
        }
        return build_response(request, data=data, legacy=data)

    # ================= OAUTH START =================

    @router.get("/gmail/auth")
    async def gmail_auth(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        # Usamos state=user_id para poder guardar tokens en callback sin auth header
        flow = _get_flow(REDIRECT_URI, state=user["id"])
        auth_url, _state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        data = {"auth_url": auth_url}
        return build_response(request, data=data, legacy=data)

    # ================= OAUTH CALLBACK =================

    @router.get("/gmail/callback")
    async def gmail_callback(
        code: str,
        state: str = Query(...),
    ):
        """
        state = user_id
        NO usamos Depends(get_current_user) aquí.
        """
        flow = _get_flow(REDIRECT_URI, state=state)
        flow.fetch_token(code=code)

        creds = flow.credentials

        tokens = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes) if creds.scopes else SCOPES,
        }

        await db.users.update_one(
            {"id": state},
            {
                "$set": {
                    "gmail_tokens": tokens,
                    "gmail_connected": True,
                }
            },
        )

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/app")

    # ================= MESSAGES =================

    @router.get("/gmail/messages")
    async def gmail_messages(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
        max_results: int = Query(20, ge=1, le=50),
        # Estos params los envía tu UI; los aceptamos para no romper aunque no se usen a fondo
        label: str = Query("inbox"),
        attachments: bool = Query(False),
    ):
        _ = attachments  # placeholder (no implementamos adjuntos todavía)
        enriched = await fetch_enriched_messages(user, db, max_results=max_results, label=label)
        return build_response(request, data=enriched, legacy=enriched)

    @router.post("/gmail/disconnect")
    async def gmail_disconnect(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"gmail_tokens": ""}, "$set": {"gmail_connected": False}},
        )
        data = {"gmail_connected": False}
        return build_response(request, data=data, legacy=data)

    return router
