# backend/core/plans.py

"""
Sistema de planes de Lucy.
Primer lanzamiento: solo Lucy Secretaria Ejecutiva (3 tiers).
Personal y Bundle comentados para segundo lanzamiento.
"""

from __future__ import annotations
from typing import Dict, List, Optional, Any


# =====================================================
# STRIPE PRICE IDs (Cuenta Syntexia)
# =====================================================

PRICE_IDS = {
    # Lucy Secretaria Ejecutiva
    "executive_basic":    "price_1TCdFGL07UaiQy6MNGAcfuiI",   # €19/mes
    "executive_pro":      "price_1TCdFbL07UaiQy6MqamCQpu3",   # €29/mes
    "executive_business": "price_1TCdG3L07UaiQy6MhgMvqLlG",   # €49/mes

    # Lucy Asistente Personal (segundo lanzamiento)
    # "personal_basic":     "price_1TCdGUL07UaiQy6MKdLzsQAg",   # €14/mes
    # "personal_pro":       "price_1TCdGnL07UaiQy6MRKQ759N0",   # €24/mes

    # Lucy Completa — Bundle (segundo lanzamiento)
    # "bundle_basic":       "price_1TCdHFL07UaiQy6MNrMBJtal",   # €25/mes
    # "bundle_pro":         "price_1TCdHYL07UaiQy6MOQqzlImb",   # €40/mes
    # "bundle_business":    "price_1TCdHvL07UaiQy6MgfsoRsJo",   # €55/mes
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
            "vip_companies",
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
            "vip_companies",
            "multi_email_accounts",
            "crm_contacts",
            "auto_reply",
        ],
    },

    # ── Asistente Personal (segundo lanzamiento) ──
    # "personal_basic": { ... },
    # "personal_pro": { ... },

    # ── Bundle (segundo lanzamiento) ──
    # "bundle_basic": { ... },
    # "bundle_pro": { ... },
    # "bundle_business": { ... },
}


# =====================================================
# TRIAL / FREE FEATURES (4 horas)
# =====================================================

TRIAL_FEATURES = [
    "briefing_matutino",
    "email_prioritization",
    "email_summary",
    "single_email_account",
]

TRIAL_LIMITS = {
    "trial_hours": 4,
    "trial_seconds": 14400,
    "max_emails_per_day": 10,
    "max_reminders": 3,
    "max_habits": 2,
    "tts_enabled": False,
}


# =====================================================
# FEATURE GATING
# =====================================================

def get_user_plan(user: Dict[str, Any]) -> Dict[str, Any]:
    if user.get("is_admin"):
        return {
            "plans": ["admin"],
            "features": list(set(f for p in PLANS.values() for f in p["features"])),
            "is_admin": True,
            "is_trial": False,
            "executive_tier": "business",
            "personal_tier": None,
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

    # Legacy fallback: old subscription_active flag
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
    plan_info = get_user_plan(user)
    return feature in plan_info["features"]


def get_plan_from_price(price_id: str) -> Optional[str]:
    return PRICE_TO_PLAN.get(price_id)


def get_available_plans() -> List[Dict[str, Any]]:
    """Returns only plans available for the current launch (executive only)."""
    result = []
    for key, plan in PLANS.items():
        if key not in PRICE_IDS:
            continue  # Skip commented-out plans
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