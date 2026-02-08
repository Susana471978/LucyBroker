from __future__ import annotations

from typing import List, Optional

from backend.models import EmailEvent, EnrichedEmail
from backend.services.gmail_reader import read_gmail_events
from backend.services.rules_engine import calculate_priority


# ======================================================
# DOMAIN ADAPTER
# ======================================================

def enrich_events(events: List[EmailEvent]) -> List[EnrichedEmail]:
    """
    Aplica el motor de reglas a eventos de dominio EmailEvent
    y devuelve EnrichedEmail.
    """

    enriched: List[EnrichedEmail] = []

    for event in events:
        priority = calculate_priority(event)

        enriched.append(
            EnrichedEmail(
                email=event,
                priority=priority,
            )
        )

    return enriched


def fetch_enriched_gmail(
    user_id: str,
    max_results: int = 25,
    label: Optional[str] = None,
) -> List[EnrichedEmail]:
    """
    Punto único de entrada Gmail → Dominio enriquecido.
    """

    label_ids = [label] if label else None

    events = read_gmail_events(
        user_id=user_id,
        max_results=max_results,
        label_ids=label_ids,
    )

    return enrich_events(events)
