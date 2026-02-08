from fastapi import APIRouter, Request, HTTPException
import stripe

from backend.config import settings
from backend.utils.logger import logger

router = APIRouter(prefix="/webhooks/stripe", tags=["stripe"])


@router.post("")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not settings.stripe_webhook_secret:
        logger.warning("Stripe webhook secret no configurado")
        raise HTTPException(status_code=500, detail="Webhook no configurado")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma inválida")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 👇 MVP: solo logueamos eventos importantes
    event_type = event["type"]
    logger.info(f"Stripe event recibido: {event_type}")

    return {"status": "ok"}
