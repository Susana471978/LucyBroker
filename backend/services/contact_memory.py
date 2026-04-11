from __future__ import annotations

"""
contact_memory.py — Memoria relacional por contacto

Diferenciador clave de ECS frente a Superhuman, Shortwave y Gemini.

En lugar de recordar solo la última sesión, ECS recuerda cada contacto:
- Cuántas veces ha escrito
- Sobre qué temas
- Qué tono prefiere el usuario al responderle
- Si está pendiente alguna acción
- Si es un contacto frecuente o VIP

Colección MongoDB: contact_memory
TTL: sin expiración (memoria permanente por contacto)
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

COLLECTION = "contact_memory"


# ======================================================
# HELPERS
# ======================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _contact_key(user_id: str, contact_email: str) -> Dict[str, str]:
    """Clave única: un registro por (usuario, contacto)"""
    return {
        "user_id": user_id,
        "contact_email": contact_email.lower().strip(),
    }


# ======================================================
# ÍNDICES (llamar en startup)
# ======================================================

async def ensure_contact_memory_indexes(db) -> None:
    """
    Crea índices necesarios.
    Llamar una vez en startup de FastAPI.
    """
    coll = db[COLLECTION]
    # Índice único por (user_id, contact_email)
    await coll.create_index(
        [("user_id", 1), ("contact_email", 1)],
        unique=True,
    )
    # Índice para buscar todos los contactos de un usuario
    await coll.create_index("user_id")
    # Índice para ordenar por frecuencia
    await coll.create_index("interaction_count")


# ======================================================
# GET — obtener memoria de un contacto
# ======================================================

async def get_contact_memory(
    db,
    user_id: str,
    contact_email: str,
) -> Optional[Dict[str, Any]]:
    """
    Devuelve la memoria completa de un contacto.
    Retorna None si no existe aún.
    """
    doc = await db[COLLECTION].find_one(
        _contact_key(user_id, contact_email),
        {"_id": 0},
    )
    return doc


# ======================================================
# UPDATE — registrar interacción con un contacto
# ======================================================

async def record_interaction(
    db,
    user_id: str,
    contact_email: str,
    contact_name: str,
    subject: str,
    action: str,                        # "read" | "summarize" | "draft_reply" | "auto_reply"
    topic_hint: Optional[str] = None,   # tema detectado (opcional)
    tone_used: Optional[str] = None,    # tono usado al responder
    is_vip: bool = False,
    has_pending_action: bool = False,
) -> Dict[str, Any]:
    """
    Registra una interacción con un contacto y actualiza su memoria.

    - Si el contacto no existe → lo crea
    - Si ya existe → actualiza contadores y contexto
    """
    now = _utcnow()
    key = _contact_key(user_id, contact_email)

    # Construir historial de interacción
    interaction_entry = {
        "action": action,
        "subject": subject,
        "timestamp": now,
    }
    if topic_hint:
        interaction_entry["topic"] = topic_hint
    if tone_used:
        interaction_entry["tone"] = tone_used

    update = {
        "$set": {
            "user_id": user_id,
            "contact_email": contact_email.lower().strip(),
            "contact_name": contact_name,
            "last_interaction_at": now,
            "last_subject": subject,
            "last_action": action,
            "is_vip": is_vip,
            "has_pending_action": has_pending_action,
            "updated_at": now,
        },
        "$setOnInsert": {
            "created_at": now,
            "topics": [],
            "preferred_tone": tone_used or "formal",
        },
        "$inc": {
            "interaction_count": 1,
        },
        "$push": {
            "recent_interactions": {
                "$each": [interaction_entry],
                "$slice": -10,   # guardar solo las últimas 10 interacciones
                "$sort": {"timestamp": -1},
            }
        },
    }

    # Añadir tema al array de temas si es nuevo
    if topic_hint:
        update["$addToSet"] = {"topics": topic_hint}

    # Actualizar tono preferido si se usó uno
    if tone_used:
        update["$set"]["preferred_tone"] = tone_used

    await db[COLLECTION].update_one(key, update, upsert=True)

    return await get_contact_memory(db, user_id, contact_email)


# ======================================================
# GET ALL — todos los contactos de un usuario
# ======================================================

async def get_all_contacts(
    db,
    user_id: str,
    limit: int = 50,
    only_vip: bool = False,
    only_pending: bool = False,
) -> List[Dict[str, Any]]:
    """
    Devuelve todos los contactos memorizados de un usuario,
    ordenados por frecuencia de interacción.
    """
    query: Dict[str, Any] = {"user_id": user_id}

    if only_vip:
        query["is_vip"] = True
    if only_pending:
        query["has_pending_action"] = True

    cursor = (
        db[COLLECTION]
        .find(query, {"_id": 0})
        .sort("interaction_count", -1)
        .limit(limit)
    )

    return await cursor.to_list(length=limit)


# ======================================================
# INSIGHT — resumen inteligente de un contacto
# ======================================================

def build_contact_insight(memory: Dict[str, Any]) -> str:
    """
    Genera un texto de contexto sobre un contacto
    para incluir en prompts de IA.

    Ejemplo de salida:
    "Carlos Mendoza (carlos@acme.com) ha escrito 5 veces.
     Temas habituales: contratos, pagos.
     Tono preferido: formal.
     Última interacción: hace 2 días sobre 'Revisión contrato Q1'."
    """
    if not memory:
        return ""

    name = memory.get("contact_name", "este contacto")
    email = memory.get("contact_email", "")
    count = memory.get("interaction_count", 1)
    topics = memory.get("topics", [])
    tone = memory.get("preferred_tone", "formal")
    last_subject = memory.get("last_subject", "")
    is_vip = memory.get("is_vip", False)
    has_pending = memory.get("has_pending_action", False)

    lines = [f"{name} ({email}) ha interactuado contigo {count} vez/veces."]

    if topics:
        lines.append(f"Temas habituales: {', '.join(topics[:5])}.")

    lines.append(f"Tono preferido en respuestas: {tone}.")

    if last_subject:
        lines.append(f"Último asunto: '{last_subject}'.")

    if is_vip:
        lines.append("Es un contacto VIP o cliente estratégico.")

    if has_pending:
        lines.append("⚠️ Hay una acción pendiente con este contacto.")

    return " ".join(lines)


# ======================================================
# MARK PENDING — marcar acción pendiente
# ======================================================

async def mark_pending_action(
    db,
    user_id: str,
    contact_email: str,
    pending: bool = True,
) -> None:
    """Marca o desmarca una acción pendiente con un contacto."""
    await db[COLLECTION].update_one(
        _contact_key(user_id, contact_email),
        {"$set": {"has_pending_action": pending, "updated_at": _utcnow()}},
    )


# ======================================================
# DELETE — borrar memoria de un contacto
# ======================================================

async def clear_contact_memory(
    db,
    user_id: str,
    contact_email: str,
) -> None:
    """Elimina toda la memoria de un contacto específico."""
    await db[COLLECTION].delete_one(
        _contact_key(user_id, contact_email)
    )