# backend/api/gmail.py

import os
import base64
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build as build_service

from datetime import datetime, timezone

from backend.models import EmailEvent
from backend.services.rules_engine import calculate_priority
from backend.services.contact_memory import record_interaction, get_contact_memory
from backend.utils.response import build_response


BASE_DIR = Path(__file__).resolve().parent.parent
CREDENTIALS_FILE = BASE_DIR / "credentials" / "google_oauth.json"

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")


# =========================================================
# FLOW
# =========================================================

def _get_flow(redirect_uri: str, state: str | None = None) -> Flow:
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
        state=state,
    )


# =========================================================
# BODY EXTRACTION + CLEANING
# =========================================================

_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_TRACKING_GARBAGE_RE = re.compile(
    r"(utm_[a-zA-Z0-9_]+=[^&\s]+|source=email|digest\.reader|email-[0-9a-fA-F-]{6,})",
    re.IGNORECASE,
)
_LONG_DASH_RE = re.compile(r"-{10,}")


def _decode_gmail_body(data: str) -> str:
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _iter_parts(payload: Dict[str, Any]):
    if not payload:
        return
    parts = payload.get("parts") or []
    for p in parts:
        yield p
        if (p.get("mimeType") or "").startswith("multipart/"):
            yield from _iter_parts(p)


def _find_part_data(payload: Dict[str, Any], wanted_mime: str) -> Optional[str]:
    if not payload:
        return None

    mime = payload.get("mimeType", "")
    body_data = (payload.get("body") or {}).get("data")

    if body_data and mime == wanted_mime:
        return body_data

    for part in _iter_parts(payload):
        part_mime = part.get("mimeType", "")
        part_body_data = (part.get("body") or {}).get("data")
        if part_body_data and part_mime == wanted_mime:
            return part_body_data

    return None


def _extract_best_body(payload: Dict[str, Any]) -> Tuple[str, str]:
    if not payload:
        return ("", "")

    html_data = _find_part_data(payload, "text/html")
    text_data = _find_part_data(payload, "text/plain")

    html = _decode_gmail_body(html_data) if html_data else ""
    text = _decode_gmail_body(text_data) if text_data else ""

    if not html and not text:
        root_data = (payload.get("body") or {}).get("data")
        if root_data:
            decoded = _decode_gmail_body(root_data)
            if "<html" in decoded.lower():
                html = decoded
            else:
                text = decoded

    return (html, text)


def _strip_html_to_text(html: str) -> str:

    if not html:
        return ""

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        for a in soup.find_all("a"):
            txt = (a.get_text(" ", strip=True) or "").strip()
            a.replace_with(txt if txt else "")

        text = soup.get_text(separator="\n")
        return text.strip()

    except Exception:
        cleaned = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html)
        cleaned = re.sub(r"(?is)<br\s*/?>", "\n", cleaned)
        cleaned = re.sub(r"(?is)</p\s*>", "\n", cleaned)
        cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
        cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()


def _clean_text_for_ai(text: str) -> str:

    if not text:
        return ""

    text = _URL_RE.sub("", text)
    text = _TRACKING_GARBAGE_RE.sub("", text)
    text = _LONG_DASH_RE.sub("", text)

    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]

    return "\n".join(lines).strip()


def _text_to_safe_html(text: str) -> str:

    if not text:
        return ""

    safe = (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )

    safe = safe.replace("\n", "<br/>")

    return f"<div>{safe}</div>"


# =========================================================
# FETCH + SAVE
# =========================================================

async def fetch_enriched_messages(
    user: Dict[str, Any],
    db,
    max_results: int = 20,
    label: str = "inbox",
) -> List[Dict[str, Any]]:

    if not user.get("gmail_connected"):
        return []

    tokens = user.get("gmail_tokens") or {}

    if not tokens.get("token"):
        return []

    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri"),
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=tokens.get("scopes") or SCOPES,
    )

    service = build_service("gmail", "v1", credentials=creds)

    results = service.users().messages().list(
        userId="me",
        labelIds=["INBOX"],
        maxResults=max_results,
    ).execute()

    message_ids = results.get("messages", []) or []

    enriched: List[Dict[str, Any]] = []

    for msg_stub in message_ids:

        msg_id = msg_stub["id"]

        detail = service.users().messages().get(
            userId="me",
            id=msg_id,
            format="full",
        ).execute()

        headers = {
            h["name"].lower(): h["value"]
            for h in (detail.get("payload", {}) or {}).get("headers", [])
        }

        payload = detail.get("payload", {}) or {}

        html_raw, text_raw = _extract_best_body(payload)

        text_from_html = _strip_html_to_text(html_raw) if html_raw else ""
        ai_base_text = text_from_html or text_raw or ""

        text_for_ai = _clean_text_for_ai(ai_base_text)

        body_for_ui = html_raw if html_raw else _text_to_safe_html(text_raw)

        email_event = EmailEvent(
            id=detail["id"],
            thread_id=detail.get("threadId", ""),
            from_name=headers.get("from", ""),
            from_email=headers.get("from", ""),
            subject=headers.get("subject", "(Sin asunto)"),
            date=datetime.now(timezone.utc).isoformat(),
            snippet=detail.get("snippet", ""),
            body=body_for_ui,
            labels=detail.get("labelIds", []) or [],
            has_attachments=False,
            attachments=[],
        )

        from_raw = headers.get("from", "")

        email_match = re.search(r'[\w\.\+\-]+@[\w\.\-]+', from_raw)

        contact_email = email_match.group(0).lower() if email_match else from_raw.lower()

        contact_memory = await get_contact_memory(
            db=db,
            user_id=user["id"],
            contact_email=contact_email,
        )

        priority = calculate_priority(email_event, contact_memory)

        email_dict = email_event.model_dump()

        enriched.append(
            {
                "email": email_dict,
                "priority": priority.model_dump(),
            }
        )

        try:

            name_match = re.match(r'^"?([^"<]+)"?\s*<', from_raw)

            contact_name = name_match.group(1).strip() if name_match else contact_email

            await record_interaction(
                db=db,
                user_id=user["id"],
                contact_email=contact_email,
                contact_name=contact_name,
                subject=email_event.subject,
                action="read",
            )

        except Exception:
            pass

    return enriched