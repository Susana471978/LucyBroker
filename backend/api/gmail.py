# backend/api/gmail.py
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from google_auth_oauthlib.flow import Flow

from backend.core.settings import settings

# AJUSTA a tu proyecto real:
from backend.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/gmail", tags=["gmail"])

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
]

CREDENTIALS_DIR = os.path.join(os.path.dirname(__file__), "..", "credentials")
CREDENTIALS_DIR = os.path.abspath(CREDENTIALS_DIR)


def _token_path(user_id: str) -> str:
    os.makedirs(CREDENTIALS_DIR, exist_ok=True)
    return os.path.join(CREDENTIALS_DIR, f"gmail_token_{user_id}.json")


@router.get("/connect")
def gmail_connect(user=Depends(get_current_user)):
    g = settings.gmail()
    if not g.enabled:
        raise HTTPException(503, "Gmail OAuth no está configurado (faltan env vars).")

    user_id = str(user.get("id") or user.get("_id") or user.get("user_id"))

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": g.client_id,
                "client_secret": g.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=g.redirect_uri,
    )

    # state incluye user_id para recuperarlo en callback sin sesión de servidor
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=user_id,
    )

    return {"auth_url": authorization_url}


@router.get("/callback")
def gmail_callback(
    code: str = Query(...),
    state: str = Query(..., description="user_id enviado en connect"),
):
    g = settings.gmail()
    if not g.enabled:
        raise HTTPException(503, "Gmail OAuth no está configurado (faltan env vars).")

    user_id = state

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": g.client_id,
                "client_secret": g.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=g.redirect_uri,
        state=state,
    )

    flow.fetch_token(code=code)
    creds = flow.credentials

    token_file = _token_path(user_id)
    with open(token_file, "w", encoding="utf-8") as f:
        f.write(creds.to_json())

    # UX simple: redirigir a frontend (si quieres). Por ahora devolvemos JSON.
    return {"ok": True, "user_id": user_id, "token_saved": True}
