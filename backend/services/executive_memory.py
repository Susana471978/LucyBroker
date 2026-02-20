from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

EXEC_MEM_COLLECTION = "executive_context"
TTL_HOURS = 24


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _expires_at(hours: int = TTL_HOURS) -> datetime:
    return _utcnow() + timedelta(hours=hours)


async def ensure_ttl_index(db) -> None:
    """
    Crea:
    - índice único por user_id (1 doc por usuario)
    - índice TTL en expires_at (expireAfterSeconds=0 = caduca exactamente en expires_at)
    """
    coll = db[EXEC_MEM_COLLECTION]
    await coll.create_index("user_id", unique=True)
    await coll.create_index("expires_at", expireAfterSeconds=0)


async def get_memory(db, user_id: str) -> Dict[str, Any]:
    doc = await db[EXEC_MEM_COLLECTION].find_one({"user_id": user_id}) or {}
    doc.pop("_id", None)
    return doc


async def set_memory(db, user_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
    now = _utcnow()
    await db[EXEC_MEM_COLLECTION].update_one(
        {"user_id": user_id},
        {
            "$set": {
                **fields,
                "user_id": user_id,
                "updated_at": now,
                "expires_at": _expires_at(),
            }
        },
        upsert=True,
    )
    return await get_memory(db, user_id)


async def clear_memory(db, user_id: str) -> None:
    await db[EXEC_MEM_COLLECTION].delete_one({"user_id": user_id})
