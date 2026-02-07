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
        raise Exception("No Gmail token found. Please connect Gmail first.")

    with open(TOKEN_FILE, "r") as f:
        token_data = json.load(f)

    creds = Credentials.from_authorized_user_info(
        token_data,
        SCOPES
    )

    service = build("gmail", "v1", credentials=creds)

    return service
