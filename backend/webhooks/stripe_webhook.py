# backend/webhooks/stripe_webhook.py

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Any

import stripe
from fastapi import APIRouter, Request, HTTPException

from backend.core.settings import settings
from backend.core.plans import get_plan_from_price, PLANS
from backend.utils.logger import logger
from backend.core.database import db

router = APIRouter(prefix="/webhooks", tags=["stripe"])


# ======================================================
# WEBHOOK ENDPOINT
# ======================================================

@router.post("/stripe")
async def stripe_webhook(request: Request):
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        logger.error("Stripe webhook no configurado")
        raise HTTPException(status_code=503, detail="Webhook no configurado")

    if not stripe.api_key:
        stripe.api_key = settings.stripe_secret_key

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as exc:
        logger.exception("Stripe webhook error: %s", exc)
        raise HTTPException(status_code=400, detail="Webhook error")

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info("Stripe event: %s", event_type)

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data)
    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        await _handle_subscription_upsert(data)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data)

    return {"status": "ok"}


# ======================================================
# HELPERS
# ======================================================

def _extract_plan_key(subscription: Dict[str, Any]) -> str | None:
    """Extract plan key from subscription items."""
    items = subscription.get("items", {}).get("data", [])
    if not items:
        return None
    price_id = items[0].get("price", {}).get("id", "")
    return get_plan_from_price(price_id)


# ======================================================
# EVENT HANDLERS
# ======================================================

async def _handle_checkout_completed(session: Dict[str, Any]):
    metadata = session.get("metadata", {})
    user_id = metadata.get("user_id")

    if not user_id:
        logger.warning("Checkout completed sin user_id")
        return

    # Get the subscription to find the plan
    subscription_id = session.get("subscription")
    if not subscription_id:
        logger.warning("Checkout sin subscription_id")
        return

    # Fetch full subscription from Stripe
    if not stripe.api_key:
        stripe.api_key = settings.stripe_secret_key

    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        plan_key = _extract_plan_key(subscription)
    except Exception as e:
        logger.exception("Error fetching subscription: %s", e)
        plan_key = None

    if not plan_key:
        logger.warning("No se pudo determinar el plan para checkout session")
        return

    logger.info("Checkout completado: user=%s plan=%s", user_id, plan_key)

    plan = PLANS.get(plan_key, {})
    now = datetime.now(timezone.utc).isoformat()

    # Store subscription under user.subscriptions.{plan_key}
    update = {
        f"subscriptions.{plan_key}": {
            "customer_id": session.get("customer"),
            "subscription_id": subscription_id,
            "status": "active",
            "product": plan.get("product", ""),
            "tier": plan.get("tier", ""),
            "started_at": now,
            "updated_at": now,
        },
        "subscription_active": True,
    }

    await db.users.update_one(
        {"id": user_id},
        {"$set": update},
    )


async def _handle_subscription_upsert(subscription: Dict[str, Any]):
    metadata = subscription.get("metadata", {})
    user_id = metadata.get("user_id")

    if not user_id:
        # Try to find user by subscription_id
        sub_id = subscription.get("id")
        user = await db.users.find_one(
            {f"subscriptions": {"$elemMatch": {"subscription_id": sub_id}}},
            {"id": 1},
        )
        if not user:
            # Search in all subscription fields
            all_users = db.users.find({}, {"id": 1, "subscriptions": 1})
            async for u in all_users:
                subs = u.get("subscriptions", {})
                for k, v in subs.items():
                    if v.get("subscription_id") == sub_id:
                        user_id = u["id"]
                        break
                if user_id:
                    break

        if not user_id:
            logger.warning("Subscription upsert: no user found for sub=%s", subscription.get("id"))
            return

    plan_key = _extract_plan_key(subscription)
    if not plan_key:
        logger.warning("Subscription upsert: unknown plan for sub=%s", subscription.get("id"))
        return

    status = subscription.get("status", "")
    now = datetime.now(timezone.utc).isoformat()

    plan = PLANS.get(plan_key, {})

    current_period_end = None
    if subscription.get("current_period_end"):
        current_period_end = datetime.fromtimestamp(
            subscription["current_period_end"], tz=timezone.utc
        ).isoformat()

    update = {
        f"subscriptions.{plan_key}": {
            "customer_id": subscription.get("customer"),
            "subscription_id": subscription.get("id"),
            "status": status,
            "product": plan.get("product", ""),
            "tier": plan.get("tier", ""),
            "current_period_end": current_period_end,
            "updated_at": now,
        },
        "subscription_active": status == "active",
    }

    await db.users.update_one(
        {"id": user_id},
        {"$set": update},
    )

    logger.info("Subscription upsert: user=%s plan=%s status=%s", user_id, plan_key, status)


async def _handle_subscription_deleted(subscription: Dict[str, Any]):
    sub_id = subscription.get("id")
    if not sub_id:
        return

    plan_key = _extract_plan_key(subscription)
    now = datetime.now(timezone.utc).isoformat()

    # Find user with this subscription
    user_id = None
    all_users = db.users.find({}, {"id": 1, "subscriptions": 1})
    async for u in all_users:
        subs = u.get("subscriptions", {})
        for k, v in subs.items():
            if v.get("subscription_id") == sub_id:
                user_id = u["id"]
                plan_key = plan_key or k
                break
        if user_id:
            break

    if not user_id:
        logger.warning("Subscription deleted: no user found for sub=%s", sub_id)
        return

    logger.info("Subscription deleted: user=%s plan=%s", user_id, plan_key)

    if plan_key:
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    f"subscriptions.{plan_key}.status": "cancelled",
                    f"subscriptions.{plan_key}.ended_at": now,
                    f"subscriptions.{plan_key}.updated_at": now,
                },
            },
        )

    # Check if user still has any active subscription
    user = await db.users.find_one({"id": user_id}, {"subscriptions": 1})
    subs = user.get("subscriptions", {}) if user else {}
    any_active = any(v.get("status") == "active" for v in subs.values())

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription_active": any_active}},
    )