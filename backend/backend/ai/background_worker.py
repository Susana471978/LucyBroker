from __future__ import annotations

from typing import Dict, Any

from backend.ai.email_context_builder import build_email_context
from backend.ai.priority_engine import calculate_priority
from backend.ai.reply_detector import analyze_reply_need
from backend.ai.task_extractor import extract_task
from backend.ai.financial_detector import analyze_financial
from backend.ai.action_planner import build_action_plan


def analyze_email_event(email_event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main Lucy analysis pipeline.
    Receives an EmailEvent and returns Lucy analysis results.
    """

    # 1️⃣ construir contexto
    context = build_email_context(email_event)

    # 2️⃣ prioridad
    priority = calculate_priority(context)

    # 3️⃣ detectar respuesta
    reply = analyze_reply_need(context)

    # 4️⃣ detectar tareas
    task = extract_task(context)

    # 5️⃣ detectar correo financiero
    financial = analyze_financial(context)

    # 6️⃣ plan de acciones
    action_plan = build_action_plan(
        priority=priority,
        reply=reply,
        task=task,
        financial=financial,
    )

    result = {
        "email_id": context.email_id,

        "priority": {
            "score": priority.priority_score,
            "label": priority.priority_label,
            "rules": priority.rule_hits,
        },

        "reply_analysis": {
            "needs_reply": reply.needs_reply,
            "confidence": reply.confidence,
            "reasons": reply.reasons,
        },

        "task_analysis": {
            "task_detected": task.task_detected,
            "task_description": task.task_description,
            "confidence": task.confidence,
        },

        "financial_analysis": {
            "financial_email": financial.financial_email,
            "confidence": financial.confidence,
            "triggers": financial.triggers,
        },

        "action_plan": {
            "recommended_actions": action_plan.recommended_actions,
            "risk_level": action_plan.risk_level,
            "requires_human_confirmation": action_plan.requires_human_confirmation,
            "rationale": action_plan.rationale,
            "audit_tags": action_plan.audit_tags,
        },
    }

    return result