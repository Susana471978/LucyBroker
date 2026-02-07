import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


BASE_DIR = Path(__file__).resolve().parent.parent
TOKEN_FILE = BASE_DIR / "credentials" / "gmail_token.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]


def get_gmail_service():

    if not TOKEN_FILE.exists():
        raise Exception("Gmail not connected")

    with open(TOKEN_FILE) as f:
        data = json.load(f)

    creds = Credentials.from_authorized_user_info(data, SCOPES)

    return build("gmail", "v1", credentials=creds)


def fetch_messages(max_results=20):

    service = get_gmail_service()

    result = service.users().messages().list(
        userId="me",
        maxResults=max_results
    ).execute()

    messages = result.get("messages", [])

    return messages


def fetch_message_detail(msg_id):

    service = get_gmail_service()

    return service.users().messages().get(
        userId="me",
        id=msg_id,
        format="full"
    ).execute()
