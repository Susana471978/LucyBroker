# backend/core/plans.py

"""
Sistema de planes de Lucy.
Dos productos independientes + bundle.
Cada usuario puede tener uno o ambos productos activos.
"""

from __future__ import annotations
from typing import Dict, List, Optional, Any


# =====================================================
# STRIPE PRICE IDs
# =====================================================

PRICE_IDS = {
    # Lucy Secretaria Ejecutiva
    "executive_basic":    "price_1TCG9SL07UaiQy6M6FtMTiVn",   # €19/mes
    "executive_pro":      "price_1TCGANL07UaiQy6MkbrqNQfs",   # €29/mes
    "executive_business": "price_1TCGAmL07UaiQy6Msw1Drxvc",   # €49/mes

    # Lucy Asistente Personal
    "personal_basic":     "price_1TCGBHL07UaiQy6Mw3FMiwRs",   # €14/mes
    "personal_pro":       "price_1TCGBZL07UaiQy6M9e3UUKuq",   # €24/mes

    # Lucy Completa (Bundle)
    "bundle_basic":       "price_1TCGC1L07UaiQy6MLoFCXOXV",   # €25/mes
    "bundle_pro":         "price_1TCGCIL07UaiQy6MzPOw9QEY",   # €40/mes
    "bundle_business":    "price_1TCGCjL07UaiQy6MXLhIRby1",   # €55/mes
}

# Reverse lookup: price_id → plan_key
PRICE_TO_PLAN = {v: k for k, v in PRICE_IDS.items()}


# =====================================================
# PLAN DEFINITIONS
# =====================================================

PLANS = {
    # ── Secretaria Ejecutiva ──
    "executive_basic": {
        "product": "executive",
        "tier": "basic",
        "name": "Secretaria Ejecutiva — Básico",
        "price": 19,
        "features": [
            "briefing_matutino",
            "email_prioritization",
            "email_summary",
            "single_email_account",
        ],
    },
    "executive_pro": {
        "product": "executive",
        "tier": "pro",
        "name": "Secretaria Ejecutiva — Pro",
        "price": 29,
        "features": [
            "briefing_matutino",
            "email_prioritization",
            "email_summary",
            "single_email_account",
            "calendar_integration",
            "tasks_management",
            "voice_commands",
        ],
    },
    "executive_business": {
        "product": "executive",
        "tier": "business",
        "name": "Secretaria Ejecutiva — Business",
        "price": 49,
        "features": [
            "briefing_matutino",
            "email_prioritization",
            "email_summary",
            "single_email_account",
            "calendar_integration",
            "tasks_management",
            "voice_commands",
            "multi_email_accounts",
            "crm_contacts",
            "auto_reply",
        ],
    },

    # ── Asistente Personal ──
    "personal_basic": {
        "product": "personal",
        "tier": "basic",
        "name": "Asistente Personal — Básico",
        "price": 14,
        "features": [
            "reminders",
            "personal_memory",
            "daily_organization",
            "habits_tracking",
        ],
    },
    "personal_pro": {
        "product": "personal",
        "tier": "pro",
        "name": "Asistente Personal — Pro",
        "price": 24,
        "features": [
            "reminders",
            "personal_memory",
            "daily_organization",
            "habits_tracking",
            "smart_notes",
            "proactive_alerts",
            "info_search",
        ],
    },

    # ── Bundle ──
    "bundle_basic": {
        "product": "bundle",
        "tier": "basic",
        "name": "Lucy Completa — Básico",
        "price": 25,
        "features": [
            "briefing_matutino",
            "email_prioritization",
            "email_summary",
            "single_email_account",
            "reminders",
            "personal_memory",
            "daily_organization",
            "habits_tracking",
        ],
    },
    "bundle_pro": {
        "product": "bundle",
        "tier": "pro",
        "name": "Lucy Completa — Pro",
        "price": 40,
        "features": [
            "briefing_matutino",
            "email_prioritization",
            "email_summary",
            "single_email_account",
            "calendar_integration",
            "tasks_management",
            "voice_commands",
            "reminders",
            "personal_memory",
            "daily_organization",
            "habits_tracking",
            "smart_notes",
            "proactive_alerts",
            "info_search",
        ],
    },
    "bundle_business": {
        "product": "bundle",
        "tier": "business",
        "name": "Lucy Completa — Business+Pro",
        "price": 55,
        "features": [
            "briefing_matutino",
            "email_prioritization",
            "email_summary",
            "single_email_account",
            "calendar_integration",
            "tasks_management",
            "voice_commands",
            "multi_email_accounts",
            "crm_contacts",
            "auto_reply",
            "reminders",
            "personal_memory",
            "daily_organization",
            "habits_tracking",
            "smart_notes",
            "proactive_alerts",
            "info_search",
        ],
    },
}


