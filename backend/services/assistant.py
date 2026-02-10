from __future__ import annotations

from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.services.gmail_reader import read_gmail_events
from backend.models import EmailEvent
from backend.server import get_current_user


router = APIRouter(prefix="/assistant", tags=["Assistant"])


# =========================
# MODELOS
# =========================

class AssistantMessage(BaseModel):
    text: str


class AssistantAction(BaseModel):
    type: str
    payload: Dict[str, Any]


class AssistantResponse(BaseModel):
    assistant_text: str
    actions: Optional[List[AssistantAction]] = None
    status: str = "ok"
    timestamp: str


# =========================
# HELPERS
# =========================

def build_executive_summary(events: List[EmailEvent]) -> Dict[str, Any]:
    total = len(events)

    prioritarios = [
        e for e in events if "IMPORTANT" in (e.labels or [])
    ]
    seguimiento = [
        e for e in events if "STARRED" in (e.labels or [])
    ]
    adjuntos = [
        e for e in events if e.has_attachments
    ]

    summary_text = []

    if total == 0:
        summary_text.append(
            "No tienes correos recientes. Todo está bajo control."
        )
    else:
        summary_text.extend([
            f"Tienes {total} correos recientes.",
            f"{len(prioritarios)} son prioritarios.",
            f"{len(seguimiento)} requieren seguimiento.",
            f"{len(adjuntos)} contienen archivos adjuntos.",
        ])

        if len(prioritarios) == 0:
            summary_text.append(
                "No hay nada crítico pendiente ahora mismo."
            )
        else:
            summary_text.append(
                "Hay correos importantes que requieren tu atención."
            )

    return {
        "text": " ".join(summary_text),
        "counts": {
            "total": total,
            "prioritarios": len(prioritarios),
            "seguimiento": len(seguimiento),
            "adjuntos": len(adjuntos),
        }
    }


def detect_actions(user_text: str, counts: Dict[str, int]) -> List[AssistantAction]:
    """
    Fase A2: propone acciones ejecutivas simples
    """
    text = user_text.lower()
    actions: List[AssistantAction] = []

    if "prioritario" in text or "importante" in text:
        if counts.get("prioritarios", 0) > 0:
            actions.append(
                AssistantAction(
                    type="navigate",
                    payload={
                        "path": "/app/messages",
                        "filter": "priority",
                    }
                )
            )

    if "adjunto" in text or "archivo" in text:
        if counts.get("adjuntos", 0) > 0:
            actions.append(
                AssistantAction(
                    type="navigate",
                    payload={
                        "path": "/app/messages",
                        "filter": "attachments",
                    }
                )
            )

    if "seguimiento" in text or "pendiente" in text:
        if counts.get("seguimiento", 0) > 0:
            actions.append(
                AssistantAction(
                    type="navigate",
                    payload={
                        "path": "/app/messages",
                        "filter": "followup",
                    }
                )
            )

    return actions


# =========================
# ENDPOINT
# =========================

@router.post("", response_model=AssistantResponse)
async def assistant_endpoint(
    payload: AssistantMessage,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        user_id = user["id"]
    except KeyError:
        raise HTTPException(status_code=401, detail="Usuario no válido")

    # 1. Leer correos reales desde Gmail
    events = read_gmail_events(
        user_id=user_id,
        max_results=25,
    )

    # 2. Resumen ejecutivo
    summary = build_executive_summary(events)

    # 3. Detectar acciones
    actions = detect_actions(
        user_text=payload.text,
        counts=summary["counts"],
    )

    return AssistantResponse(
        assistant_text=summary["text"],
        actions=actions or None,
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
    )
