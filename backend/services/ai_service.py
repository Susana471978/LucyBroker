from __future__ import annotations

from typing import List, Optional

from groq import AsyncGroq

from backend.config import settings
from backend.models import AIIntent, EmailEvent
from backend.utils.logger import get_logger


class AIService:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.groq_api_key) if settings.groq_api_key else None
        self.model = "llama-3.3-70b-versatile"
        self.logger = get_logger(self.__class__.__name__)

    async def _chat(self, system: str, user: str) -> str:
        if not self.client:
            return "API key no configurada."
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=1000,
        )
        return response.choices[0].message.content.strip()

    async def process_intent(self, message: str, context: Optional[str] = None) -> AIIntent:
        message_lower = message.lower()

        if any(kw in message_lower for kw in ["prioritario", "importante", "urgente"]):
            return AIIntent(assistant_text="Mostrando correos prioritarios.", intent="SHOW_PRIORITARIOS", ui_state="filter_priority", action={"type": "filter", "payload": {"label": "PRIORITARIO"}})
        if any(kw in message_lower for kw in ["seguimiento", "pendiente"]):
            return AIIntent(assistant_text="Mostrando correos en seguimiento.", intent="SHOW_SEGUIMIENTO", ui_state="filter_followup", action={"type": "filter", "payload": {"label": "SEGUIMIENTO"}})
        if any(kw in message_lower for kw in ["adjunto", "archivo", "documento"]):
            return AIIntent(assistant_text="Filtrando correos con adjuntos.", intent="FILTER_ATTACHMENTS", ui_state="filter_attachments", action={"type": "filter", "payload": {"has_attachments": True}})
        if any(kw in message_lower for kw in ["resumen", "resumir"]):
            return AIIntent(assistant_text="Selecciona un correo para resumir.", intent="SUMMARIZE_SELECTED", ui_state="await_selection", action={"type": "prompt_selection", "payload": {}})
        if any(kw in message_lower for kw in ["responder", "contestar", "borrador"]):
            return AIIntent(assistant_text="¿Sobre qué correo redacto la respuesta?", intent="DRAFT_REPLY", ui_state="await_selection", action={"type": "prompt_selection", "payload": {}})
        if any(kw in message_lower for kw in ["todo", "ver todo", "mostrar todo"]):
            return AIIntent(assistant_text="Mostrando todos los correos.", intent="SHOW_ALL", ui_state="default", action={"type": "filter", "payload": {"label": None}})

        return AIIntent(assistant_text="Puedo ayudarte a priorizar, resumir o redactar respuestas. ¿Qué necesitas?", intent="HELP", ui_state="default", action={"type": "none", "payload": {}})

    async def summarize_email(self, email: EmailEvent) -> str:
        try:
            return await self._chat(
                system="Eres un asistente especializado en corredurías de seguros. Resume correos de forma concisa en máximo 3 oraciones. Responde siempre en español.",
                user=f"De: {email.from_name} <{email.from_email}>\nAsunto: {email.subject}\nContenido:\n{email.body}\n\nResume los puntos clave y acciones requeridas."
            )
        except Exception as exc:
            self.logger.error("Error summarizing: %s", exc)
            return f"Resumen: {email.snippet}"

    async def draft_reply(self, email: EmailEvent, instructions: str, tone: str = "professional") -> List[str]:
        try:
            response = await self._chat(
                system=f"Eres un asistente de correduría de seguros que redacta respuestas de correo. Tono: {tone}. Responde siempre en español.",
                user=f"Correo original:\nDe: {email.from_name} <{email.from_email}>\nAsunto: {email.subject}\nContenido:\n{email.body}\n\nInstrucciones: {instructions}\n\nRedacta 2 opciones de respuesta separadas por '---'."
            )
            drafts = response.split("---")
            return [d.strip() for d in drafts if d.strip()][:2]
        except Exception as exc:
            self.logger.error("Error drafting: %s", exc)
            return [f"Estimado/a {email.from_name},\n\nGracias por su mensaje. {instructions}\n\nSaludos cordiales."]
