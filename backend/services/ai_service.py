from __future__ import annotations

from typing import List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

from backend.config import settings
from backend.models import AIIntent, EmailEvent
from backend.utils.logger import get_logger


class AIService:
    def __init__(self):
        self.api_key = settings.emergent_llm_key
        self.logger = get_logger(self.__class__.__name__)

    async def process_intent(self, message: str, context: Optional[str] = None) -> AIIntent:
        message_lower = message.lower()

        if any(kw in message_lower for kw in ["prioritario", "importante", "urgente", "priority", "urgent"]):
            return AIIntent(
                assistant_text="Mostrando correos prioritarios que requieren tu atención inmediata.",
                intent="SHOW_PRIORITARIOS",
                ui_state="filter_priority",
                action={"type": "filter", "payload": {"label": "PRIORITARIO"}},
            )

        if any(kw in message_lower for kw in ["seguimiento", "pendiente", "follow", "pending"]):
            return AIIntent(
                assistant_text="Mostrando correos que requieren seguimiento.",
                intent="SHOW_SEGUIMIENTO",
                ui_state="filter_followup",
                action={"type": "filter", "payload": {"label": "SEGUIMIENTO"}},
            )

        if any(kw in message_lower for kw in ["adjunto", "attachment", "archivo", "documento", "pdf"]):
            return AIIntent(
                assistant_text="Filtrando correos con archivos adjuntos.",
                intent="FILTER_ATTACHMENTS",
                ui_state="filter_attachments",
                action={"type": "filter", "payload": {"has_attachments": True}},
            )

        if any(kw in message_lower for kw in ["resumen", "resume", "summary", "resumir"]):
            return AIIntent(
                assistant_text="Selecciona un correo para generar su resumen.",
                intent="SUMMARIZE_SELECTED",
                ui_state="await_selection",
                action={"type": "prompt_selection", "payload": {}},
            )

        if any(kw in message_lower for kw in ["responder", "reply", "contestar", "redactar", "borrador", "draft"]):
            return AIIntent(
                assistant_text="¿Sobre qué correo te ayudo a redactar una respuesta?",
                intent="DRAFT_REPLY",
                ui_state="await_selection",
                action={"type": "prompt_selection", "payload": {}},
            )

        if any(kw in message_lower for kw in ["todo", "all", "completo", "ver todo", "mostrar todo"]):
            return AIIntent(
                assistant_text="Mostrando todos los correos ordenados por prioridad.",
                intent="SHOW_ALL",
                ui_state="default",
                action={"type": "filter", "payload": {"label": None}},
            )

        if any(kw in message_lower for kw in ["info", "información", "informativo", "newsletter"]):
            return AIIntent(
                assistant_text="Mostrando correos informativos de baja prioridad.",
                intent="SHOW_INFO",
                ui_state="filter_info",
                action={"type": "filter", "payload": {"label": "INFO"}},
            )

        out_of_scope_keywords = [
            "clima",
            "weather",
            "historia",
            "history",
            "cocina",
            "recipe",
            "chiste",
            "joke",
            "música",
            "music",
            "película",
            "movie",
            "juego",
            "game",
            "deporte",
            "sport",
            "año",
            "year",
            "quien",
            "who",
            "qué es",
            "what is",
            "cómo funciona",
            "how does",
        ]

        if any(kw in message_lower for kw in out_of_scope_keywords):
            return AIIntent(
                assistant_text=(
                    "Estoy diseñada para ayudarte con correos: priorizar, resumir y redactar respuestas. "
                    "Indícame qué mensajes quieres ver o qué respuesta necesitas."
                ),
                intent="OUT_OF_SCOPE",
                ui_state="default",
                action={"type": "none", "payload": {}},
            )

        return AIIntent(
            assistant_text=(
                "Puedo ayudarte a: ver correos prioritarios, filtrar por adjuntos, resumir mensajes o redactar respuestas. "
                "¿Qué necesitas?"
            ),
            intent="HELP",
            ui_state="default",
            action={"type": "none", "payload": {}},
        )

    async def summarize_email(self, email: EmailEvent) -> str:
        if not self.api_key:
            self.logger.warning("EMERGENT_LLM_KEY not configured; using snippet fallback")
            return f"Resumen: {email.snippet}"

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"summary-{email.id}",
                system_message=(
                    "Eres un asistente especializado en resumir correos electrónicos de forma concisa y clara. "
                    "Tu objetivo es extraer los puntos clave en máximo 3 oraciones. "
                    "Responde siempre en español."
                ),
            ).with_model("openai", "gpt-5.2")

            user_message = UserMessage(
                text=(
                    "Resume este correo en máximo 3 oraciones claras:\n\n"
                    f"De: {email.from_name} <{email.from_email}>\n"
                    f"Asunto: {email.subject}\n"
                    f"Contenido:\n{email.body}\n\n"
                    "Resume los puntos clave y acciones requeridas."
                )
            )

            response = await chat.send_message(user_message)
            return response
        except Exception as exc:
            self.logger.error("Error summarizing email: %s", exc)
            return f"Resumen: {email.snippet}"

    async def draft_reply(self, email: EmailEvent, instructions: str, tone: str = "professional") -> List[str]:
        if not self.api_key:
            self.logger.warning("EMERGENT_LLM_KEY not configured; using fallback")
            return [
                f"Estimado/a {email.from_name},\n\nGracias por su mensaje. {instructions}\n\nSaludos cordiales."
            ]

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"draft-{email.id}",
                system_message=(
                    "Eres un asistente que redacta respuestas de correo electrónico. "
                    f"Tono: {tone}. "
                    "Genera respuestas claras, concisas y profesionales. "
                    "Responde siempre en español."
                ),
            ).with_model("openai", "gpt-5.2")

            user_message = UserMessage(
                text=(
                    "Redacta 2 opciones de respuesta para este correo:\n\n"
                    "CORREO ORIGINAL:\n"
                    f"De: {email.from_name} <{email.from_email}>\n"
                    f"Asunto: {email.subject}\n"
                    f"Contenido:\n{email.body}\n\n"
                    "INSTRUCCIONES DEL USUARIO:\n"
                    f"{instructions}\n\n"
                    "Genera 2 versiones diferentes de respuesta, separadas por '---'. "
                    "Cada respuesta debe ser completa y lista para enviar."
                )
            )

            response = await chat.send_message(user_message)
            drafts = response.split("---")
            return [d.strip() for d in drafts if d.strip()][:2]
        except Exception as exc:
            self.logger.error("Error drafting reply: %s", exc)
            return [
                f"Estimado/a {email.from_name},\n\nGracias por su mensaje. {instructions}\n\nSaludos cordiales."
            ]