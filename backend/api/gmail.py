# backend/api/gmail.py
"""
Gmail OAuth integration — minimal endpoints.
Uses google_oauth.json from credentials/ and stores tokens in MongoDB.
"""

import os
import json
from pathlib import Path
from typing import Any, Callable, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service

from datetime import datetime, timezone

from backend.models import EmailEvent
from backend.services.rules_engine import calculate_priority
from backend.utils.response import build_response


# ── Paths ──
BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Allow http redirect_uri in development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _get_flow(redirect_uri: str, state: str | None = None) -> Flow:
    """Create OAuth flow from the local credentials JSON file."""
    if not CREDENTIALS_FILE.exists():
        raise HTTPException(503, "google_oauth.json no encontrado en credentials/")

    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


def create_gmail_router(db, get_current_user: Callable) -> APIRouter:
    """Factory: returns a router wired to the app's db and auth dependency."""

    router = APIRouter(tags=["gmail"])

    REDIRECT_URI = os.environ.get("GMAIL_REDIRECT_URI", "http://127.0.0.1:8000/api/gmail/callback")

    # ── 1. Start OAuth ──────────────────────────────────

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
            state=user["id"],          # recover user in callback
        )

        return build_response(
            request,
            data={"auth_url": auth_url},
            legacy={"auth_url": auth_url},
        )

    # ── 2. Google redirects here ─────────────────────────

    @router.get("/gmail/callback")
    async def gmail_callback(
        request: Request,
        code: str = Query(...),
        state: str = Query(""),
    ):
        user_id = state
        if not user_id:
            raise HTTPException(400, "Falta state (user_id)")

        flow = _get_flow(REDIRECT_URI, state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Fetch Gmail address
        try:
            service = build_service("gmail", "v1", credentials=creds)
            profile = service.users().getProfile(userId="me").execute()
            gmail_email = profile.get("emailAddress", "")
        except Exception:
            gmail_email = ""

        # Persist in Mongo
        token_data = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
        }

        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "gmail_connected": True,
                "gmail_email": gmail_email,
                "gmail_tokens": token_data,
            }},
        )

        # Redirect back to dashboard
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(f"{frontend_url}/app?gmail=connected")

    # ── 3. Status check ──────────────────────────────────

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

    # ── 4. Fetch messages ────────────────────────────────

    @router.get("/gmail/messages")
    async def gmail_messages(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
        label: str = Query("all"),
        max_results: int = Query(20, ge=1, le=50),
    ):
        """Fetch Gmail messages and return enriched with priority scoring."""
        if not user.get("gmail_connected") or not user.get("gmail_tokens"):
            return build_response(request, data=[], legacy=[])

        tokens = user["gmail_tokens"]

        try:
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
                    format="metadata",
                    metadataHeaders=["Subject", "From", "Date"],
                ).execute()

                headers = {}
                for h in detail.get("payload", {}).get("headers", []):
                    headers[h["name"].lower()] = h["value"]

                try:
                    date_str = datetime.fromtimestamp(
                        int(detail.get("internalDate", 0)) / 1000,
                        tz=timezone.utc,
                    ).isoformat()
                except Exception:
                    date_str = datetime.now(timezone.utc).isoformat()

                snippet = detail.get("snippet", "")

                email_event = EmailEvent(
                    id=detail["id"],
                    thread_id=detail.get("threadId", ""),
                    from_name=headers.get("from", ""),
                    from_email=headers.get("from", ""),
                    subject=headers.get("subject", "(Sin asunto)"),
                    date=date_str,
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

            # Filter by priority label if requested
            if label and label not in ("all", ""):
                enriched = [
                    e for e in enriched
                    if e["priority"]["priority_label"] == label
                ]

            # Persist refreshed token if it changed
            if creds.token != tokens.get("token"):
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"gmail_tokens.token": creds.token}},
                )

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
