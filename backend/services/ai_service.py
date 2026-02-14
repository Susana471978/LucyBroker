from __future__ import annotations

from typing import List, Optional
import re

from models import AIIntent, EmailEvent
from utils.logger import get_logger
from services.local_llm_service import LocalLLMService


class AIService:
    def __init__(self):
        self.logger = get_logger(self.__class__.__name__)
        self.local_llm = LocalLLMService()

    # ======================================================
    # INTENT ENGINE (NO LLM)
    # ======================================================

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
            "clima", "weather", "historia", "history",
            "cocina", "recipe", "chiste", "joke",
            "música", "music", "película", "movie",
            "juego", "game", "deporte", "sport",
            "año", "year", "quien", "who",
            "qué es", "what is", "cómo funciona", "how does",
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
                "Puedo ayudarte a: ver correos prioritarios, filtrar por adjuntos, resumir mensajes "
                "o redactar respuestas. ¿Qué necesitas?"
            ),
            intent="HELP",
            ui_state="default",
            action={"type": "none", "payload": {}},
        )

    # ======================================================
    # SUMMARIZE EMAIL (LLM LOCAL + POST-PROCESADO ROBUSTO)
    # ======================================================

    async def summarize_email(self, email: EmailEvent) -> str:
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "Eres un asistente empresarial. "
                        "Resume el correo en exactamente 2 frases formales, claras y profesionales. "
                        "No añadas encabezados, plantillas ni texto adicional."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Correo:\n\n"
                        f"De: {email.from_name} <{email.from_email}>\n"
                        f"Asunto: {email.subject}\n\n"
                        f"{email.body}\n\n"
                        f"Resumen:"
                    ),
                },
            ]

            raw_text = await self.local_llm.chat(
                messages,
                max_tokens=150,
                temperature=0.05,
            )

            # -------------------------
            # POST-PROCESADO LIMPIO
            # -------------------------

            cleaned = raw_text.strip()

            # Eliminar bloques tipo plantilla
            cleaned = cleaned.split("Fraze")[0]
            cleaned = cleaned.split("Frase")[0]
            cleaned = cleaned.split("Subject:")[0]

            # Eliminar saltos de línea
            cleaned = cleaned.replace("\n", " ").strip()

            # Correcciones básicas frecuentes
            cleaned = cleaned.replace("Agradezamos", "Agradecemos")

            # Quitar espacios duplicados
            cleaned = re.sub(r"\s+", " ", cleaned)

            # Limitar a 2 frases reales
            sentences = re.split(r"\.\s+", cleaned)
            sentences = [s.strip() for s in sentences if s.strip()]

            final = ". ".join(sentences[:2])

            if final and not final.endswith("."):
                final += "."

            return final

        except Exception as exc:
            self.logger.error("Error summarizing email: %s", exc)
            return f"Resumen: {email.snippet}"

    # ======================================================
    # DRAFT REPLY (LLM LOCAL + LIMPIEZA)
    # ======================================================

    async def draft_reply(
        self,
        email: EmailEvent,
        instructions: str,
        tone: str = "professional",
    ) -> List[str]:
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        f"Eres un asistente que redacta respuestas de correo electrónico. "
                        f"Tono: {tone}. "
                        "Genera exactamente 2 versiones completas, profesionales y listas para enviar. "
                        "Responde únicamente con el texto de las respuestas."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Redacta 2 opciones de respuesta para este correo.\n\n"
                        f"CORREO ORIGINAL:\n"
                        f"De: {email.from_name} <{email.from_email}>\n"
                        f"Asunto: {email.subject}\n\n"
                        f"{email.body}\n\n"
                        f"INSTRUCCIONES DEL USUARIO:\n{instructions}\n\n"
                        "Separa ambas versiones usando únicamente '---'."
                    ),
                },
            ]

            response = await self.local_llm.chat(
                messages,
                max_tokens=350,
                temperature=0.3,
            )

            # Limpieza básica
            response = response.strip()
            response = response.replace("\n\n\n", "\n\n")

            drafts = response.split("---")
            drafts = [d.strip() for d in drafts if d.strip()]

            return drafts[:2] if drafts else [
                f"Estimado/a {email.from_name},\n\n"
                f"Gracias por su mensaje. {instructions}\n\n"
                f"Saludos cordiales."
            ]

        except Exception as exc:
            self.logger.error("Error drafting reply: %s", exc)
            return [
                f"Estimado/a {email.from_name},\n\n"
                f"Gracias por su mensaje. {instructions}\n\n"
                f"Saludos cordiales."
            ]
