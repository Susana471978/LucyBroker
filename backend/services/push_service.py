# backend/services/push_service.py
from __future__ import annotations
import json
import os
from typing import Optional
from pywebpush import webpush, WebPushException
from backend.utils.logger import get_logger

logger = get_logger("push_service")

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace("\\n", "\n")
VAPID_EMAIL       = os.environ.get("VAPID_EMAIL", "mailto:admin@objetiva.es")


async def save_subscription(db, user_id: str, subscription: dict) -> bool:
    """Guarda o actualiza la suscripción push de un usuario."""
    try:
        await db.push_subscriptions.update_one(
            {"user_id": user_id, "endpoint": subscription["endpoint"]},
            {"$set": {"user_id": user_id, **subscription}},
            upsert=True,
        )
        return True
    except Exception as e:
        logger.error("Error guardando suscripción: %s", e)
        return False


async def delete_subscription(db, user_id: str, endpoint: str) -> bool:
    """Elimina una suscripción push."""
    try:
        await db.push_subscriptions.delete_one({"user_id": user_id, "endpoint": endpoint})
        return True
    except Exception as e:
        logger.error("Error eliminando suscripción: %s", e)
        return False


async def send_push(db, user_id: str, title: str, body: str, url: str = "/") -> int:
    """Envía notificación push a todas las suscripciones de un usuario. Devuelve nº enviadas."""
    sent = 0
    try:
        cursor = db.push_subscriptions.find({"user_id": user_id})
        subs = await cursor.to_list(length=20)
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": sub["keys"],
                    },
                    data=json.dumps({"title": title, "body": body, "url": url}),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_EMAIL},
                )
                sent += 1
            except WebPushException as e:
                if e.response and e.response.status_code in (404, 410):
                    # Suscripción caducada — eliminar
                    await db.push_subscriptions.delete_one({"_id": sub["_id"]})
                else:
                    logger.warning("Push fallido: %s", e)
    except Exception as e:
        logger.error("Error enviando push: %s", e)
    return sent


async def broadcast_push(db, title: str, body: str, url: str = "/", role: Optional[str] = None) -> int:
    """Envía push a todos los usuarios (opcionalmente filtrado por rol)."""
    sent = 0
    try:
        user_query = {"role": role} if role else {}
        users = await db.users.find(user_query, {"id": 1}).to_list(100)
        for user in users:
            sent += await send_push(db, user["id"], title, body, url)
    except Exception as e:
        logger.error("Error en broadcast push: %s", e)
    return sent
