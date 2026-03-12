from __future__ import annotations

from dataclasses import dataclass
from typing import List

from backend.ai.email_context_builder import EmailContext


@dataclass
class ReplyAnalysis:
    needs_reply: bool
    confidence: float
    reasons: List[str]


QUESTION_KEYWORDS = [
    "puedes",
    "podrías",
    "podrias",
    "puedes confirmar",
    "confirmar",
    "confirm",
    "let me know",
    "could you",
    "can you",
    "please confirm",
]

ACTION_REQUEST_KEYWORDS = [
    "revisar",
    "review",
    "aprobar",
    "approve",
    "firmar",
    "sign",
    "enviar",
    "send",
    "confirmar",
    "schedule",
    "programar",
]

REPLY_PATTERNS = [
    "re:",
    "fw:",
]


def detect_question(context: EmailContext) -> bool:
    text = f"{context.subject} {context.body}".lower()

    if "?" in text:
        return True

    for keyword in QUESTION_KEYWORDS:
        if keyword in text:
            return True

    return False


def detect_action_request(context: EmailContext) -> bool:
    text = f"{context.subject} {context.body}".lower()

    for keyword in ACTION_REQUEST_KEYWORDS:
        if keyword in text:
            return True

    return False


def detect_thread_reply(context: EmailContext) -> bool:
    subject = context.subject.lower()

    for pattern in REPLY_PATTERNS:
        if subject.startswith(pattern):
            return True

    return False


def analyze_reply_need(context: EmailContext) -> ReplyAnalysis:

    score = 0
    reasons: List[str] = []

    if detect_question(context):
        score += 40
        reasons.append("question_detected")

    if detect_action_request(context):
        score += 35
        reasons.append("action_requested")

    if detect_thread_reply(context):
        score += 20
        reasons.append("thread_reply")

    if context.has_attachments:
        score += 5
        reasons.append("attachment_present")

    confidence = min(score / 100, 1.0)

    needs_reply = score >= 40

    return ReplyAnalysis(
        needs_reply=needs_reply,
        confidence=confidence,
        reasons=reasons,
    )