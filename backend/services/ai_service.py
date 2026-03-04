from __future__ import annotations

from typing import List, Optional
import os

from backend.models import AIIntent, EmailEvent
from backend.utils.logger import get_logger
from backend.services.executive_client import update_executive_session

from openai import AsyncOpenAI


class AIService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.logger = get_logger(self.__class__.__name__)

        if self.api_key:
            self.client = AsyncOpenAI(api_key=self.api_key)
        else:
            self.client = None

    # =====================================================
    # SUMMARIZE EMAIL (Natural LLM + Fallback)
    # =====================================================

    async def summarize_email(
        self,
        email: EmailEvent,
        user_id: str,
    ) -> str:

        base_text = (
            getattr(email, "body_text", None)
            or email.body
            or email.snippet
            or ""
        ).strip()
        
        if not base_text:
            return "No se pudo generar un resumen porque el correo no contiene contenido legible."

        summary = None

        # -------------------------
        # LLM MODE (Natural)
        # -------------------------
        if self.client:
            try:
                prompt = f"""
            Resume este correo en 3 o 4 frases cortas.

            Debe sonar natural, como si me lo contaras caminando.
            Lenguaje claro, directo y humano.

            No uses encabezados.
            No enumeraciones.
            No análisis.

            Solo síntesis clara.

            Correo:
            {base_text}
            """

                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.4,
                    max_tokens=180,
                )

                summary = response.choices[0].message.content.strip()

            except Exception as exc:
                self.logger.error("LLM summarize failed, fallback active: %s", exc)

        # -------------------------
        # FALLBACK DETERMINISTIC
        # -------------------------
        if not summary:
            try:
                sentences = base_text.split(".")
                summary = ". ".join(sentences[:3]).strip()

                if not summary.endswith("."):
                    summary += "."

                if len(summary) > 500:
                    summary = summary[:500].rsplit(" ", 1)[0] + "..."
            except Exception:
                summary = email.snippet or "Resumen no disponible."

        # Update executive session
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
    # DRAFT REPLY (Editable)
    # =====================================================

    async def draft_reply(
        self,
        user_id: str,
        email: EmailEvent,
        instructions: str,
        tone: str = "formal",
    ) -> List[str]:

        greeting = f"Estimado/a {email.from_name}," if email.from_name else "Hola,"

        body_instruction = instructions.strip() if instructions else "Gracias por tu mensaje."

        if tone == "formal":
            closing = "Quedo atento/a a tu respuesta.\n\nSaludos cordiales."
        elif tone == "friendly":
            closing = "Quedo pendiente.\n\nUn saludo."
        else:
            closing = "Quedo a tu disposición.\n\nSaludos."

        draft = (
            f"{greeting}\n\n"
            f"{body_instruction}\n\n"
            f"{closing}"
        )

        try:
            await update_executive_session(
                user_id=user_id,
                fields={
                    "last_draft_content": draft,
                    "tone_preference": tone,
                    "last_action": "draft_reply",
                    "current_email_id": email.id,
                },
            )
        except Exception as e:
            self.logger.warning("Executive update failed: %s", e)

        return [draft]

    # =====================================================
    # AUTO REPLY (IA REAL)
    # =====================================================

    async def auto_reply(
        self,
        email: EmailEvent,
        user_id: str,
    ) -> str:

        base_text = (email.body or email.snippet or "").strip()

        if not base_text:
            return "No se pudo generar respuesta porque el correo no contiene contenido legible."

        reply = None

        if self.client:
            try:
                prompt = f"""
            Redacta una respuesta formal, profesional y clara al siguiente correo.
            Debe ser concisa, directa y adecuada para un entorno profesional.
            No excesivamente larga.
            Debe poder enviarse tal cual.

            Correo:
            {base_text}
            """

                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                    max_tokens=220,
                )

                reply = response.choices[0].message.content.strip()

            except Exception as exc:
                self.logger.error("LLM auto-reply failed: %s", exc)

        if not reply:
            reply = (
                "Gracias por tu mensaje.\n\n"
                "He recibido la información y la revisaré a la mayor brevedad posible.\n\n"
                "Quedo atento/a.\n\nSaludos."
            )

        try:
            await update_executive_session(
                user_id=user_id,
                fields={
                    "last_draft_content": reply,
                    "last_action": "auto_reply",
                    "current_email_id": email.id,
                },
            )
        except Exception as e:
            self.logger.warning("Executive update failed: %s", e)

        return reply