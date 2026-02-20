from typing import List, Dict, Any, Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from backend.server import db


SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]


async def _get_user(user_id: str):
    return await db.users.find_one({"id": user_id})


def _build_service_from_tokens(tokens: Dict[str, Any]):
    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri"),
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=tokens.get("scopes"),
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    return build("gmail", "v1", credentials=creds)


def fetch_messages(
    user: Dict[str, Any],
    max_results: int = 20,
    label_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:

    if not user.get("gmail_connected"):
        raise Exception("Gmail not connected for this user")

    tokens = user.get("gmail_tokens") or {}
    service = _build_service_from_tokens(tokens)

    result = service.users().messages().list(
        userId="me",
        maxResults=max_results,
        labelIds=label_ids,
    ).execute()

    return result.get("messages", [])


def fetch_message_detail(
    user: Dict[str, Any],
    msg_id: str,
) -> Dict[str, Any]:

    tokens = user.get("gmail_tokens") or {}
    service = _build_service_from_tokens(tokens)

    return service.users().messages().get(
        userId="me",
        id=msg_id,
        format="full",
    ).execute()
