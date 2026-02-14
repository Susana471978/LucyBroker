# backend/api/gmail.py
"""
Gmail OAuth integration — production-ready version.
Uses google_oauth.json and securely stores tokens in MongoDB.
"""

import os
from pathlib import Path
from typing import Any, Callable, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build as build_service

from datetime import datetime, timezone

from backend.models import EmailEvent
from backend.services.rules_engine import calculate_priority
from backend.utils.response import build_response


# ── Paths ──────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


# ── OAuth Flow Factory ────────────────────────────────

def _get_flow(redirect_uri: str, state: str | None = None) -> Flow:
    if not CREDENTIALS_FILE.exists():
        raise HTTPException(503, "google_oauth.json no encontrado en credentials/")

    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


# ── Router Factory ─────────────────────────────────────

def create_gmail_router(db, get_current_user: Callable) -> APIRouter:

    router = APIRouter(tags=["gmail"])

    REDIRECT_URI = os.environ.get(
        "GMAIL_REDIRECT_URI",
        "http://127.0.0.1:8000/api/gmail/callback",
    )

    # ────────────────────────────────────────────────
    # 1️⃣ Start OAuth
    # ────────────────────────────────────────────────

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

    # ────────────────────────────────────────────────
    # 2️⃣ OAuth Callback
    # ────────────────────────────────────────────────

    @router.get("/gmail/callback")
    async def gmail_callback(
        request: Request,
        code: str = Query(...),
        state: str = Query(""),
    ):
        if not state:
            raise HTTPException(400, "Falta state (user_id)")

        user_id = state

        flow = _get_flow(REDIRECT_URI, state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Obtener email Gmail
        try:
            service = build_service("gmail", "v1", credentials=creds)
            profile = service.users().getProfile(userId="me").execute()
            gmail_email = profile.get("emailAddress", "")
        except Exception:
            gmail_email = ""

        user_doc = await db.users.find_one({"id": user_id})
        existing_tokens = user_doc.get("gmail_tokens") if user_doc else {}

        refresh_token = creds.refresh_token or existing_tokens.get("refresh_token")

        expires_at = creds.expiry.isoformat() if creds.expiry else None
        now = datetime.now(timezone.utc).isoformat()

        token_data = {
            "access_token": creds.token,
            "refresh_token": refresh_token,
            "token_uri": creds.token_uri,
            "scopes": list(creds.scopes or []),
            "expires_at": expires_at,
            "updated_at": now,
        }

        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "gmail_connected": True,
                    "gmail_email": gmail_email,
                    "gmail_tokens": token_data,
                }
            },
        )

        frontend_url = os.environ.get(
            "FRONTEND_URL",
            "http://localhost:3000",
        )

        return RedirectResponse(f"{frontend_url}/app?gmail=connected")

    # ────────────────────────────────────────────────
    # 3️⃣ Gmail Status
    # ────────────────────────────────────────────────

    @router.get("/gmail/status")
    async def gmail_status(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        data = {
            "gmail_connected": user.get("gmail_connected", False),
            "gmail_email": user.get("gmail_email", ""),
        }
        return build_response(request, data=data, legacy=data)

    # ────────────────────────────────────────────────
    # 4️⃣ Gmail Disconnect (NUEVO)
    # ────────────────────────────────────────────────

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

        data = {"success": True}

        return build_response(request, data=data, legacy=data)

    # ────────────────────────────────────────────────
    # 5️⃣ Fetch Messages
    # ────────────────────────────────────────────────

    @router.get("/gmail/messages")
    async def gmail_messages(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
        label: str = Query("all"),
        max_results: int = Query(20, ge=1, le=50),
    ):

        if not user.get("gmail_connected") or not user.get("gmail_tokens"):
            return build_response(request, data=[], legacy=[])

        tokens = user["gmail_tokens"]

        try:
            creds = Credentials(
                token=tokens.get("access_token"),
                refresh_token=tokens.get("refresh_token"),
                token_uri=tokens.get("token_uri"),
                scopes=tokens.get("scopes"),
            )

            if creds.expired and creds.refresh_token:
                creds.refresh(GoogleRequest())

                await db.users.update_one(
                    {"id": user["id"]},
                    {
                        "$set": {
                            "gmail_tokens.access_token": creds.token,
                            "gmail_tokens.expires_at": creds.expiry.isoformat(),
                            "gmail_tokens.updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
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

            if label not in ("all", ""):
                enriched = [
                    e for e in enriched
                    if e["priority"]["priority_label"] == label
                ]

            return build_response(request, data=enriched, legacy=enriched)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return build_response(
                request,
                data=[],
                legacy={"error": str(e), "messages": []},
            )

    return router
