from __future__ import annotations

from typing import List, Optional

from backend.core.settings import settings
from backend.models import AIIntent, EmailEvent
from backend.utils.logger import get_logger
from backend.services.executive_client import update_executive_session


class AIService:
    def __init__(self):
        # Ya no usamos API externa
        self.api_key = None
        self.logger = get_logger(self.__class__.__name__)

    async def process_intent(
        self,
        message: str,
        context: Optional[str] = None,
    ) -> AIIntent:
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

        return AIIntent(
            assistant_text=(
                "Puedo ayudarte a: ver correos prioritarios, filtrar por adjuntos, "
                "resumir mensajes o redactar respuestas. ¿Qué necesitas?"
            ),
            intent="HELP",
            ui_state="default",
            action={"type": "none", "payload": {}},
        )

    # =====================================================
    # SUMMARIZE EMAIL
    # =====================================================

    async def summarize_email(
        self,
        email: EmailEvent,
        user_id: str,
    ) -> str:
        """
        Genera un resumen simple del correo y sincroniza memoria viva en Executive Engine.
        Actualmente funciona en modo determinístico (sin LLM externo).
        """

        try:
            # --- Resumen determinístico simple ---
            base_text = email.body or email.snippet or ""
            base_text = base_text.strip()

            if not base_text:
                summary = "No se pudo generar un resumen porque el correo no contiene contenido legible."
            else:
                # Tomamos las primeras 3 frases o primeras 500 chars como resumen controlado
                sentences = base_text.split(".")
                summary = ". ".join(sentences[:3]).strip()

                if not summary.endswith("."):
                    summary += "."

                if len(summary) > 500:
                    summary = summary[:500].rsplit(" ", 1)[0] + "..."

        except Exception as exc:
            self.logger.error("Error summarizing email: %s", exc)
            summary = f"Resumen: {email.snippet}"

        # 🔵 Actualizar memoria viva en Executive
        try:
            await update_executive_session(
                user_id=user_id,
                fields={
                    "current_email_id": email.id,
                    "last_action": "summarize",
                    "last_draft_content": summary,
                },
            )
        except Exception as e:
            self.logger.warning("Executive memory update failed: %s", e)

        return summary
    

    # =====================================================
    # DRAFT REPLY
    # =====================================================

    async def draft_reply(
        self,
        user_id: str,
        email: EmailEvent,
        instructions: str,
        tone: str = "professional",
    ) -> List[str]:

        fallback_response = [
            f"Estimado/a {email.from_name},\n\n"
            f"Gracias por su mensaje. {instructions}\n\n"
            "Saludos cordiales."
        ]

        if not self.api_key:
            self.logger.warning("EMERGENT_LLM_KEY not configured; using fallback")

            try:
                await update_executive_session(
                    user_id=user_id,
                    fields={
                        "last_draft_content": fallback_response[0],
                        "tone_preference": tone,
                        "last_action": "draft_reply",
                        "current_email_id": email.id,
                    },
                )
            except Exception as e:
                self.logger.warning("Executive update failed (fallback): %s", e)

            return fallback_response

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
            drafts = [d.strip() for d in response.split("---") if d.strip()][:2]

            try:
                await update_executive_session(
                    user_id=user_id,
                    fields={
                        "last_draft_content": drafts[0] if drafts else "",
                        "tone_preference": tone,
                        "last_action": "draft_reply",
                        "current_email_id": email.id,
                    },
                )
            except Exception as e:
                self.logger.warning("Executive update failed: %s", e)

            return drafts if drafts else fallback_response

        except Exception as exc:
            self.logger.error("Error drafting reply: %s", exc)
            return fallback_response
