from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from backend.ai.email_context_builder import EmailContext


@dataclass
class TaskExtraction:
    task_detected: bool
    task_description: Optional[str]
    confidence: float
    triggers: List[str]


ACTION_VERBS = [
    "revisar",
    "review",
    "aprobar",
    "approve",
    "firmar",
    "sign",
    "enviar",
    "send",
    "confirmar",
    "confirm",
    "programar",
    "schedule",
    "coordinar",
    "verify",
    "verificar",
]


TASK_PATTERNS = [
    "puedes",
    "podrías",
    "podrias",
    "please",
    "could you",
    "can you",
]


def detect_action_keywords(text: str) -> List[str]:

    found = []

    for verb in ACTION_VERBS:
        if verb in text:
            found.append(verb)

    return found


def detect_request_patterns(text: str) -> List[str]:

    found = []

    for pattern in TASK_PATTERNS:
        if pattern in text:
            found.append(pattern)

    return found


def extract_task(context: EmailContext) -> TaskExtraction:

    text = f"{context.subject} {context.body}".lower()

    triggers: List[str] = []

    action_hits = detect_action_keywords(text)
    request_hits = detect_request_patterns(text)

    triggers.extend(action_hits)
    triggers.extend(request_hits)

    score = 0

    if action_hits:
        score += 40

    if request_hits:
        score += 25

    if context.has_attachments:
        score += 10

    if context.question_detected:
        score += 10

    confidence = min(score / 100, 1.0)

    task_detected = score >= 40

    task_description: Optional[str] = None

    if task_detected:

        if action_hits:
            main_action = action_hits[0]
            task_description = f"{main_action} información solicitada"
        else:
            task_description = "acción solicitada en el correo"

    return TaskExtraction(
        task_detected=task_detected,
        task_description=task_description,
        confidence=confidence,
        triggers=triggers,
    )