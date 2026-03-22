# backend/api/billing.py

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Query

from backend.core.dependencies import get_current_user
from backend.core.plans import (
    PRICE_IDS, PLANS, get_user_plan, get_available_plans, get_plan_from_price,
)
from backend.services.stripe_service import create_checkout_session, create_customer_portal_session
from backend.utils.response import build_response
from backend.utils.logger import logger
from backend.core.database import db


router = APIRouter(prefix="/billing", tags=["billing"])


# =====================================================
# GET PLANS (public)
# =====================================================

@router.get("/plans")
async def list_plans(request: Request):
    """Returns all available plans for the pricing page."""
    plans = get_available_plans()

    # Group by product
    grouped = {
        "executive": [p for p in plans if p["product"] == "executive"],
        "personal": [p for p in plans if p["product"] == "personal"],
        "bundle": [p for p in plans if p["product"] == "bundle"],
    }

    return build_response(
        request,
        data={"plans": grouped},
        legacy={"plans": grouped},
    )


# =====================================================
# GET MY SUBSCRIPTION
# =====================================================

@router.get("/subscription")
async def get_subscription(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Returns current user's plan info and active features."""
    plan_info = get_user_plan(user)

    return build_response(
        request,
        data={
            "plans": plan_info["plans"],
            "features": plan_info["features"],
            "is_trial": plan_info["is_trial"],
            "is_admin": plan_info["is_admin"],
            "executive_tier": plan_info["executive_tier"],
            "personal_tier": plan_info["personal_tier"],
        },
        legacy={
            "plans": plan_info["plans"],
            "features": plan_info["features"],
            "is_trial": plan_info["is_trial"],
            "is_admin": plan_info["is_admin"],
            "executive_tier": plan_info["executive_tier"],
            "personal_tier": plan_info["personal_tier"],
        },
    )


# =====================================================
# CHECKOUT
# =====================================================

@router.post("/checkout")
async def billing_checkout(
    request: Request,
    plan: str = Query(..., description="Plan key (e.g. executive_pro, personal_basic, bundle_pro)"),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Creates a Stripe Checkout session for the selected plan."""
    if plan not in PRICE_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"Plan inválido. Opciones: {', '.join(PRICE_IDS.keys())}",
        )

    price_id = PRICE_IDS[plan]
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    try:
        session = create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            price_id=price_id,
            success_url=f"{frontend_url}/app/billing/success",
            cancel_url=f"{frontend_url}/app/billing/cancel",
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Stripe checkout error")
        raise HTTPException(status_code=502, detail="Error creando sesión de pago")

    return build_response(
        request,
        data={
            "checkout_url": session.url,
            "session_id": session.id,
            "plan": plan,
        },
        legacy={
            "checkout_url": session.url,
            "session_id": session.id,
            "plan": plan,
        },
    )


# =====================================================
# CUSTOMER PORTAL
# =====================================================

@router.post("/portal")
async def billing_portal(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Creates a Stripe Customer Portal session for managing subscriptions."""
    subscriptions = user.get("subscriptions", {})
    customer_id = None

    # Find any active customer_id
    for plan_key, sub_data in subscriptions.items():
        if sub_data.get("customer_id"):
            customer_id = sub_data["customer_id"]
            break

    # Legacy fallback
    if not customer_id:
        stripe_data = user.get("stripe", {})
        customer_id = stripe_data.get("customer_id")

    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="No tienes una suscripción activa. Elige un plan primero.",
        )

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    try:
        session = create_customer_portal_session(
            customer_id=customer_id,
            return_url=f"{frontend_url}/app/settings",
        )
    except Exception as e:
        logger.exception("Stripe portal error")
        raise HTTPException(status_code=502, detail="Error abriendo el portal de facturación")

    return build_response(
        request,
        data={"portal_url": session.url},
        legacy={"portal_url": session.url},
    )