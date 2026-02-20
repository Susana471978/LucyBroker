from __future__ import annotations

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import base64

from backend.models import EmailEvent, EmailAttachment
from backend.services.gmail_client import (
    fetch_messages,
    fetch_message_detail,
)


# ======================================================
# HELPERS
# ======================================================

def _decode_body(data: Optional[str]) -> str:
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _parse_headers(headers: List[Dict[str, str]]) -> Dict[str, str]:
    return {h["name"].lower(): h["value"] for h in headers}


def _extract_attachments(payload: Dict[str, Any]) -> List[EmailAttachment]:
    attachments: List[EmailAttachment] = []

    parts = payload.get("parts", []) or []
    for part in parts:
        filename = part.get("filename")
        body = part.get("body", {})
        attachment_id = body.get("attachmentId")

        if filename and attachment_id:
            attachments.append(
                EmailAttachment(
                    id=attachment_id,
                    name=filename,
                    size=body.get("size", 0),
                    mime_type=part.get("mimeType", "application/octet-stream"),
                )
            )

    return attachments


def _extract_body(payload: Dict[str, Any]) -> str:
    if payload.get("body", {}).get("data"):
        return _decode_body(payload["body"]["data"])

    for part in payload.get("parts", []) or []:
        if part.get("mimeType") == "text/plain":
            return _decode_body(part.get("body", {}).get("data"))

    return ""


# ======================================================
# DOMAIN READER
# ======================================================

def read_gmail_events(
    user: Dict[str, Any],
    max_results: int = 25,
    label_ids: Optional[List[str]] = None,
) -> List[EmailEvent]:
    """
    Lee correos Gmail reales y los convierte a EmailEvent (dominio).
    """

    try:
        messages = fetch_messages(
            user=user,
            max_results=max_results,
            label_ids=label_ids,
        )
    except Exception as e:
        print(f"Gmail read error: {str(e)}")
        return []

    events: List[EmailEvent] = []

    for msg in messages:
        msg_id = msg.get("id")
        if not msg_id:
            continue

        try:
            detail = fetch_message_detail(
                user=user,
                msg_id=msg_id,
            )
        except Exception as e:
            print(f"Gmail detail error: {str(e)}")
            continue

        payload = detail.get("payload", {})
        headers = _parse_headers(payload.get("headers", []))

        subject = headers.get("subject", "(Sin asunto)")
        from_raw = headers.get("from", "")

        try:
            date = datetime.fromtimestamp(
                int(detail.get("internalDate", 0)) / 1000,
                tz=timezone.utc,
            ).isoformat()
        except Exception:
            date = datetime.now(timezone.utc).isoformat()

        body = _extract_body(payload)
        snippet = detail.get("snippet", "")
        attachments = _extract_attachments(payload)

        events.append(
            EmailEvent(
                id=detail.get("id"),
                thread_id=detail.get("threadId"),
                from_name=from_raw,
                from_email=from_raw,
                subject=subject,
                date=date,
                snippet=snippet,
                body=body,
                labels=detail.get("labelIds") or [],
                has_attachments=len(attachments) > 0,
                attachments=attachments,  # 🔥 NUNCA None
            )
        )

    return events
