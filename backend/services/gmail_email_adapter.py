from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import Resource

from backend.models import EmailAttachment, EmailEvent, EnrichedEmail
from backend.services.gmail_client import get_gmail_service
from backend.services.rules_engine import calculate_priority


def _header(headers: List[Dict[str, str]], name: str) -> Optional[str]:
    name_lower = name.lower()
    for h in headers:
        if h.get("name", "").lower() == name_lower:
            return h.get("value")
    return None


def _decode_body(payload: Dict[str, Any]) -> str:
    """
    Intenta extraer texto del payload de Gmail (text/plain preferido).
    """
    def decode(data: str) -> str:
        return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="replace")

    # Caso directo
    body = payload.get("body", {}) or {}
    data = body.get("data")
    if data:
        return decode(data)

    # Caso multiparte
    parts = payload.get("parts") or []
    # 1) Prefer text/plain
    for p in parts:
        if p.get("mimeType") == "text/plain":
            pdata = (p.get("body") or {}).get("data")
            if pdata:
                return decode(pdata)
    # 2) Si no hay, intenta text/html
    for p in parts:
        if p.get("mimeType") == "text/html":
            pdata = (p.get("body") or {}).get("data")
            if pdata:
                return decode(pdata)

    # 3) fallback: recursivo por si hay subpartes
    for p in parts:
        sub = p.get("parts")
        if sub:
            txt = _decode_body({"parts": sub})
            if txt:
                return txt

    return ""


def _extract_attachments(payload: Dict[str, Any]) -> List[EmailAttachment]:
    attachments: List[EmailAttachment] = []

    def walk(part: Dict[str, Any]):
        filename = part.get("filename")
        body = part.get("body") or {}
        attachment_id = body.get("attachmentId")
        mime = part.get("mimeType")

        if filename and attachment_id:
            attachments.append(
                EmailAttachment(
                    id=attachment_id,
                    name=filename,
                    size=int(body.get("size") or 0),
                    mime_type=mime or "application/octet-stream",
                )
            )

        for child in (part.get("parts") or []):
            walk(child)

    walk(payload)
    return attachments


def _gmail_message_to_event(msg: Dict[str, Any]) -> EmailEvent:
    payload = msg.get("payload") or {}
    headers = payload.get("headers") or []

    subject = _header(headers, "Subject") or "(Sin asunto)"
    from_raw = _header(headers, "From") or ""
    date_raw = _header(headers, "Date")

    # Parse básico de “From”
    from_name = from_raw
    from_email = ""
    if "<" in from_raw and ">" in from_raw:
        from_name = from_raw.split("<")[0].strip().strip('"')
        from_email = from_raw.split("<")[1].split(">")[0].strip()
    else:
        from_email = from_raw.strip()

    # Fecha: Gmail da internalDate (ms) más fiable
    internal_ms = msg.get("internalDate")
    if internal_ms:
        dt = datetime.fromtimestamp(int(internal_ms) / 1000, tz=timezone.utc)
        iso_date = dt.isoformat()
    else:
        iso_date = datetime.now(timezone.utc).isoformat()

    body_text = _decode_body(payload)
    snippet = msg.get("snippet") or (body_text[:160] if body_text else "")

    attachments = _extract_attachments(payload)
    has_attachments = len(attachments) > 0

    # Labels Gmail (INBOX, IMPORTANT, etc.)
    labels = msg.get("labelIds") or []

    return EmailEvent(
        id=msg.get("id"),
        thread_id=msg.get("threadId"),
        from_name=from_name or "Desconocido",
        from_email=from_email or "",
        subject=subject,
        date=iso_date,
        snippet=snippet,
        body=body_text,
        labels=labels,
        has_attachments=has_attachments,
        attachments=attachments if has_attachments else None,
    )


def fetch_gmail_events(max_results: int = 25, label_ids: Optional[List[str]] = None) -> List[EmailEvent]:
    service: Resource = get_gmail_service()

    q_kwargs: Dict[str, Any] = {"userId": "me", "maxResults": max_results}
    if label_ids:
        q_kwargs["labelIds"] = label_ids

    listing = service.users().messages().list(**q_kwargs).execute()
    messages = listing.get("messages", [])

    events: List[EmailEvent] = []
    for m in messages:
        full = service.users().messages().get(userId="me", id=m["id"], format="full").execute()
        events.append(_gmail_message_to_event(full))

    return events


def enrich_events(events: List[EmailEvent]) -> List[EnrichedEmail]:
    enriched: List[EnrichedEmail] = []
    for e in events:
        priority = calculate_priority(
            sender=e.from_email,
            subject=e.subject,
            labels=e.labels or [],
            snippet=e.snippet or "",
        )
        enriched.append(
            EnrichedEmail(
                **e.model_dump(),
                priority=priority,
            )
        )
    return enriched


def fetch_enriched_gmail(max_results: int = 25, label: Optional[str] = None) -> List[EnrichedEmail]:
    label_ids = [label] if label else None
    events = fetch_gmail_events(max_results=max_results, label_ids=label_ids)
    return enrich_events(events)
