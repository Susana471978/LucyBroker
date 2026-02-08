from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Dict, Any

import stripe
from fastapi import APIRouter, Request, HTTPException

from backend.config import settings
from backend.utils.logger import logger
from backend.database import db  # ⚠️ ajusta si tu db está en otro módulo

router = APIRouter(prefix="/webhooks", tags=["stripe"])

# ======================================================
# STRIPE CONFIG (LAZY INIT - DEFENSIVE)
# ======================================================
# No inicializamos stripe aquí para evitar RuntimeError al import.
# Validación ocurre en el endpoint cuando se recibe un evento.


# ======================================================
# WEBHOOK ENDPOINT
# ======================================================

@router.post("/stripe")
async def stripe_webhook(request: Request):
    """
    Webhook principal de Stripe.
    Escucha eventos de pagos y suscripciones.
    """

    # ⚠️ Validación defensiva (lazy init)
    if not settings.stripe_secret_key:
        logger.error("❌ Stripe webhook recibido pero STRIPE_SECRET_KEY no está configurada")
        raise HTTPException(status_code=503, detail="Webhook no configurado")

    if not settings.stripe_webhook_secret:
        logger.error("❌ Stripe webhook recibido pero STRIPE_WEBHOOK_SECRET no está configurada")
        raise HTTPException(status_code=503, detail="Webhook no configurado")

    # Asegurar que stripe.api_key está inicializado
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

    logger.info("🔔 Stripe event received: %s", event_type)

    # ======================================================
    # CHECKOUT COMPLETED (ALTA DE CLIENTE)
    # ======================================================

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data)

    # ======================================================
    # FUTUROS EVENTOS (placeholder)
    # ======================================================
    # elif event_type == "customer.subscription.deleted":
    #     await _handle_subscription_cancelled(data)

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

    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    logger.info("✅ Checkout completado para user_id=%s", user_id)

    update = {
        "stripe": {
            "customer_id": customer_id,
            "subscription_id": subscription_id,
            "status": "active",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        "plan": "paid",
    }

    await db.users.update_one(
        {"id": user_id},
        {"$set": update},
    )

    logger.info("💳 Usuario %s activado como PAID", user_id)


# ======================================================
# FUTUROS HANDLERS (ejemplo)
# ======================================================
# async def _handle_subscription_cancelled(data: Dict[str, Any]):
#     subscription_id = data.get("id")
#     await db.users.update_one(
#         {"stripe.subscription_id": subscription_id},
#         {"$set": {"plan": "cancelled"}},
#     )