# =====================================================
# TRIAL / FREE FEATURES (4 horas)
# =====================================================

TRIAL_FEATURES = [
    "briefing_matutino",
    "email_prioritization",
    "email_summary",
    "single_email_account",
    "reminders",
    "personal_memory",
    "habits_tracking",
]

TRIAL_LIMITS = {
    "trial_hours": 4,
    "trial_seconds": 14400,   # 4 horas en segundos
    "max_emails_per_day": 10,
    "max_reminders": 5,
    "max_habits": 3,
    "tts_enabled": True,
}


# =====================================================
# FEATURE GATING
# =====================================================

def get_user_plan(user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns the user's active plan(s) info.
    A user can have:
      - admin (all features)
      - a bundle plan (both products)
      - executive + personal plans separately
      - trial (limited features)
    """
    if user.get("is_admin"):
        return {
            "plans": ["admin"],
            "features": list(set(f for p in PLANS.values() for f in p["features"])),
            "is_admin": True,
            "is_trial": False,
            "executive_tier": "business",
            "personal_tier": "pro",
        }

    subscriptions = user.get("subscriptions", {})
    active_plans = []
    all_features = set()
    executive_tier = None
    personal_tier = None

    for plan_key, sub_data in subscriptions.items():
        if sub_data.get("status") == "active" and plan_key in PLANS:
            active_plans.append(plan_key)
            plan = PLANS[plan_key]
            all_features.update(plan["features"])

            if plan["product"] in ("executive", "bundle"):
                executive_tier = plan["tier"]
            if plan["product"] in ("personal", "bundle"):
                personal_tier = plan["tier"]

    # Legacy support: old subscription_active field
    if not active_plans and user.get("subscription_active"):
        active_plans.append("executive_pro")
        plan = PLANS["executive_pro"]
        all_features.update(plan["features"])
        executive_tier = "pro"

    is_trial = len(active_plans) == 0
    if is_trial:
        all_features.update(TRIAL_FEATURES)

    return {
        "plans": active_plans if active_plans else ["trial"],
        "features": list(all_features),
        "is_admin": False,
        "is_trial": is_trial,
        "executive_tier": executive_tier,
        "personal_tier": personal_tier,
    }


def has_feature(user: Dict[str, Any], feature: str) -> bool:
    """Check if user has access to a specific feature."""
    plan_info = get_user_plan(user)
    return feature in plan_info["features"]


def get_plan_from_price(price_id: str) -> Optional[str]:
    """Get plan key from Stripe price ID."""
    return PRICE_TO_PLAN.get(price_id)


def get_available_plans() -> List[Dict[str, Any]]:
    """Returns all plans for the pricing page."""
    result = []
    for key, plan in PLANS.items():
        result.append({
            "key": key,
            "product": plan["product"],
            "tier": plan["tier"],
            "name": plan["name"],
            "price": plan["price"],
            "price_id": PRICE_IDS[key],
            "features": plan["features"],
        })
    return result