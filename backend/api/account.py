# backend/api/account.py
import os
from fastapi import APIRouter, Depends

# AJUSTA estos imports:
from backend.auth.dependencies import get_current_user
from backend.db.mongo import get_db

router = APIRouter(prefix="/api/account", tags=["account"])

CREDENTIALS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "credentials"))


def _gmail_token_exists(user_id: str) -> bool:
    return os.path.exists(os.path.join(CREDENTIALS_DIR, f"gmail_token_{user_id}.json"))


@router.get("/status")
def account_status(user=Depends(get_current_user), db=Depends(get_db)):
    user_id = str(user.get("id") or user.get("_id") or user.get("user_id"))

    doc = db.users.find_one({"_id": user.get("_id") or user_id}) or {}
    billing = (doc.get("billing") or {})

    plan = billing.get("plan") or "free"
    plan_active = bool(billing.get("plan_active", False))

    gmail_connected = _gmail_token_exists(user_id)

    # Features por plan (MVP)
    ai_enabled = plan_active and plan in ("monthly", "yearly")
    gmail_read_enabled = gmail_connected  # en MVP: si conectó, ya puede leer
    draft_enabled = ai_enabled            # drafts solo en plan pago

    return {
        "user_id": user_id,
        "plan": plan,
        "plan_active": plan_active,
        "gmail_connected": gmail_connected,
        "features": {
            "ai_enabled": ai_enabled,
            "gmail_read_enabled": gmail_read_enabled,
            "draft_enabled": draft_enabled,
        }
    }

