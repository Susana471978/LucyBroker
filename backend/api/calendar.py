# backend/api/calendar.py
#
# Google Calendar integration para Lucy
# Mismo patrón que api/gmail.py — create_calendar_router(db, get_current_user)
#

from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service

from backend.utils.response import build_response
from backend.utils.logger import logger


BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

# ─── Scopes Calendar (readonly es suficiente para Lucy) ───
CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
]

# Permite OAuth en http local
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


# =========================================================
# FLOW
# =========================================================

def _get_calendar_flow(redirect_uri: str, state: str | None = None) -> Flow:
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=CALENDAR_SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


# =========================================================
# HELPERS
# =========================================================

def _parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Normaliza un evento de Google Calendar para el frontend."""
    start = event.get("start", {})
    end = event.get("end", {})

    # dateTime para eventos con hora, date para eventos de día completo
    start_dt = start.get("dateTime") or start.get("date") or ""
    end_dt = end.get("dateTime") or end.get("date") or ""

    attendees = event.get("attendees") or []
    attendee_names = [
        a.get("displayName") or a.get("email", "")
        for a in attendees
        if not a.get("self")
    ]

    return {
        "id": event.get("id", ""),
        "title": event.get("summary", "(Sin título)"),
        "description": event.get("description", ""),
        "location": event.get("location", ""),
        "start": start_dt,
        "end": end_dt,
        "all_day": "date" in start and "dateTime" not in start,
        "attendees": attendee_names,
        "meet_link": event.get("hangoutLink", ""),
        "status": event.get("status", "confirmed"),
        "organizer": (event.get("organizer") or {}).get("displayName", ""),
    }


async def fetch_today_events(user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Devuelve los eventos de hoy del calendario principal del usuario.
    Usado por el briefing matutino de Lucy.
    """
    if not user.get("calendar_connected"):
        return []

    tokens = user.get("calendar_tokens") or {}
    if not tokens.get("token"):
        return []

    try:
        creds = Credentials(
            token=tokens.get("token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri=tokens.get("token_uri"),
            client_id=tokens.get("client_id"),
            client_secret=tokens.get("client_secret"),
            scopes=tokens.get("scopes") or CALENDAR_SCOPES,
        )

        service = build_service("calendar", "v3", credentials=creds)

        # Rango: hoy desde medianoche hasta fin del día
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        events_result = service.events().list(
            calendarId="primary",
            timeMin=start_of_day.isoformat(),
            timeMax=end_of_day.isoformat(),
            maxResults=10,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = events_result.get("items", []) or []
        return [_parse_event(e) for e in events]

    except Exception:
        logger.exception("Error fetching calendar events")
        return []


async def fetch_upcoming_events(
    user: Dict[str, Any],
    days: int = 7,
    max_results: int = 20,
) -> List[Dict[str, Any]]:
    """
    Devuelve los próximos eventos (por defecto 7 días).
    """
    if not user.get("calendar_connected"):
        return []

    tokens = user.get("calendar_tokens") or {}
    if not tokens.get("token"):
        return []

    try:
        creds = Credentials(
            token=tokens.get("token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri=tokens.get("token_uri"),
            client_id=tokens.get("client_id"),
            client_secret=tokens.get("client_secret"),
            scopes=tokens.get("scopes") or CALENDAR_SCOPES,
        )

        service = build_service("calendar", "v3", credentials=creds)

        now = datetime.now(timezone.utc)
        end = now + timedelta(days=days)

        events_result = service.events().list(
            calendarId="primary",
            timeMin=now.isoformat(),
            timeMax=end.isoformat(),
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = events_result.get("items", []) or []
        return [_parse_event(e) for e in events]

    except Exception:
        logger.exception("Error fetching upcoming events")
        return []


# =========================================================
# ROUTER FACTORY
# =========================================================

def create_calendar_router(db, get_current_user: Callable) -> APIRouter:
    router = APIRouter(tags=["calendar"])

    REDIRECT_URI = os.environ.get(
        "CALENDAR_REDIRECT_URI",
        "http://127.0.0.1:8000/api/calendar/callback",
    )

    # ─── STATUS ───────────────────────────────────────────

    @router.get("/calendar/status")
    async def calendar_status(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        """Estado de conexión del calendario."""
        data = {
            "calendar_connected": bool(user.get("calendar_connected", False)),
        }
        return build_response(request, data=data, legacy=data)

    # ─── OAUTH START ──────────────────────────────────────

    @router.get("/calendar/auth")
    async def calendar_auth(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        """Inicia el flujo OAuth de Google Calendar."""
        flow = _get_calendar_flow(REDIRECT_URI, state=user["id"])
        auth_url, _state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        data = {"auth_url": auth_url}
        return build_response(request, data=data, legacy=data)

    # ─── OAUTH CALLBACK ───────────────────────────────────

    @router.get("/calendar/callback")
    async def calendar_callback(
        code: str,
        state: str = Query(...),
    ):
        """
        Callback OAuth — state = user_id
        Guarda tokens en db.users bajo calendar_tokens.
        """
        flow = _get_calendar_flow(REDIRECT_URI, state=state)
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            flow.fetch_token(code=code)
        creds = flow.credentials

        tokens = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes) if creds.scopes else CALENDAR_SCOPES,
        }

        await db.users.update_one(
            {"id": state},
            {
                "$set": {
                    "calendar_tokens": tokens,
                    "calendar_connected": True,
                }
            },
        )

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/app")

    # ─── DISCONNECT ───────────────────────────────────────

    @router.post("/calendar/disconnect")
    async def calendar_disconnect(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        """Desconecta el calendario del usuario."""
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$unset": {"calendar_tokens": ""},
                "$set": {"calendar_connected": False},
            },
        )
        data = {"calendar_connected": False}
        return build_response(request, data=data, legacy=data)

    # ─── EVENTS TODAY ─────────────────────────────────────

    @router.get("/calendar/today")
    async def calendar_today(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        """
        Eventos de hoy — usado por el briefing matutino de Lucy.
        """
        events = await fetch_today_events(user)
        return build_response(request, data=events, legacy=events)

    # ─── UPCOMING EVENTS ──────────────────────────────────

    @router.get("/calendar/upcoming")
    async def calendar_upcoming(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
        days: int = Query(7, ge=1, le=30),
        max_results: int = Query(20, ge=1, le=50),
    ):
        """
        Próximos eventos (default 7 días).
        """
        events = await fetch_upcoming_events(user, days=days, max_results=max_results)
        return build_response(request, data=events, legacy=events)

    return router