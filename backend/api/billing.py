# backend/api/billing.py

from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Query

from backend.core.dependencies import get_current_user
from backend.core.plans import PRICE_IDS, PLANS, get_user_plan, get_available_plans
from backend.services.stripe_service import create_checkout_session, create_customer_portal_session
from backend.utils.response import build_response
from backend.utils.logger import logger
from backend.core.database import db

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/plans")
async def list_plans(request: Request):
    plans = get_available_plans()
    grouped = {
        "executive": [p for p in plans if p["product"] == "executive"],
        "personal": [p for p in plans if p["product"] == "personal"],
        "bundle": [p for p in plans if p["product"] == "bundle"],
    }
    return build_response(request, data={"plans": grouped}, legacy={"plans": grouped})

@router.get("/subscription")
async def get_subscription(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    plan_info = get_user_plan(user)
    payload = {
        "plans": plan_info["plans"],
        "features": plan_info["features"],
        "is_trial": plan_info["is_trial"],
        "is_admin": plan_info["is_admin"],
        "executive_tier": plan_info["executive_tier"],
        "personal_tier": plan_info["personal_tier"],
    }
    return build_response(request, data=payload, legacy=payload)

@router.post("/checkout")
async def billing_checkout(
    request: Request,
    plan: str = Query(...),
    user: Dict[str, Any] = Depends(get_current_user),
):
    if plan not in PRICE_IDS:
        raise HTTPException(status_code=400, detail=f"Plan invalido. Opciones: {', '.join(PRICE_IDS.keys())}")

    price_id = PRICE_IDS[plan]
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    existing_customer_id = None
    for sub_data in user.get("subscriptions", {}).values():
        if isinstance(sub_data, dict) and sub_data.get("customer_id"):
            existing_customer_id = sub_data["customer_id"]
            break
    if not existing_customer_id:
        existing_customer_id = user.get("stripe", {}).get("customer_id")

    try:
        session = create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            price_id=price_id,
            success_url=f"{frontend_url}/app/billing/success",
            cancel_url=f"{frontend_url}/app/billing/cancel",
            customer_id=existing_customer_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        logger.exception("Stripe checkout error")
        raise HTTPException(status_code=502, detail="Error creando sesion de pago")

    payload = {"checkout_url": session.url, "session_id": session.id, "plan": plan}
    return build_response(request, data=payload, legacy=payload)

@router.post("/portal")
async def billing_portal(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    customer_id = None
    for sub_data in user.get("subscriptions", {}).values():
        if isinstance(sub_data, dict) and sub_data.get("customer_id"):
            customer_id = sub_data["customer_id"]
            break
    if not customer_id:
        customer_id = user.get("stripe", {}).get("customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No tienes una suscripcion activa.")

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    try:
        session = create_customer_portal_session(customer_id=customer_id, return_url=f"{frontend_url}/app/settings")
    except Exception:
        logger.exception("Stripe portal error")
        raise HTTPException(status_code=502, detail="Error abriendo el portal de facturacion")

    return build_response(request, data={"portal_url": session.url}, legacy={"portal_url": session.url})
