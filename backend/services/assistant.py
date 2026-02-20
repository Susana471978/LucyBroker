from __future__ import annotations

from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.server import get_current_user
from backend.api.gmail import fetch_enriched_messages


router = APIRouter(prefix="/assistant", tags=["Assistant"])


# =========================
# MODELOS
# =========================

class AssistantMessage(BaseModel):
    text: Optional[str] = None
    message: Optional[str] = None


class AssistantAction(BaseModel):
    type: str
    payload: Dict[str, Any]


class AssistantResponse(BaseModel):
    assistant_text: str
    actions: Optional[List[AssistantAction]] = None
    status: str = "ok"
    timestamp: str


# =========================
# ENDPOINT
# =========================

@router.post("", response_model=AssistantResponse)
async def assistant_endpoint(
    payload: AssistantMessage,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        user_text = payload.text or payload.message

        if not user_text:
            raise HTTPException(status_code=400, detail="Mensaje vacío")

        # 🔥 MISMA FUNCIÓN QUE USA EL DASHBOARD
        items = await fetch_enriched_messages(user, max_results=25)

        total = len(items)

        prioritarios = [
            i for i in items
            if i["priority"]["priority_label"] == "PRIORITARIO"
        ]

        seguimiento = [
            i for i in items
            if i["priority"]["priority_label"] == "SEGUIMIENTO"
        ]

        adjuntos = [
            i for i in items
            if i["email"].get("has_attachments", False)
        ]

        counts = {
            "total": total,
            "prioritarios": len(prioritarios),
            "seguimiento": len(seguimiento),
            "adjuntos": len(adjuntos),
        }

        text_lower = user_text.lower()

        if "prioritario" in text_lower or "importante" in text_lower:
            if counts["prioritarios"] > 0:
                assistant_text = f"Tienes {counts['prioritarios']} correos prioritarios."
            else:
                assistant_text = "No tienes correos prioritarios."

        elif "seguimiento" in text_lower or "pendiente" in text_lower:
            if counts["seguimiento"] > 0:
                assistant_text = f"Tienes {counts['seguimiento']} correos en seguimiento."
            else:
                assistant_text = "No tienes correos en seguimiento."

        elif "adjunto" in text_lower or "archivo" in text_lower:
            if counts["adjuntos"] > 0:
                assistant_text = f"Tienes {counts['adjuntos']} correos con adjuntos."
            else:
                assistant_text = "No tienes correos con adjuntos."

        else:
            assistant_text = (
                f"Tienes {total} correos. "
                f"{counts['prioritarios']} prioritarios. "
                f"{counts['seguimiento']} en seguimiento. "
                f"{counts['adjuntos']} con adjuntos."
            )

        return AssistantResponse(
            assistant_text=assistant_text,
            actions=None,
            status="ok",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        print("Assistant error:", e)

        return AssistantResponse(
            assistant_text="No he podido analizar tu bandeja en este momento.",
            actions=None,
            status="error",
            timestamp=datetime.utcnow().isoformat(),
        )
