# backend/services/stripe_service.py

from __future__ import annotations

import stripe
from typing import Optional

from backend.core.settings import settings


# ======================================================
# STRIPE INIT
# ======================================================

_stripe_initialized: bool = False


def _init_stripe() -> None:
    """Inicializa Stripe de forma segura (lazy init)."""
    global _stripe_initialized

    if _stripe_initialized:
        return

    if not settings.stripe_secret_key:
        raise ValueError("Stripe no configurado: falta STRIPE_SECRET_KEY")

    stripe.api_key = settings.stripe_secret_key
    _stripe_initialized = True


# ======================================================
# CHECKOUT SESSION
# ======================================================

def create_checkout_session(
    *,
    user_id: str,
    email: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
    customer_id: Optional[str] = None,
):
    """
    Crea una sesión de Stripe Checkout para una suscripción.

    Si el usuario ya tiene customer_id en Stripe (compra anterior),
    lo reutiliza para evitar duplicados de customer.
    Si no, Stripe crea un customer nuevo al completar el pago.
    El webhook checkout.session.completed guarda el customer_id resultante.
    """
    _init_stripe()

    if not user_id:
        raise ValueError("user_id es obligatorio")
    if not email:
        raise ValueError("email es obligatorio")
    if not price_id:
        raise ValueError("price_id es obligatorio")

    session_params = dict(
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "app": "email_system_control",
        },
    )

    if customer_id:
        # Usuario ya tiene customer en Stripe → reutilizar
        session_params["customer"] = customer_id
    else:
        # Primera compra → Stripe crea el customer al completar el pago
        session_params["customer_email"] = email

    return stripe.checkout.Session.create(**session_params)


# ======================================================
# CUSTOMER PORTAL (GESTIÓN DE SUSCRIPCIÓN)
# ======================================================

def create_customer_portal_session(
    *,
    customer_id: str,
    return_url: str,
):
    """
    Crea una sesión del portal de cliente de Stripe
    para que el usuario gestione su suscripción.
    """
    _init_stripe()

    if not customer_id:
        raise ValueError("customer_id es obligatorio")

    return stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )