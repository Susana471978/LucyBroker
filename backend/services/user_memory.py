from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

COLLECTION = "user_memory"

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

async def ensure_user_memory_indexes(db) -> None:
    coll = db[COLLECTION]
    await coll.create_index("user_id", unique=True)

async def get_user_memory(db, user_id: str) -> Dict[str, Any]:
    doc = await db[COLLECTION].find_one({"user_id": user_id}, {"_id": 0}) or {}
    return doc

async def add_memory_note(db, user_id: str, note: str, category: str = "general") -> Dict[str, Any]:
    now = _utcnow()
    entry = {
        "id": str(int(now.timestamp() * 1000)),
        "text": note.strip(),
        "category": category,
        "created_at": now.isoformat(),
    }
    await db[COLLECTION].update_one(
        {"user_id": user_id},
        {
            "$push": {"notes": {"$each": [entry], "$slice": -50}},
            "$set": {"user_id": user_id, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return await get_user_memory(db, user_id)

async def delete_memory_note(db, user_id: str, note_id: str) -> Dict[str, Any]:
    await db[COLLECTION].update_one(
        {"user_id": user_id},
        {"$pull": {"notes": {"id": note_id}}, "$set": {"updated_at": _utcnow()}},
    )
    return await get_user_memory(db, user_id)

def build_user_memory_context(memory: Dict[str, Any]) -> str:
    notes = memory.get("notes", [])
    if not notes:
        return ""
    by_cat: Dict[str, List[str]] = {}
    for n in notes:
        cat = n.get("category", "general")
        by_cat.setdefault(cat, []).append(n.get("text", ""))
    lines = ["Lo que debes recordar siempre sobre este usuario:"]
    labels = {
        "proyecto": "Proyectos activos",
        "cliente": "Clientes clave",
        "preferencia": "Preferencias de trabajo",
        "general": "Notas generales",
    }
    for cat, label in labels.items():
        if cat in by_cat:
            lines.append(f"\n{label}:")
            for text in by_cat[cat]:
                lines.append(f"  · {text}")
    return "\n".join(lines)
