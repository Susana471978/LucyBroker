# backend/api/gmail.py

import os
import base64
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service

from datetime import datetime, timezone

from backend.models import EmailEvent
from backend.services.rules_engine import calculate_priority
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
# BODY EXTRACTION
# =========================================================

def _decode_gmail_body(data: str) -> str:
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _extract_body_from_payload(payload: Dict[str, Any]) -> str:
    if not payload:
        return ""

    body_data = (payload.get("body") or {}).get("data")
    mime = payload.get("mimeType", "")

    if body_data and mime in ("text/html", "text/plain"):
        return _decode_gmail_body(body_data)

    parts = payload.get("parts") or []
    for part in parts:
        part_mime = part.get("mimeType", "")
        part_body_data = (part.get("body") or {}).get("data")

        if part_mime == "text/html" and part_body_data:
            return _decode_gmail_body(part_body_data)

        if part_mime.startswith("multipart/"):
            found = _extract_body_from_payload(part)
            if found:
                return found

        if part_mime == "text/plain" and part_body_data:
            return _decode_gmail_body(part_body_data)

    if body_data:
        return _decode_gmail_body(body_data)

    return ""


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
        # "all" no es un labelId real; usamos INBOX por defecto para no romper
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
        full_body = _extract_body_from_payload(payload) or ""

        email_event = EmailEvent(
            id=detail["id"],
            thread_id=detail.get("threadId", ""),
            from_name=headers.get("from", ""),
            from_email=headers.get("from", ""),
            subject=headers.get("subject", "(Sin asunto)"),
            date=datetime.now(timezone.utc).isoformat(),
            snippet=snippet,
            body=full_body or snippet,
            labels=detail.get("labelIds", []) or [],
            has_attachments=False,
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
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

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

    return router