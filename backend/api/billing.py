# backend/api/billing.py
from fastapi import APIRouter, Depends, Query
from backend.core.settings import settings
from backend.services.stripe_service import stripe_service, Plan

# AJUSTA estos imports a tu proyecto real:
from backend.auth.dependencies import get_current_user  # <- debe devolver dict/obj con id/email
from backend.db.mongo import get_db  # <- debe devolver motor/cliente/db

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/checkout")
def create_checkout(
    plan: Plan = Query(..., description="monthly|yearly"),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Crea una sesión de Stripe Checkout para el plan indicado.
    NO crashea si Stripe no está configurado: devuelve 503.
    """
    user_id = str(user.get("id") or user.get("_id") or user.get("user_id"))
    user_email = user.get("email")

    frontend = settings.frontend_url.rstrip("/")
    success_url = f"{frontend}/billing/success"
    cancel_url = f"{frontend}/billing/cancel"

    session = stripe_service.create_checkout_session(
        plan=plan,
        user_id=user_id,
        user_email=user_email,
        success_url=success_url,
        cancel_url=cancel_url,
    )

    # (Opcional) Guardar “checkout iniciado”
    try:
        db.users.update_one(
            {"_id": user.get("_id") or user_id},
            {"$set": {"billing.checkout_last_session": session.get("id")}},
            upsert=True,
        )
    except Exception:
        # No rompemos el flujo por telemetría
        pass

    return {
        "checkout_url": session.get("url"),
        "session_id": session.get("id"),
    }
