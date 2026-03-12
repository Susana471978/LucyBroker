from __future__ import annotations

from dataclasses import dataclass
from typing import List

import re

from backend.ai.email_context_builder import EmailContext


@dataclass
class FinancialAnalysis:
    financial_email: bool
    confidence: float
    triggers: List[str]


FINANCIAL_KEYWORDS = [
    "factura",
    "invoice",
    "payment",
    "pago",
    "transferencia",
    "contrato",
    "contract",
    "presupuesto",
    "budget",
    "subscription",
    "suscripción",
]


FINANCIAL_SENDER_PATTERNS = [
    "billing",
    "invoice",
    "payments",
    "stripe",
    "paypal",
]


def detect_keywords(text: str) -> List[str]:

    hits = []

    for keyword in FINANCIAL_KEYWORDS:
        if keyword in text:
            hits.append(keyword)

    return hits


def detect_money(text: str) -> bool:

    patterns = [
        r"\€\s?\d+",
        r"\d+\s?\€",
        r"\$\s?\d+",
        r"\d+\s?\$",
        r"\d+,\d+\s?\€",
    ]

    for pattern in patterns:
        if re.search(pattern, text):
            return True

    return False


def detect_financial_sender(sender_email: str) -> bool:

    sender = sender_email.lower()

    for pattern in FINANCIAL_SENDER_PATTERNS:
        if pattern in sender:
            return True

    return False


def analyze_financial(context: EmailContext) -> FinancialAnalysis:

    text = f"{context.subject} {context.body}".lower()

    triggers: List[str] = []

    keyword_hits = detect_keywords(text)

    if keyword_hits:
        triggers.extend(keyword_hits)

    money_detected = detect_money(text)

    if money_detected:
        triggers.append("amount_detected")

    sender_flag = detect_financial_sender(context.sender_email)

    if sender_flag:
        triggers.append("financial_sender")

    score = 0

    if keyword_hits:
        score += 40

    if money_detected:
        score += 25

    if sender_flag:
        score += 20

    if context.has_attachments:
        score += 10

    confidence = min(score / 100, 1.0)

    financial_email = score >= 40

    return FinancialAnalysis(
        financial_email=financial_email,
        confidence=confidence,
        triggers=triggers,
    )