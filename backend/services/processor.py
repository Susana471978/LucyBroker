from __future__ import annotations

import json
from typing import Optional
from groq import AsyncGroq

from backend.config import settings
from backend.models import EmailEvent
from backend.utils.logger import get_logger

logger = get_logger("processor")

SYSTEM_PROMPT = """Eres un asistente especializado en correduría de seguros española.
Analiza correos electrónicos y devuelve SOLO un JSON válido con esta estructura exacta:
{
  "categoria": "SINIESTRO" | "SOLICITUD_CLIENTE" | "DOCUMENTACION" | "POLIZA" | "PROVEEDOR" | "OTRO",
  "prioridad": "ALTA" | "MEDIA" | "BAJA",
  "score": número entre 0 y 100,
  "datos_clave": {
    "cliente": "nombre si aparece o null",
    "poliza": "número de póliza si aparece o null",
    "aseguradora": "nombre si aparece o null",
    "urgencia": "descripción breve de la urgencia o null"
  },
  "resumen": "resumen en 1-2 frases",
  "borrador": "respuesta profesional lista para enviar en español"
}

Reglas de prioridad:
- SINIESTRO siempre es ALTA (score 85-100)
- SOLICITUD_CLIENTE urgente es ALTA (score 70-84)
- SOLICITUD_CLIENTE normal es MEDIA (score 50-69)
- DOCUMENTACION y POLIZA son MEDIA (score 40-59)
- PROVEEDOR y OTRO son BAJA (score 0-39)

Responde ÚNICAMENTE con el JSON, sin texto adicional."""


async def process_email(email_event: EmailEvent) -> dict:
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY not configured")
        return _fallback(email_event)

    try:
        client = AsyncGroq(api_key=settings.groq_api_key)
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Asunto: {email_event.subject}\nDe: {email_event.from_name} <{email_event.from_email}>\n\n{email_event.body[:2000]}"}
            ],
            max_tokens=800,
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        # Limpiar posibles backticks
        content = content.replace("```json", "").replace("```", "").strip()
        result = json.loads(content)
        logger.info("Processed email %s → %s %s", email_event.id, result.get("categoria"), result.get("prioridad"))
        return result
    except Exception as e:
        logger.error("Error processing email %s: %s", email_event.id, e)
        return _fallback(email_event)


def _fallback(email_event: EmailEvent) -> dict:
    subject_lower = email_event.subject.lower()
    if any(w in subject_lower for w in ["siniestro", "accidente", "urgente", "daño"]):
        categoria, prioridad, score = "SINIESTRO", "ALTA", 90
    elif any(w in subject_lower for w in ["póliza", "poliza", "renovación", "vencimiento"]):
        categoria, prioridad, score = "POLIZA", "MEDIA", 55
    else:
        categoria, prioridad, score = "SOLICITUD_CLIENTE", "MEDIA", 60

    return {
        "categoria": categoria,
        "prioridad": prioridad,
        "score": score,
        "datos_clave": {"cliente": email_event.from_name, "poliza": None, "aseguradora": None, "urgencia": None},
        "resumen": email_event.snippet[:150],
        "borrador": f"Estimado/a {email_event.from_name.split()[0]}, gracias por contactar con nosotros. Hemos recibido su mensaje y nos pondremos en contacto con usted a la mayor brevedad posible. Quedamos a su disposición para cualquier consulta adicional.\n\nAtentamente,\nObjectiva Correduría de Seguros"
    }
