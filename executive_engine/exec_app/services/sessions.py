from datetime import datetime, timedelta, timezone
from typing import Tuple, Dict, Any
from bson import ObjectId

from exec_app.db import db
from exec_app.config import settings


COLLECTION = db["executive_sessions"]


# =====================================================
# RESTORE OR CREATE
# =====================================================

async def restore_or_create_session(user_id: str) -> Tuple[bool, Dict[str, Any]]:
    now = datetime.now(timezone.utc)

    session = await COLLECTION.find_one({
        "user_id": user_id,
        "expires_at": {"$gt": now}
    })

    if session:
        return True, session

    expires_at = now + timedelta(hours=settings.session_ttl_hours)

    new_session = {
        "user_id": user_id,
        "current_email_id": None,
        "last_action": None,
        "tone_preference": "neutral",
        "last_draft_content": None,
        "last_interaction_at": now,
        "expires_at": expires_at,
    }

    result = await COLLECTION.insert_one(new_session)
    new_session["_id"] = result.inserted_id

    return False, new_session


# =====================================================
# RESET
# =====================================================

async def reset_session(user_id: str) -> None:
    await COLLECTION.delete_many({"user_id": user_id})


# =====================================================
# UPDATE FIELDS (Memoria Viva)
# =====================================================

from exec_app.config import settings
from datetime import timedelta

ALLOWED_FIELDS = {
    "tone_preference",
    "current_email_id",
    "last_draft_content",
    "last_action",
}

async def update_session_fields(user_id: str, fields: Dict[str, Any]) -> None:
    now = datetime.now(timezone.utc)

    # Verificar sesión existente
    session = await COLLECTION.find_one({"user_id": user_id})
    if not session:
        raise ValueError("Session not found")

    # Filtrar solo campos permitidos
    safe_updates = {
        key: value
        for key, value in fields.items()
        if key in ALLOWED_FIELDS
    }

    # Renovar timestamps
    safe_updates["last_interaction_at"] = now
    safe_updates["expires_at"] = now + timedelta(hours=settings.session_ttl_hours)

    await COLLECTION.update_one(
        {"user_id": user_id},
        {"$set": safe_updates},
    )

