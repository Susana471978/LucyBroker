# backend/api/gmail.py

import os
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service
from google.auth.transport.requests import Request as GoogleRequest

from datetime import datetime, timezone

from backend.models import EmailEvent
from backend.services.rules_engine import calculate_priority
from backend.utils.response import build_response


BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _load_client_secrets() -> Dict[str, str]:
    if not CREDENTIALS_FILE.exists():
        raise HTTPException(503, "google_oauth.json no encontrado")

    import json
    raw = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
    cfg = raw.get("web") or raw.get("installed") or {}

    return {
        "client_id": cfg.get("client_id"),
        "client_secret": cfg.get("client_secret"),
    }


def _get_flow(redirect_uri: str, state: str | None = None) -> Flow:
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


def create_gmail_router(db, get_current_user: Callable) -> APIRouter:
    router = APIRouter(tags=["gmail"])

    REDIRECT_URI = os.environ.get(
        "GMAIL_REDIRECT_URI",
        "http://127.0.0.1:8000/api/gmail/callback",
    )

    # ================= AUTH =================

    @router.get("/gmail/auth")
    async def gmail_auth(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        flow = _get_flow(REDIRECT_URI)

        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=user["id"],
        )

        return build_response(
            request,
            data={"auth_url": auth_url},
            legacy={"auth_url": auth_url},
        )

    # ================= CALLBACK =================

    @router.get("/gmail/callback")
    async def gmail_callback(
        request: Request,
        code: str = Query(...),
        state: str = Query(""),
    ):
        if not state:
            raise HTTPException(400, "Falta state")

        flow = _get_flow(REDIRECT_URI, state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials

        service = build_service("gmail", "v1", credentials=creds)
        profile = service.users().getProfile(userId="me").execute()
        gmail_email = profile.get("emailAddress", "")

        token_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
        }

        await db.users.update_one(
            {"id": state},
            {
                "$set": {
                    "gmail_connected": True,
                    "gmail_email": gmail_email,
                    "gmail_tokens": token_data,
                }
            },
        )

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(f"{frontend_url}/app?gmail=connected")

    # ================= STATUS =================

    @router.get("/gmail/status")
    async def gmail_status(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        data = {
            "gmail_connected": bool(user.get("gmail_connected", False)),
            "gmail_email": user.get("gmail_email", "") or "",
        }
        return build_response(request, data=data, legacy=data)

    # ================= DISCONNECT =================

    @router.post("/gmail/disconnect")
    async def gmail_disconnect(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "gmail_connected": False,
                    "gmail_email": "",
                    "gmail_tokens": None,
                }
            },
        )

        data = {
            "gmail_connected": False,
            "gmail_email": "",
        }

        return build_response(request, data=data, legacy=data)

    # ================= MESSAGES =================

    @router.get("/gmail/messages")
    async def gmail_messages(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
        max_results: int = Query(20, ge=1, le=50),
    ):
        if not user.get("gmail_connected"):
            return build_response(request, data=[], legacy=[])

        tokens = user.get("gmail_tokens") or {}

        creds = Credentials(
            token=tokens.get("token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri=tokens.get("token_uri"),
            client_id=tokens.get("client_id"),
            client_secret=tokens.get("client_secret"),
            scopes=tokens.get("scopes"),
        )

        service = build_service("gmail", "v1", credentials=creds)

        results = service.users().messages().list(
            userId="me",
            maxResults=max_results,
        ).execute()

        message_ids = results.get("messages", [])
        enriched = []

        for msg_stub in message_ids:
            msg_id = msg_stub["id"]

            detail = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="full",
            ).execute()

            headers = {
                h["name"].lower(): h["value"]
                for h in detail.get("payload", {}).get("headers", [])
            }

            snippet = detail.get("snippet", "")

            email_event = EmailEvent(
                id=detail["id"],
                thread_id=detail.get("threadId", ""),
                from_name=headers.get("from", ""),
                from_email=headers.get("from", ""),
                subject=headers.get("subject", "(Sin asunto)"),
                date=datetime.now(timezone.utc).isoformat(),
                snippet=snippet,
                body=snippet,
                labels=detail.get("labelIds", []),
                has_attachments=False,
                attachments=[],
            )

            priority = calculate_priority(email_event)

            enriched.append({
                "email": email_event.model_dump(),
                "priority": priority.model_dump(),
            })

        return build_response(request, data=enriched, legacy=enriched)

    return router
