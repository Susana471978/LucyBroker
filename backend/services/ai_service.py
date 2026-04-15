# backend/services/ai_service.py

from __future__ import annotations

from typing import List, Optional
import os

from backend.models import AIIntent, EmailEvent
from backend.utils.logger import get_logger
from backend.services.executive_client import update_executive_session

from openai import AsyncOpenAI
from backend.utils.guards import openai_breaker


class AIService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.logger = get_logger(self.__class__.__name__)

        if self.api_key:
            self.client = AsyncOpenAI(api_key=self.api_key)
        else:
            self.client = None

    # ======================================================
    # SUMMARIZE EMAIL
    # ======================================================

    async def summarize_email(
        self,
        email: EmailEvent,
        user_id: str,
        contact_insight: Optional[str] = None,   # ✅ NUEVO
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

        if self.client:
            try:
                # ✅ Incluir contexto del contacto si existe
                context_block = ""
                if contact_insight:
                    context_block = f"""
CONTEXTO DEL CONTACTO:
{contact_insight}

Ten en cuenta este contexto al resumir. Si hay acciones pendientes o el contacto es VIP, mencionarlo.
"""

                prompt = f"""
Resume este correo en 3 o 4 frases cortas.

Debe sonar natural, como si me lo contaras caminando.
Lenguaje claro, directo y humano.

No uses encabezados.
No enumeraciones.
No análisis.

Solo síntesis clara. Si hay una acción requerida, menciónala al final.
{context_block}
Correo:
{base_text}
"""

                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.4,
                    max_tokens=200,
                )

                summary = response.choices[0].message.content.strip()

            except Exception as exc:
                self.logger.error("LLM summarize failed, fallback active: %s", exc)

        # Fallback determinístico
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

        # Actualizar sesión ejecutiva
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

    # ======================================================
    # DRAFT REPLY
    # ======================================================

    async def draft_reply(
        self,
        user_id: str,
        email: EmailEvent,
        instructions: str,
        tone: str = "formal",
        contact_insight: Optional[str] = None,   # ✅ NUEVO
    ) -> List[str]:

        draft = None

        if self.client:
            try:
                # ✅ Incluir contexto del contacto si existe
                context_block = ""
                if contact_insight:
                    context_block = f"""
CONTEXTO DEL CONTACTO:
{contact_insight}

Usa este contexto para personalizar la respuesta. Respeta el tono preferido indicado.
"""

                tone_instruction = {
                    "formal": "Tono formal y profesional.",
                    "friendly": "Tono cercano y amigable pero profesional.",
                    "neutral": "Tono neutro y directo.",
                }.get(tone, "Tono formal y profesional.")

                prompt = f"""
Redacta una respuesta de correo electrónico.

{tone_instruction}
Clara, concisa y lista para enviar.
No añadas asunto ni encabezados extra.
{context_block}
CORREO ORIGINAL:
De: {email.from_name} <{email.from_email}>
Asunto: {email.subject}
Contenido:
{email.body}

INSTRUCCIONES DEL USUARIO:
{instructions or "Responde de forma apropiada al contenido del correo."}
"""

                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                    max_tokens=300,
                )

                draft = response.choices[0].message.content.strip()

            except Exception as exc:
                self.logger.error("LLM draft_reply failed: %s", exc)

        # Fallback determinístico
        if not draft:
            greeting = f"Estimado/a {email.from_name}," if email.from_name else "Hola,"
            body = instructions.strip() if instructions else "Gracias por tu mensaje."
            closing = {
                "formal": "Quedo atento/a a tu respuesta.\n\nSaludos cordiales.",
                "friendly": "Quedo pendiente.\n\nUn saludo.",
                "neutral": "Quedo a tu disposición.\n\nSaludos.",
            }.get(tone, "Saludos cordiales.")
            draft = f"{greeting}\n\n{body}\n\n{closing}"

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

    # ======================================================
    # AUTO REPLY
    # ======================================================

    async def auto_reply(
        self,
        email: EmailEvent,
        user_id: str,
        contact_insight: Optional[str] = None,   # ✅ NUEVO
    ) -> str:

        base_text = (email.body or email.snippet or "").strip()

        if not base_text:
            return "No se pudo generar respuesta porque el correo no contiene contenido legible."

        reply = None

        if self.client:
            try:
                # ✅ Incluir contexto del contacto si existe
                context_block = ""
                if contact_insight:
                    context_block = f"""
CONTEXTO DEL CONTACTO:
{contact_insight}

Personaliza la respuesta teniendo en cuenta el historial con este contacto.
"""

                prompt = f"""
Redacta una respuesta formal, profesional y clara al siguiente correo.
Debe ser concisa, directa y lista para enviarse tal cual.
No excesivamente larga.
{context_block}
Correo:
{base_text}
"""

                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                    max_tokens=250,
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


# ======================================================
# GENERIC LLM RESPONSE (usado por assistant.py)
# ======================================================

async def generate_llm_response(prompt: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        return "LLM no disponible (OPENAI_API_KEY no configurada)."

    if not openai_breaker.is_available():
        return "Servicio de IA temporalmente no disponible. Intenta en unos segundos."

    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=300,
        )
        openai_breaker.record_success()
        return response.choices[0].message.content.strip()
    except Exception as exc:
        openai_breaker.record_failure()
        raise exc