from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Any

import stripe
from fastapi import APIRouter, Request, HTTPException

from backend.config import settings
from backend.utils.logger import logger
from backend.database import db

router = APIRouter(prefix="/webhooks", tags=["stripe"])


# ======================================================
# WEBHOOK ENDPOINT
# ======================================================

@router.post("/stripe")
async def stripe_webhook(request: Request):
    """
    Webhook principal de Stripe.
    Escucha eventos de pagos y suscripciones.
    """

    # --- Validación defensiva ---
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        logger.error("❌ Stripe webhook no configurado")
        raise HTTPException(status_code=503, detail="Webhook no configurado")

    # --- Lazy init Stripe ---
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
        logger.warning("⚠️ Stripe signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as exc:
        logger.exception("Stripe webhook error: %s", exc)
        raise HTTPException(status_code=400, detail="Webhook error")

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info("🔔 Stripe event recibido: %s", event_type)

    # ======================================================
    # EVENT ROUTING
    # ======================================================

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data)

    elif event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
    ):
        await _handle_subscription_upsert(data)

    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data)

    # Otros eventos se aceptan pero no se procesan
    return {"status": "ok"}


# ======================================================
# EVENT HANDLERS
# ======================================================

async def _handle_checkout_completed(session: Dict[str, Any]):
    """
    Se ejecuta cuando el usuario completa el checkout.
    """

    metadata = session.get("metadata", {})
    user_id = metadata.get("user_id")

    if not user_id:
        logger.warning("Checkout completed sin user_id en metadata")
        return

    logger.info("✅ Checkout completado para user_id=%s", user_id)

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "stripe": {
                    "customer_id": session.get("customer"),
                    "subscription_id": session.get("subscription"),
                    "status": "active",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "subscription_active": True,
            }
        },
    )


async def _handle_subscription_upsert(subscription: Dict[str, Any]):
    """
    Se ejecuta en creación o actualización de suscripción.
    Fuente de verdad del estado real.
    """

    metadata = subscription.get("metadata", {})
    user_id = metadata.get("user_id")

    if not user_id:
        logger.warning("Subscription event sin user_id en metadata")
        return

    items = subscription.get("items", {}).get("data", [])
    price = items[0]["price"] if items else {}
    interval = price.get("recurring", {}).get("interval")

    plan = interval if interval in ("monthly", "yearly") else "unknown"

    update = {
        "stripe": {
            "customer_id": subscription.get("customer"),
            "subscription_id": subscription.get("id"),
            "status": subscription.get("status"),
            "plan": plan,
            "current_period_end": datetime.fromtimestamp(
                subscription.get("current_period_end"),
                tz=timezone.utc,
            ).isoformat()
            if subscription.get("current_period_end")
            else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        "subscription_active": subscription.get("status") == "active",
        "plan": plan,
    }

    await db.users.update_one(
        {"id": user_id},
        {"$set": update},
    )

    logger.info(
        "🔄 Suscripción actualizada user_id=%s plan=%s status=%s",
        user_id,
        plan,
        subscription.get("status"),
    )


async def _handle_subscription_deleted(subscription: Dict[str, Any]):
    """
    Se ejecuta cuando una suscripción es cancelada o expira.
    NO borra datos. Solo marca estado.
    """

    subscription_id = subscription.get("id")

    if not subscription_id:
        logger.warning("Subscription deleted sin subscription_id")
        return

    logger.info("❌ Suscripción cancelada: %s", subscription_id)

    update = {
        "subscription_active": False,
        "plan": "cancelled",
        "stripe.status": "cancelled",
        "stripe.ended_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.users.update_one(
        {"stripe.subscription_id": subscription_id},
        {"$set": update},
    )

    if result.matched_count == 0:
        logger.warning("No se encontró usuario para subscription_id=%s", subscription_id)
    else:
        logger.info("🚫 Usuario marcado como CANCELLED (subscription_id=%s)", subscription_id)
