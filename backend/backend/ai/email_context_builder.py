from __future__ import annotations

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import re
from datetime import datetime


@dataclass
class EmailContext:
    """
    Normalized email context used by Lucy AI modules.
    """

    email_id: str
    thread_id: str
    subject: str
    body: str
    sender_email: str
    sender_name: str
    date: str

    attachments: List[Dict[str, Any]]

    has_attachments: bool
    word_count: int
    question_detected: bool
    amount_detected: bool
    sender_domain: str


def extract_domain(email: str) -> str:
    if "@" not in email:
        return ""
    return email.split("@")[1].lower()


def detect_question(text: str) -> bool:
    if not text:
        return False

    if "?" in text:
        return True

    question_patterns = [
        "puedes",
        "podrías",
        "podrias",
        "could you",
        "can you",
        "please confirm",
        "let me know",
        "confirmar",
        "confirm",
    ]

    text_lower = text.lower()

    for pattern in question_patterns:
        if pattern in text_lower:
            return True

    return False


def detect_money(text: str) -> bool:
    if not text:
        return False

    patterns = [
        r"\€\s?\d+",
        r"\d+\s?\€",
        r"\$\s?\d+",
        r"\d+\s?\$",
        r"\d+,\d+\s?\€",
    ]

    for p in patterns:
        if re.search(p, text):
            return True

    return False


def count_words(text: str) -> int:
    if not text:
        return 0

    return len(text.split())


def build_email_context(email_event: Dict[str, Any]) -> EmailContext:
    """
    Build Lucy AI context from EmailEvent object.
    """

    subject = email_event.get("subject", "") or ""
    body = email_event.get("body", "") or ""
    sender_email = email_event.get("from_email", "") or ""
    sender_name = email_event.get("from_name", "") or ""

    attachments = email_event.get("attachments", []) or []

    text_blob = f"{subject} {body}"

    context = EmailContext(
        email_id=email_event.get("id", ""),
        thread_id=email_event.get("thread_id", ""),
        subject=subject,
        body=body,
        sender_email=sender_email,
        sender_name=sender_name,
        date=email_event.get("date", ""),

        attachments=attachments,

        has_attachments=len(attachments) > 0,
        word_count=count_words(text_blob),
        question_detected=detect_question(text_blob),
        amount_detected=detect_money(text_blob),
        sender_domain=extract_domain(sender_email),
    )

    return context