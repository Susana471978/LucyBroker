from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from backend.config import settings
from backend.models import EmailEvent, EnrichedEmail
from backend.services.imap_client import fetch_recent_emails
from backend.services.processor import process_email
from backend.services.rules_engine import calculate_priority
from backend.services.mensajes_service import (
    guardar_mensaje,
    listar_mensajes,
    obtener_mensaje,
)
from backend.utils.logger import get_logger

logger = get_logger("email_service")


async def sincronizar_imap(limit: int = 20) -> dict:
    """Trae lo nuevo de IMAP, lo enriquece y lo guarda.

    Solo se llama al sincronizar, no al leer la bandeja: enriquecer
    cuesta llamadas al modelo y el resultado no cambia.
    """
    enriquecidos = await _enriquecer_desde_imap(limit)
    nuevos = 0
    for enriched in enriquecidos:
        if await guardar_mensaje(enriched):
            nuevos += 1
    logger.info("Sincronizacion IMAP: %d revisados, %d nuevos", len(enriquecidos), nuevos)
    return {"revisados": len(enriquecidos), "nuevos": nuevos}


async def _enriquecer_desde_imap(limit: int = 20) -> List[EnrichedEmail]:
    result = []
    for cuenta in settings.imap_accounts:
        try:
            emails = fetch_recent_emails(cuenta=cuenta, limit=limit)
        except Exception as e:
            logger.error("Error conectando cuenta IMAP %s: %s", cuenta.buzon, e)
            continue
        for email_event in emails:
            try:
                ai_result = await process_email(email_event)
                priority = calculate_priority(email_event)
                # Sobreescribir score con el de Groq si está disponible
                if ai_result.get("score"):
                    priority.priority_score = ai_result["score"]
                if ai_result.get("prioridad"):
                    priority.priority_label = ai_result["prioridad"]

                enriched = EnrichedEmail(
                    email=email_event,
                    priority=priority,
                    categoria=ai_result.get("categoria", "OTRO"),
                    datos_clave=ai_result.get("datos_clave", {}),
                    resumen=ai_result.get("resumen", email_event.snippet),
                    borrador=ai_result.get("borrador", ""),
                )
                result.append(enriched)
            except Exception as e:
                logger.error("Error enriching email %s: %s", email_event.id, e)

    return sorted(result, key=lambda x: x.priority.priority_score, reverse=True)


async def get_enriched_emails(limit: int = 100, offset: int = 0, canal: Optional[str] = None, buzon: Optional[str] = None) -> List[dict]:
    """Bandeja: lee de Mongo, sin tocar IMAP ni el modelo."""
    return await listar_mensajes(canal=canal, buzon=buzon, limite=limit, offset=offset)


async def get_mensaje_by_id(mensaje_id: str) -> Optional[dict]:
    return await obtener_mensaje(mensaje_id)


def get_email_by_id(email_id: str) -> Optional[EmailEvent]:
    for cuenta in settings.imap_accounts:
        emails = fetch_recent_emails(cuenta=cuenta, limit=50)
        for e in emails:
            if e.id == email_id:
                return e
    return None


def get_email_stats(emails: List[dict]) -> Dict[str, int]:
    """Estadisticas sobre los documentos que devuelve Mongo."""
    def _label(e: dict) -> str:
        return (e.get("priority") or {}).get("priority_label", "")

    return {
        "total": len(emails),
        "prioritarios": len([e for e in emails if _label(e) in ("ALTA", "PRIORITARIO")]),
        "seguimiento": len([e for e in emails if _label(e) in ("MEDIA", "SEGUIMIENTO")]),
        "info": len([e for e in emails if _label(e) in ("BAJA", "INFO")]),
        "with_attachments": len([e for e in emails if (e.get("email") or {}).get("has_attachments")]),
    }
