# backend/services/user_memory.py

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


async def add_memory_note(
    db, user_id: str, note: str, category: str = "general"
) -> Dict[str, Any]:
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
            "$push": {"notes": {"$each": [entry], "$slice": -100}},
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


async def search_notes(db, user_id: str, query: str) -> List[Dict[str, Any]]:
    """Search notes by text content (case-insensitive)."""
    doc = await get_user_memory(db, user_id)
    notes = doc.get("notes", [])
    if not query:
        return notes
    q = query.lower()
    return [n for n in notes if q in n.get("text", "").lower()]


async def get_notes_by_category(
    db, user_id: str, category: str
) -> List[Dict[str, Any]]:
    """Get all notes of a specific category."""
    doc = await get_user_memory(db, user_id)
    notes = doc.get("notes", [])
    return [n for n in notes if n.get("category") == category]


async def get_notes_summary(db, user_id: str) -> Dict[str, Any]:
    """Get a summary of notes by category for the assistant."""
    doc = await get_user_memory(db, user_id)
    notes = doc.get("notes", [])
    by_cat: Dict[str, int] = {}
    for n in notes:
        cat = n.get("category", "general")
        by_cat[cat] = by_cat.get(cat, 0) + 1
    return {
        "total": len(notes),
        "by_category": by_cat,
        "recent": notes[-5:] if notes else [],
    }


# =====================================================
# SMART CATEGORY DETECTION
# =====================================================

def detect_category(text: str) -> str:
    """Automatically detect the best category for a note."""
    t = text.lower()

    # Ideas
    if any(w in t for w in [
        "idea", "se me ocurre", "podríamos", "podriamos",
        "habría que", "habria que", "qué tal si", "que tal si",
        "y si ", "propuesta", "concepto",
    ]):
        return "idea"

    # Clients / contacts
    if any(w in t for w in [
        "cliente", "empresa", "proveedor", "contacto",
        "reunión con", "reunion con", "llamar a",
    ]):
        return "cliente"

    # Projects
    if any(w in t for w in [
        "proyecto", "producto", "desarrollo", "sprint",
        "feature", "lanzamiento", "deploy", "versión",
    ]):
        return "proyecto"

    # Preferences
    if any(w in t for w in [
        "prefiero", "preferencia", "horario", "no me gusta",
        "me gusta", "siempre", "nunca", "costumbre",
    ]):
        return "preferencia"

    # Shopping / errands
    if any(w in t for w in [
        "comprar", "compra", "tienda", "supermercado",
        "farmacia", "recoger", "llevar", "traer",
    ]):
        return "recado"

    # Health / wellness
    if any(w in t for w in [
        "médico", "medico", "cita médica", "medicamento",
        "pastilla", "salud", "doctor", "dentista",
    ]):
        return "salud"

    return "general"


# =====================================================
# NOTE INTENT DETECTION (for assistant.py)
# =====================================================

NOTE_KEYWORDS = [
    # Memory / remember
    "recuerda que", "recuerda esto", "anota que", "apunta que",
    "no olvides que", "ten en cuenta que", "memoriza",
    "quiero que sepas", "mi preferencia es", "prefiero",
    # Ideas
    "tengo una idea", "se me ocurre", "se me ha ocurrido",
    "apúntame una idea", "apuntame una idea",
    "idea:", "nota:",
    # Quick notes
    "toma nota", "anota esto", "apunta esto",
    "guarda esto", "guárdame esto", "guardame esto",
    # Shopping / errands
    "añade a la lista", "apunta en la lista",
    "tengo que comprar", "necesito comprar",
]


def is_note_intent(text: str) -> bool:
    """Detect if the user wants to save a note/idea/memory."""
    t = text.lower().strip()
    return any(kw in t for kw in NOTE_KEYWORDS)


def extract_note_text(text: str) -> tuple[str, str]:
    """
    Extract the note content and detect category.
    Returns (note_text, category).
    """
    t_lower = text.lower().strip()

    # Find which keyword matched and extract text after it
    for kw in NOTE_KEYWORDS:
        if kw in t_lower:
            idx = t_lower.index(kw) + len(kw)
            note_text = text[idx:].strip().lstrip(",").lstrip(":").lstrip(".").strip()
            if note_text and len(note_text) >= 3:
                category = detect_category(note_text)
                return note_text, category

    # Fallback: use the whole text
    category = detect_category(text)
    return text.strip(), category


# =====================================================
# CONTEXT BUILDER (for prompts)
# =====================================================

CATEGORY_LABELS = {
    "proyecto": "Proyectos activos",
    "cliente": "Clientes clave",
    "preferencia": "Preferencias de trabajo",
    "idea": "Ideas guardadas",
    "recado": "Recados pendientes",
    "salud": "Salud",
    "general": "Notas generales",
}


def build_user_memory_context(memory: Dict[str, Any]) -> str:
    notes = memory.get("notes", [])
    if not notes:
        return ""

    by_cat: Dict[str, List[str]] = {}
    for n in notes:
        cat = n.get("category", "general")
        by_cat.setdefault(cat, []).append(n.get("text", ""))

    lines = ["Lo que debes recordar siempre sobre este usuario:"]
    for cat, label in CATEGORY_LABELS.items():
        if cat in by_cat:
            lines.append(f"\n{label}:")
            for text in by_cat[cat]:
                lines.append(f"  · {text}")

    return "\n".join(lines)