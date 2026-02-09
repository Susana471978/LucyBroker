from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

import os
import json


router = APIRouter()


BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]


REDIRECT_URI = os.environ.get("GMAIL_REDIRECT_URI", "http://127.0.0.1:8000/api/gmail/callback")


def get_flow():
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )


# ==================================================
# INICIAR LOGIN GOOGLE
# ==================================================

@router.get("/auth/google")
async def google_login():

    flow = get_flow()

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )

    return RedirectResponse(auth_url)


# ==================================================
# CALLBACK
# ==================================================

@router.get("/auth/google/callback")
async def google_callback(request: Request):

    flow = get_flow()

    flow.fetch_token(authorization_response=str(request.url))

    credentials = flow.credentials

    token_data = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }

    # Guardamos token (temporal local)
    token_path = BASE_DIR / "credentials" / "gmail_token.json"

    with open(token_path, "w") as f:
        json.dump(token_data, f, indent=2)

    return {
        "status": "connected",
        "message": "Gmail conectado correctamente",
    }
