# backend/api/calendar.py

from __future__ import annotations

import os
import warnings
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service

from backend.services.google_auth import get_valid_credentials
from backend.services.token_encryption import encrypt_tokens
from backend.utils.response import build_response
from backend.utils.logger import logger


BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
]

os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


def _get_calendar_flow(redirect_uri: str, state: str | None = None) -> Flow:
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=CALENDAR_SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


def _parse_event(event: Dict[str, Any]) -> Dict[str, Any]:
    start = event.get("start", {})
    end = event.get("end", {})
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


async def fetch_today_events(user: Dict[str, Any], db) -> List[Dict[str, Any]]:
    """Fetch today's events. Now accepts *db* so it can refresh tokens."""
    if not user.get("calendar_connected"):
        return []

    creds = await get_valid_credentials(
        user, db, token_field="calendar_tokens", default_scopes=CALENDAR_SCOPES,
    )
    if creds is None:
        return []

    try:
        service = build_service("calendar", "v3", credentials=creds)
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
        return [_parse_event(e) for e in (events_result.get("items", []) or [])]
    except Exception:
        logger.exception("Error fetching today events")
        return []


async def fetch_upcoming_events(
    user: Dict[str, Any],
    db,
    days: int = 7,
    max_results: int = 20,
) -> List[Dict[str, Any]]:
    """Fetch upcoming events. Now accepts *db* so it can refresh tokens."""
    if not user.get("calendar_connected"):
        return []

    creds = await get_valid_credentials(
        user, db, token_field="calendar_tokens", default_scopes=CALENDAR_SCOPES,
    )
    if creds is None:
        return []

    try:
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
        return [_parse_event(e) for e in (events_result.get("items", []) or [])]
    except Exception:
        logger.exception("Error fetching upcoming events")
        return []


def create_calendar_router(db, get_current_user: Callable) -> APIRouter:
    router = APIRouter(tags=["calendar"])

    REDIRECT_URI = os.environ.get(
        "CALENDAR_REDIRECT_URI",
        "http://127.0.0.1:8000/api/calendar/callback",
    )

    @router.get("/calendar/status")
    async def calendar_status(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
        data = {"calendar_connected": bool(user.get("calendar_connected", False))}
        return build_response(request, data=data, legacy=data)

    @router.get("/calendar/auth")
    async def calendar_auth(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
        flow = _get_calendar_flow(REDIRECT_URI, state=user["id"])

        auth_url, _state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )

        data = {"auth_url": auth_url}
        return build_response(request, data=data, legacy=data)

    @router.get("/calendar/callback")
    async def calendar_callback(code: str, state: str = Query(...)):
        flow = _get_calendar_flow(REDIRECT_URI, state=state)
        # Google devuelve gmail+calendar scopes juntos — ignoramos el warning de scope
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            flow.fetch_token(code=code, code_verifier=None)
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
            {"$set": {"calendar_tokens": encrypt_tokens(tokens), "calendar_connected": True}},        )
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/app")

    @router.post("/calendar/disconnect")
    async def calendar_disconnect(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"calendar_tokens": ""}, "$set": {"calendar_connected": False}},
        )
        data = {"calendar_connected": False}
        return build_response(request, data=data, legacy=data)

    @router.get("/calendar/today")
    async def calendar_today(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
        events = await fetch_today_events(user, db)
        return build_response(request, data=events, legacy=events)

    @router.get("/calendar/upcoming")
    async def calendar_upcoming(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
        days: int = Query(7, ge=1, le=30),
        max_results: int = Query(20, ge=1, le=50),
    ):
        events = await fetch_upcoming_events(user, db, days=days, max_results=max_results)
        return build_response(request, data=events, legacy=events)

    @router.post("/calendar/events")
    async def calendar_create_event(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        """
        Crea un evento en el calendario principal del usuario.
        Body: { title, date, start_time, end_time, description?, location?, attendees? }
        """
        body = await request.json()
        title = body.get("title", "").strip()
        date = body.get("date", "")
        start_time = body.get("start_time", "09:00")
        end_time = body.get("end_time", "10:00")
        description = body.get("description", "")
        location = body.get("location", "")
        attendees_raw = body.get("attendees", [])

        if not title or not date:
            raise HTTPException(status_code=400, detail="title y date son obligatorios")

        if not user.get("calendar_connected"):
            raise HTTPException(status_code=400, detail="Calendario no conectado")

        creds = await get_valid_credentials(
            user, db, token_field="calendar_tokens", default_scopes=CALENDAR_SCOPES,
        )
        if creds is None:
            raise HTTPException(
                status_code=401,
                detail="Token de calendario expirado. Por favor, reconecta tu calendario.",
            )

        service = build_service("calendar", "v3", credentials=creds)

        event_body: Dict[str, Any] = {
            "summary": title,
            "start": {"dateTime": f"{date}T{start_time}:00", "timeZone": "Europe/Madrid"},
            "end":   {"dateTime": f"{date}T{end_time}:00",   "timeZone": "Europe/Madrid"},
        }
        if description:
            event_body["description"] = description
        if location:
            event_body["location"] = location
        if attendees_raw:
            event_body["attendees"] = [{"email": e} for e in attendees_raw if "@" in e]

        try:
            created = service.events().insert(calendarId="primary", body=event_body).execute()
            result = _parse_event(created)
            return build_response(request, data=result, legacy=result)
        except Exception as exc:
            logger.exception("Error creating calendar event")
            raise HTTPException(status_code=500, detail=str(exc))

    return router