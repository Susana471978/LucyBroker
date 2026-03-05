from __future__ import annotations

from typing import Dict, Any, List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user
from backend.api.gmail import fetch_enriched_messages
from backend.core.database import db
from backend.services.executive_memory import set_memory, get_memory
from backend.services.contact_memory import get_all_contacts, build_contact_insight
from backend.services.ai_service import AIService, generate_llm_response

router = APIRouter(prefix="/assistant", tags=["Assistant"])

ai_service = AIService()


# =====================================================
# MODELOS
# =====================================================

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


class AssistantMessageAction(BaseModel):
    mode: str
    message_content: str
    audio_enabled: Optional[bool] = False


# =====================================================
# HELPERS
# =====================================================

def _build_inbox_context(items: list, counts: dict) -> str:
    lines = [
        f"- Total de correos: {counts['total']}",
        f"- Prioritarios: {counts['prioritarios']}",
        f"- En seguimiento: {counts['seguimiento']}",
        f"- Con adjuntos: {counts['adjuntos']}",
    ]
    top = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO"][:3]
    if top:
        lines.append("\nCorreos prioritarios destacados:")
        for item in top:
            email = item["email"]
            lines.append(f'  · De: {email.get("from_name", "")} — "{email.get("subject", "")}"')
    return "\n".join(lines)


def _build_contacts_context(contacts: list) -> str:
    if not contacts:
        return ""
    lines = ["Contactos frecuentes del usuario:"]
    for c in contacts[:5]:
        insight = build_contact_insight(c)
        if insight:
            lines.append(f"  · {insight}")
    return "\n".join(lines)


# =====================================================
# ENDPOINT PRINCIPAL — CEREBRO ÚNICO
# =====================================================

@router.post("", response_model=AssistantResponse)
async def assistant_endpoint(
    payload: AssistantMessage,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        user_text = payload.text or payload.message

        if not user_text:
            raise HTTPException(status_code=400, detail="Mensaje vacío")

        items = await fetch_enriched_messages(user, db, max_results=20)
        total = len(items)

        prioritarios = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO"]
        seguimiento = [i for i in items if i["priority"]["priority_label"] == "SEGUIMIENTO"]
        adjuntos = [i for i in items if i["email"].get("has_attachments", False)]

        counts = {
            "total": total,
            "prioritarios": len(prioritarios),
            "seguimiento": len(seguimiento),
            "adjuntos": len(adjuntos),
        }

        exec_memory = await get_memory(db, user["id"])
        contacts = await get_all_contacts(db, user["id"], limit=5)

        inbox_context = _build_inbox_context(items, counts)
        contacts_context = _build_contacts_context(contacts)

        last_action = exec_memory.get("last_action", "")
        last_focus = exec_memory.get("last_focus", "")
        memory_context = ""
        if last_action:
            memory_context = f"Última acción del usuario: {last_action}."
            if last_focus:
                memory_context += f" Estaba mirando: {last_focus}."

        # Detectar acciones UI
        actions: Optional[List[AssistantAction]] = None
        text_lower = user_text.lower()

        if any(k in text_lower for k in ["mensajes", "correos", "bandeja", "ir a mensajes"]):
            actions = [AssistantAction(type="go_to", payload={"screen": "messages"})]
        elif any(k in text_lower for k in ["resumen", "overview", "inicio", "panel"]):
            actions = [AssistantAction(type="go_to", payload={"screen": "overview"})]
        elif any(k in text_lower for k in ["prioritario", "urgente", "importante"]):
            actions = [AssistantAction(type="set_filter", payload={"priority": "PRIORITARIO"})]
        elif any(k in text_lower for k in ["seguimiento", "pendiente"]):
            actions = [AssistantAction(type="set_filter", payload={"priority": "SEGUIMIENTO"})]
        elif any(k in text_lower for k in ["adjunto", "archivo", "documento"]):
            actions = [AssistantAction(type="set_filter", payload={"has_attachment": True})]
        elif any(k in text_lower for k in ["todo", "todos", "limpiar", "ver todo"]):
            actions = [AssistantAction(type="clear_filters", payload={})]

        # Generar respuesta con LLM real
        prompt = f"""Eres SyntexIA Executive, el asistente inteligente de correo de {user.get('name', 'el usuario')}.

Personalidad: profesional, directo, conciso. Hablas como un asistente ejecutivo de confianza.
Siempre en español. Máximo 3 frases. Sin listas ni encabezados. Lenguaje natural y conversacional.

BANDEJA ACTUAL:
{inbox_context}

{contacts_context}

{memory_context}

El usuario dice: "{user_text}"

Responde de forma natural usando los datos reales de arriba.
Si pide navegar o filtrar, confirma la acción brevemente.
Si pide resumir o responder un correo concreto, dile que lo seleccione en la bandeja.
"""

        assistant_text = await generate_llm_response(prompt)

        try:
            await set_memory(
                db=db,
                user_id=user["id"],
                fields={
                    "last_action": "assistant_query",
                    "last_focus": text_lower[:50],
                    "last_intent": "ASSISTANT_QUERY",
                },
            )
        except Exception as mem_error:
            print("Executive memory save error:", mem_error)

        return AssistantResponse(
            assistant_text=assistant_text,
            actions=actions,
            status="ok",
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        print("Assistant error:", e)
        return AssistantResponse(
            assistant_text="No he podido procesar tu solicitud en este momento.",
            actions=None,
            status="error",
            timestamp=datetime.utcnow().isoformat(),
        )


# =====================================================
# ENDPOINT PARA ACCIONES SOBRE MENSAJES
# =====================================================

@router.post("/message")
async def assistant_message_endpoint(
    payload: AssistantMessageAction,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        if not payload.message_content:
            raise HTTPException(status_code=400, detail="Contenido vacío")

        if payload.mode == "summarize":
            prompt = f"""Resume el siguiente correo en máximo 4 frases.
Natural, claro y conversacional. Sin encabezados ni listas.

Correo:
{payload.message_content}
"""
            summary = await generate_llm_response(prompt)
            return {
                "type": "summary",
                "text": summary.strip(),
                "audio": payload.audio_enabled,
                "timestamp": datetime.utcnow().isoformat(),
            }

        elif payload.mode == "auto_reply":
            prompt = f"""Redacta una respuesta profesional, clara y concisa al siguiente correo.
Lista para enviar tal cual.

Correo:
{payload.message_content}
"""
            reply = await generate_llm_response(prompt)
            return {
                "type": "auto_reply",
                "text": reply.strip(),
                "audio": payload.audio_enabled,
                "timestamp": datetime.utcnow().isoformat(),
            }

        else:
            raise HTTPException(status_code=400, detail="Modo no válido")

    except Exception as e:
        print("Assistant message error:", e)
        raise HTTPException(status_code=500, detail="Error procesando el mensaje")