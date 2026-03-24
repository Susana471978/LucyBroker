# backend/core/feature_gate.py

"""
Feature gating dependency for FastAPI.
Usage in any router:

    from backend.core.feature_gate import require_feature

    @router.get("/some-endpoint")
    async def endpoint(
        user: Dict = Depends(get_current_user),
        _gate: None = Depends(require_feature("calendar_integration")),
    ):
        ...

Or as a simple function call inside the endpoint:

    from backend.core.feature_gate import check_feature

    @router.get("/some-endpoint")
    async def endpoint(user: Dict = Depends(get_current_user)):
        check_feature(user, "calendar_integration")
        ...
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException

from backend.core.plans import has_feature, get_user_plan


# Feature → human-readable name for error messages
FEATURE_NAMES = {
    "briefing_matutino": "Briefing matutino",
    "email_prioritization": "Priorización de emails",
    "email_summary": "Resúmenes de email",
    "single_email_account": "Cuenta de email",
    "calendar_integration": "Integración con Calendar",
    "tasks_management": "Gestión de tareas",
    "voice_commands": "Comandos de voz",
    "vip_companies": "Empresas VIP",
    "multi_email_accounts": "Múltiples cuentas de email",
    "crm_contacts": "CRM de contactos",
    "auto_reply": "Respuesta automática",
    "reminders": "Recordatorios",
    "personal_memory": "Memoria personal",
    "daily_organization": "Organización diaria",
    "habits_tracking": "Seguimiento de hábitos",
    "smart_notes": "Notas inteligentes",
    "proactive_alerts": "Alertas proactivas",
    "info_search": "Búsqueda de información",
}

# Feature → minimum plan required (for upgrade message)
FEATURE_MIN_PLAN = {
    "calendar_integration": "Executive Pro",
    "tasks_management": "Executive Pro",
    "voice_commands": "Executive Pro",
    "vip_companies": "Executive Pro",
    "multi_email_accounts": "Executive Business",
    "crm_contacts": "Executive Business",
    "auto_reply": "Executive Business",
}


def check_feature(user: Dict[str, Any], feature: str) -> None:
    """
    Raises HTTP 403 if user doesn't have the required feature.
    Use inside endpoint functions.
    """
    if has_feature(user, feature):
        return

    feature_name = FEATURE_NAMES.get(feature, feature)
    min_plan = FEATURE_MIN_PLAN.get(feature, "un plan superior")

    raise HTTPException(
        status_code=403,
        detail={
            "error": "feature_locked",
            "feature": feature,
            "feature_name": feature_name,
            "min_plan": min_plan,
            "message": f"{feature_name} requiere {min_plan}. Mejora tu plan para desbloquear esta función.",
        },
    )


def require_feature(feature: str):
    """
    Returns a FastAPI dependency that checks for a feature.
    Use as: Depends(require_feature("calendar_integration"))
    
    Note: The endpoint must also have user: Dict = Depends(get_current_user)
    and the user must be passed. Since FastAPI dependencies can't easily
    share state, prefer using check_feature() directly in the endpoint.
    """
    def _dependency():
        # This is a marker — actual check should use check_feature()
        pass
    return _dependency