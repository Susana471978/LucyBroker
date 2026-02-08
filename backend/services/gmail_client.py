import json
from pathlib import Path
from typing import List, Dict, Any, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


# ======================================================
# CONFIG
# ======================================================

BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_DIR = BASE_DIR / "credentials"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]


# ======================================================
# TOKEN HANDLING (POR USUARIO)
# ======================================================

def _get_token_file(user_id: str) -> Path:
    """
    Devuelve la ruta del token Gmail asociada a un usuario.
    Ejemplo:
    backend/credentials/gmail_token_<user_id>.json
    """
    return CREDENTIALS_DIR / f"gmail_token_{user_id}.json"


def get_gmail_service(user_id: str):
    """
    Crea un cliente de Gmail para un usuario concreto.
    """

    token_file = _get_token_file(user_id)

    if not token_file.exists():
        raise Exception("Gmail not connected for this user")

    with open(token_file, "r") as f:
        data = json.load(f)

    creds = Credentials.from_authorized_user_info(
        data,
        SCOPES,
    )

    return build("gmail", "v1", credentials=creds)


# ======================================================
# GMAIL READ OPERATIONS
# ======================================================

def fetch_messages(
    user_id: str,
    max_results: int = 20,
    label_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Devuelve una lista de mensajes Gmail (IDs básicos).
    """

    service = get_gmail_service(user_id)

    result = service.users().messages().list(
        userId="me",
        maxResults=max_results,
        labelIds=label_ids,
    ).execute()

    return result.get("messages", [])


def fetch_message_detail(
    user_id: str,
    msg_id: str,
) -> Dict[str, Any]:
    """
    Devuelve el detalle completo de un mensaje Gmail.
    """

    service = get_gmail_service(user_id)

    return service.users().messages().get(
        userId="me",
        id=msg_id,
        format="full",
    ).execute()
