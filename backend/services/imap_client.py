from __future__ import annotations

import hashlib
import imaplib
import email
import email.header
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from email.utils import parsedate_to_datetime

from backend.config import settings
from backend.models import EmailEvent, EmailAttachment
from backend.utils.logger import get_logger

logger = get_logger("imap_client")


def _decode_header(value: str) -> str:
    parts = email.header.decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return " ".join(decoded)


def _get_body(msg) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                    break
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode(msg.get_content_charset() or "utf-8", errors="replace")
    return body.strip()


def _get_attachments(msg) -> List[EmailAttachment]:
    attachments = []
    for part in msg.walk():
        cd = str(part.get("Content-Disposition", ""))
        if "attachment" in cd:
            filename = part.get_filename()
            if filename:
                filename = _decode_header(filename)
                attachments.append(EmailAttachment(
                    id=str(uuid.uuid4()),
                    name=filename,
                    size=len(part.get_payload(decode=True) or b""),
                    mime_type=part.get_content_type(),
                ))
    return attachments


def _id_estable(msg, from_email: str, subject: str, date: str) -> str:
    """Id reproducible entre sincronizaciones.

    Usa el Message-ID de la cabecera, que es unico y estable. Si el
    mensaje no lo trae (raro pero legal), cae a una huella de
    remitente + asunto + fecha.
    """
    msg_id = (msg.get("Message-ID") or "").strip()
    semilla = msg_id if msg_id else f"{from_email}|{subject}|{date}"
    return "imap-" + hashlib.sha1(semilla.encode("utf-8", "replace")).hexdigest()[:16]


def fetch_recent_emails(limit: int = 20) -> List[EmailEvent]:
    if not settings.imap_user or not settings.imap_password:
        logger.warning("IMAP not configured")
        return []

    emails = []
    try:
        mail = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port)
        mail.login(settings.imap_user, settings.imap_password)
        mail.select("INBOX")

        _, data = mail.search(None, "ALL")
        ids = data[0].split()
        recent_ids = ids[-limit:] if len(ids) > limit else ids
        recent_ids = list(reversed(recent_ids))

        for uid in recent_ids:
            try:
                _, msg_data = mail.fetch(uid, "(RFC822)")
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                subject = _decode_header(msg.get("Subject", "(Sin asunto)"))
                from_raw = msg.get("From", "")
                from_name, from_email = email.utils.parseaddr(from_raw)
                if not from_name:
                    from_name = from_email

                date_str = msg.get("Date", "")
                try:
                    date = parsedate_to_datetime(date_str).astimezone(timezone.utc).isoformat()
                except Exception:
                    date = datetime.now(timezone.utc).isoformat()

                body = _get_body(msg)
                snippet = body[:200].replace("\n", " ") if body else ""
                attachments = _get_attachments(msg)

                emails.append(EmailEvent(
                    id=_id_estable(msg, from_email, subject, date),
                    canal="email",
                    thread_id=msg.get("Message-ID", str(uuid.uuid4())),
                    from_name=from_name or from_email,
                    from_email=from_email,
                    subject=subject,
                    date=date,
                    snippet=snippet,
                    body=body,
                    labels=[],
                    has_attachments=len(attachments) > 0,
                    attachments=attachments,
                ))
            except Exception as e:
                logger.error("Error parsing email %s: %s", uid, e)

        mail.logout()
        logger.info("Fetched %d emails from IMAP", len(emails))

    except Exception as e:
        logger.error("IMAP connection error: %s", e)

    return emails
