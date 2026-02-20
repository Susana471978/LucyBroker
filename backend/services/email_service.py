from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from backend.models import EmailAttachment, EmailEvent, EnrichedEmail
from backend.services.rules_engine import calculate_priority
from backend.utils.crypto import is_encrypted_token_valid




# =====================================================
# MOCK DATA (fallback / demo)
# =====================================================

MOCK_EMAILS: List[EmailEvent] = [
    EmailEvent(
        id="email-001",
        thread_id="thread-001",
        from_name="Carlos Mendoza",
        from_email="carlos.mendoza@acme.com",
        subject="URGENTE: Revisión contrato Q1",
        date="2026-01-15T09:30:00Z",
        snippet="Necesitamos tu firma antes de las 5pm...",
        body="Contrato pendiente de firma.",
        labels=["importante"],
        has_attachments=True,
    ),
]


# =====================================================
# HELPERS
# =====================================================

def _decode_body(payload: Dict[str, Any]) -> str:
    """
    Decode Gmail message body (recursive parts)
    """

    if "body" in payload and payload["body"].get("data"):
        try:
            data = payload["body"]["data"]
            return base64.urlsafe_b64decode(data).decode(
                "utf-8", errors="ignore"
            )
        except Exception:
            return ""

    if "parts" in payload:
        for part in payload["parts"]:
            text = _decode_body(part)
            if text:
                return text

    return ""


def _get_header(headers: List[Dict[str, str]], name: str) -> str:
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


# =====================================================
# GMAIL FETCH
# =====================================================

def fetch_gmail_emails(limit: int = 20) -> List[EmailEvent]:
    """
    Load emails from Gmail API
    """

    service = get_gmail_service()

    results = service.users().messages().list(
        userId="me",
        maxResults=limit
    ).execute()

    messages = results.get("messages", [])

    emails: List[EmailEvent] = []

    for msg in messages:

        full = service.users().messages().get(
            userId="me",
            id=msg["id"],
            format="full"
        ).execute()

        payload = full.get("payload", {})
        headers = payload.get("headers", [])

        subject = _get_header(headers, "Subject")
        sender = _get_header(headers, "From")
        date = _get_header(headers, "Date")

        body = _decode_body(payload)

        has_attachments = False

        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("filename"):
                    has_attachments = True
                    break

        email = EmailEvent(
            id=msg["id"],
            thread_id=full.get("threadId"),
            from_name=sender,
            from_email=sender,
            subject=subject,
            date=date,
            snippet=full.get("snippet"),
            body=body,
            labels=full.get("labelIds", []),
            has_attachments=has_attachments,
        )

        emails.append(email)

    return emails


# =====================================================
# CORE API
# =====================================================

def get_enriched_emails() -> List[EnrichedEmail]:
    """
    Returns prioritized emails (Gmail or fallback)
    """

    try:
        emails = fetch_gmail_emails()
    except Exception as exc:
        print("⚠️ Gmail error → Using MOCK:", exc)
        emails = MOCK_EMAILS

    enriched: List[EnrichedEmail] = []

    for email in emails:
        priority = calculate_priority(email)

        enriched.append(
            EnrichedEmail(
                email=email,
                priority=priority
            )
        )

    return sorted(
        enriched,
        key=lambda x: x.priority.priority_score,
        reverse=True
    )


def get_email_by_id(email_id: str) -> Optional[EmailEvent]:

    try:
        emails = fetch_gmail_emails(limit=50)
    except Exception:
        emails = MOCK_EMAILS

    for email in emails:
        if email.id == email_id:
            return email

    return None


def get_email_stats() -> Dict[str, int]:

    emails = get_enriched_emails()

    return {
        "total": len(emails),
        "prioritarios": len([
            e for e in emails
            if e.priority.priority_label == "PRIORITARIO"
        ]),
        "seguimiento": len([
            e for e in emails
            if e.priority.priority_label == "SEGUIMIENTO"
        ]),
        "info": len([
            e for e in emails
            if e.priority.priority_label == "INFO"
        ]),
        "with_attachments": len([
            e for e in emails
            if e.email.has_attachments
        ]),
    }


# =====================================================
# TOKEN STATUS (OPTIONAL / FUTURE DB STORAGE)
# =====================================================

async def get_gmail_token_status(db) -> Dict[str, Any]:

    token_doc = await db.gmail_tokens.find_one({}, {"_id": 0})

    if not token_doc:
        return {"status": "not_configured"}

    token_encrypted = token_doc.get("token")
    expires_at = token_doc.get("expires_at")

    if not token_encrypted:
        return {"status": "missing_token"}

    if not is_encrypted_token_valid(token_encrypted):
        return {"status": "invalid_encryption"}

    if expires_at:
        try:
            expiry = datetime.fromisoformat(expires_at)

            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)

            if expiry <= datetime.now(timezone.utc):
                return {
                    "status": "expired",
                    "expires_at": expiry.isoformat()
                }

            return {
                "status": "ok",
                "expires_at": expiry.isoformat()
            }

        except ValueError:
            return {"status": "invalid_expiry"}

    return {"status": "ok", "expires_at": None}
