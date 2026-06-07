from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from backend.models import EmailEvent, EnrichedEmail
from backend.services.imap_client import fetch_recent_emails
from backend.services.processor import process_email
from backend.services.rules_engine import calculate_priority
from backend.utils.logger import get_logger

logger = get_logger("email_service")


async def get_enriched_emails(limit: int = 20) -> List[EnrichedEmail]:
    emails = fetch_recent_emails(limit=limit)
    result = []
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


def get_email_by_id(email_id: str) -> Optional[EmailEvent]:
    emails = fetch_recent_emails(limit=50)
    for e in emails:
        if e.id == email_id:
            return e
    return None


def get_email_stats(emails: List[EnrichedEmail]) -> Dict[str, int]:
    return {
        "total": len(emails),
        "prioritarios": len([e for e in emails if e.priority.priority_label == "ALTA"]),
        "seguimiento": len([e for e in emails if e.priority.priority_label == "MEDIA"]),
        "info": len([e for e in emails if e.priority.priority_label == "BAJA"]),
        "with_attachments": len([e for e in emails if e.email.has_attachments]),
    }
