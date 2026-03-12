from __future__ import annotations

from typing import Dict, Any, List
from dataclasses import dataclass

from backend.ai.email_context_builder import EmailContext


@dataclass
class PriorityResult:
    priority_score: int
    priority_label: str
    explain: str
    rule_hits: List[str]


# contactos típicos que suelen ser automáticos
AUTOMATED_SENDERS = [
    "no-reply",
    "noreply",
    "newsletter",
    "notifications",
    "billing",
]


NEWSLETTER_KEYWORDS = [
    "newsletter",
    "unsubscribe",
    "weekly digest",
    "digest",
    "marketing",
]


FINANCIAL_KEYWORDS = [
    "factura",
    "invoice",
    "payment",
    "pago",
    "subscription",
    "suscripción",
]


URGENT_KEYWORDS = [
    "urgente",
    "urgent",
    "asap",
    "lo antes posible",
]


def detect_newsletter(context: EmailContext) -> bool:

    subject = context.subject.lower()
    body = context.body.lower()

    for word in NEWSLETTER_KEYWORDS:
        if word in subject or word in body:
            return True

    sender = context.sender_email.lower()

    for pattern in AUTOMATED_SENDERS:
        if pattern in sender:
            return True

    return False


def detect_financial(context: EmailContext) -> bool:

    subject = context.subject.lower()
    body = context.body.lower()

    for word in FINANCIAL_KEYWORDS:
        if word in subject or word in body:
            return True

    if context.amount_detected:
        return True

    return False


def detect_urgent(context: EmailContext) -> bool:

    subject = context.subject.lower()
    body = context.body.lower()

    for word in URGENT_KEYWORDS:
        if word in subject or word in body:
            return True

    return False


def calculate_priority(context: EmailContext) -> PriorityResult:

    score = 50
    rule_hits: List[str] = []

    # adjuntos suelen indicar acción
    if context.has_attachments:
        score += 5
        rule_hits.append("attachment")

    # preguntas suelen requerir respuesta
    if context.question_detected:
        score += 10
        rule_hits.append("question_detected")

    # correos financieros
    if detect_financial(context):
        score += 15
        rule_hits.append("financial_email")

    # urgencia explícita
    if detect_urgent(context):
        score += 20
        rule_hits.append("urgent_keyword")

    # newsletters bajan prioridad
    if detect_newsletter(context):
        score -= 30
        rule_hits.append("newsletter_detected")

    # limitar score
    score = max(0, min(score, 100))

    if score >= 70:
        label = "PRIORITARIO"
    elif score >= 45:
        label = "SEGUIMIENTO"
    else:
        label = "INFORMATIVO"

    explain = f"Score {score} based on rules: {', '.join(rule_hits)}"

    return PriorityResult(
        priority_score=score,
        priority_label=label,
        explain=explain,
        rule_hits=rule_hits,
    )