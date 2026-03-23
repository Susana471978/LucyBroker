# backend/services/google_auth.py

"""
Shared helper to obtain valid Google OAuth credentials.

Usage (from gmail.py / calendar.py):

    from backend.services.google_auth import get_valid_credentials

    creds = await get_valid_credentials(user, db, token_field="gmail_tokens", scopes=SCOPES)
    if creds is None:
        return []  # not connected or refresh failed
    service = build_service("gmail", "v1", credentials=creds)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest

from backend.services.token_encryption import decrypt_tokens, encrypt_tokens
from backend.utils.logger import logger


async def get_valid_credentials(
    user: Dict[str, Any],
    db,
    *,
    token_field: str,            # "gmail_tokens" or "calendar_tokens"
    default_scopes: List[str],
) -> Optional[Credentials]:
    """
    Build a ``Credentials`` object from the tokens stored in *user* and,
    if the access-token is expired, silently refresh it using the
    stored refresh-token.  The new access-token is persisted back to
    MongoDB so subsequent requests don't need another round-trip to
    Google.

    Returns ``None`` when:
    * there are no stored tokens, or
    * the refresh-token is missing / revoked and the access-token is
      already expired (the user must re-authenticate).
    """

    raw_tokens: Dict[str, Any] = user.get(token_field) or {}

    if not raw_tokens.get("token"):
        return None

    # Decrypt tokens read from MongoDB
    tokens = decrypt_tokens(raw_tokens)

    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri"),
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=tokens.get("scopes") or default_scopes,
    )

    # ── If token is still valid, return as-is ──────────────────────
    if creds.valid:
        return creds

    # ── Try to refresh ─────────────────────────────────────────────
    if not creds.refresh_token:
        logger.warning(
            "Google token expired and no refresh_token stored "
            "(user=%s, field=%s). User must re-authenticate.",
            user.get("id"),
            token_field,
        )
        return None

    try:
        creds.refresh(GoogleAuthRequest())
    except Exception:
        logger.exception(
            "Failed to refresh Google token (user=%s, field=%s). "
            "User may need to re-authenticate.",
            user.get("id"),
            token_field,
        )
        return None

    # ── Persist the fresh access-token back to MongoDB (encrypted) ──
    new_token_data = {"token": creds.token}
    if creds.refresh_token and creds.refresh_token != tokens.get("refresh_token"):
        new_token_data["refresh_token"] = creds.refresh_token

    encrypted = encrypt_tokens(new_token_data)

    updated_fields = {
        f"{token_field}.{k}": v for k, v in encrypted.items()
    }

    try:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": updated_fields},
        )
    except Exception:
        logger.exception("Failed to persist refreshed Google token to DB")

    return creds