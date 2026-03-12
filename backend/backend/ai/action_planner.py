from __future__ import annotations

from dataclasses import dataclass
from typing import List

from backend.ai.priority_engine import PriorityResult
from backend.ai.reply_detector import ReplyAnalysis
from backend.ai.task_extractor import TaskExtraction
from backend.ai.financial_detector import FinancialAnalysis


@dataclass
class ActionPlan:
    recommended_actions: List[str]
    risk_level: str
    requires_human_confirmation: bool
    rationale: str
    audit_tags: List[str]


def build_action_plan(
    priority: PriorityResult,
    reply: ReplyAnalysis,
    task: TaskExtraction,
    financial: FinancialAnalysis,
) -> ActionPlan:

    actions: List[str] = []
    tags: List[str] = []
    rationale_parts: List[str] = []

    # prioridad alta → sugerir resumen
    if priority.priority_label == "PRIORITARIO":
        actions.append("summarize_email")
        tags.append("high_priority")
        rationale_parts.append("correo prioritario detectado")

    # si requiere respuesta
    if reply.needs_reply:
        actions.append("suggest_reply")
        tags.append("needs_reply")
        rationale_parts.append("correo probablemente requiere respuesta")

    # si hay tarea
    if task.task_detected:
        actions.append("create_task")
        tags.append("task_detected")
        rationale_parts.append("correo contiene posible tarea")

    # si es financiero
    if financial.financial_email:
        actions.append("financial_review")
        tags.append("financial_email")
        rationale_parts.append("correo financiero detectado")

    # evitar duplicados
    actions = list(dict.fromkeys(actions))

    # calcular nivel de riesgo
    if financial.financial_email:
        risk_level = "medium"
    else:
        risk_level = "low"

    requires_human_confirmation = True

    rationale = ", ".join(rationale_parts) if rationale_parts else "sin acciones relevantes"

    return ActionPlan(
        recommended_actions=actions,
        risk_level=risk_level,
        requires_human_confirmation=requires_human_confirmation,
        rationale=rationale,
        audit_tags=tags,
    )