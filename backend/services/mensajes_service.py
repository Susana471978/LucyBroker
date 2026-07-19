"""Persistencia de los mensajes de la bandeja.

Antes /emails leia de IMAP en cada peticion y reprocesaba todo con Groq,
asi que nada se guardaba: el estado no persistia y cada carga de la
bandeja costaba una tanda de llamadas al modelo. Aqui los mensajes viven
en Mongo, vengan de IMAP o de cualquier otro canal.

La deduplicacion es por `id`, que desde el arreglo de imap_client se
deriva del Message-ID y es estable entre sincronizaciones.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.db import db
from backend.models import EnrichedEmail
from backend.utils.logger import get_logger

logger = get_logger("mensajes_service")

COLECCION = "mensajes"


async def asegurar_indices() -> None:
    """Indices minimos. Idempotente, se puede llamar en cada arranque."""
    await db[COLECCION].create_index("id", unique=True)
    await db[COLECCION].create_index("canal")
    await db[COLECCION].create_index([("priority.priority_score", -1)])
    await db[COLECCION].create_index("estado")


async def guardar_mensaje(enriched: EnrichedEmail) -> bool:
    """Inserta el mensaje si no existe. Devuelve True si era nuevo.

    No sobreescribe los ya guardados: el enriquecimiento cuesta llamadas
    al modelo y el estado de lectura o respuesta se perderia.
    """
    doc = enriched.model_dump(mode="json")
    doc["canal"] = doc.get("email", {}).get("canal", "email")
    doc["estado"] = "nuevo"
    doc["creado_en"] = datetime.now(timezone.utc).isoformat()

    resultado = await db[COLECCION].update_one(
        {"id": enriched.email.id},
        {"$setOnInsert": doc},
        upsert=True,
    )
    return resultado.upserted_id is not None


async def listar_mensajes(
    canal: Optional[str] = None,
    label: Optional[str] = None,
    estado: Optional[str] = None,
    limite: int = 100,
) -> List[Dict[str, Any]]:
    """Mensajes ordenados por prioridad, con filtros opcionales."""
    filtro: Dict[str, Any] = {}
    if canal:
        filtro["canal"] = canal
    if label:
        filtro["priority.priority_label"] = label
    if estado:
        filtro["estado"] = estado

    cursor = (
        db[COLECCION]
        .find(filtro, {"_id": 0})
        .sort("priority.priority_score", -1)
        .limit(limite)
    )
    return await cursor.to_list(limite)


async def obtener_mensaje(mensaje_id: str) -> Optional[Dict[str, Any]]:
    return await db[COLECCION].find_one({"id": mensaje_id}, {"_id": 0})


async def actualizar_estado(mensaje_id: str, estado: str) -> bool:
    """Marca un mensaje como leido, respondido o archivado."""
    resultado = await db[COLECCION].update_one(
        {"id": mensaje_id},
        {"$set": {"estado": estado, "actualizado_en": datetime.now(timezone.utc).isoformat()}},
    )
    return resultado.modified_count > 0


async def estadisticas() -> Dict[str, Any]:
    """Totales por prioridad, canal y estado, en una sola consulta."""
    total = await db[COLECCION].count_documents({})

    async def _agrupar(campo: str) -> Dict[str, int]:
        cursor = db[COLECCION].aggregate(
            [{"$group": {"_id": f"${campo}", "n": {"$sum": 1}}}]
        )
        return {str(d["_id"]): d["n"] async for d in cursor}

    por_label = await _agrupar("priority.priority_label")
    return {
        "total": total,
        "prioritarios": por_label.get("ALTA", 0) + por_label.get("PRIORITARIO", 0),
        "seguimiento": por_label.get("MEDIA", 0) + por_label.get("SEGUIMIENTO", 0),
        "info": por_label.get("BAJA", 0) + por_label.get("INFO", 0),
        "por_canal": await _agrupar("canal"),
        "por_estado": await _agrupar("estado"),
    }
