from __future__ import annotations

import json
from groq import AsyncGroq

from backend.config import settings
from backend.models import EmailEvent
from backend.utils.logger import get_logger

logger = get_logger("processor")

SYSTEM_PROMPT = """Eres un experto en correduría de seguros en España, especializado en el mercado de Canarias. Trabajas para Objetiva Broker, una correduría en Santa Cruz de Tenerife.

Conoces perfectamente:
- Ramos: autos, hogar, vida, salud, decesos, responsabilidad civil, comercio, comunidades
- Aseguradoras en Canarias: Mapfre, Allianz, AXA, Generali, Zurich, Mutua Madrileña, Liberty, HDI, Caser, Pelayo, MGS, Fiatc, Reale, Nationale Nederlanden, Asisa, Sanitas, DKV
- Procesos: apertura de siniestros, peritación, liquidación, renovaciones, suplementos, rehabilitaciones
- Terminología: tomador, asegurado, beneficiario, franquicia, prima, vencimiento, cobertura, exclusión, parte de siniestro, declaración amistosa, perito, tramitador
- Plataformas: Avant2, Ebroker, Tesis
- Normativa: DGS, DGSFP, Ley 50/1980 de Contrato de Seguro

Analiza el correo y devuelve SOLO un JSON válido con esta estructura exacta:
{
  "categoria": "SINIESTRO" | "SOLICITUD_CLIENTE" | "DOCUMENTACION" | "POLIZA" | "ASEGURADORA" | "RENOVACION" | "IMPAGO" | "PROVEEDOR" | "SPAM" | "OTRO",
  "prioridad": "ALTA" | "MEDIA" | "BAJA",
  "score": numero entre 0 y 100,
  "datos_clave": {
    "cliente": "nombre completo del tomador/asegurado o null",
    "poliza": "numero de poliza si aparece o null",
    "aseguradora": "nombre de la aseguradora si aparece o null",
    "ramo": "auto|hogar|vida|salud|decesos|rc|comercio|comunidad|otro o null",
    "urgencia": "descripcion concisa de la urgencia o null",
    "fecha_limite": "fecha limite si se menciona o null"
  },
  "resumen": "resumen en 1-2 frases en espanol, conciso y profesional",
  "borrador": "respuesta profesional en espanol firmada como Objetiva Broker"
}

Reglas de clasificacion y prioridad:
- SINIESTRO: accidente, dano, robo, fallecimiento, hospitalizacion -> siempre ALTA (score 90-100)
- SOLICITUD_CLIENTE urgente (plazo, queja, rescision amenazada) -> ALTA (score 75-89)
- IMPAGO de recibo -> ALTA (score 70-84)
- RENOVACION proxima menos de 30 dias -> ALTA (score 70-79)
- SOLICITUD_CLIENTE normal -> MEDIA (score 50-69)
- DOCUMENTACION, POLIZA, ASEGURADORA -> MEDIA (score 35-59)
- RENOVACION con margen -> MEDIA (score 40-54)
- PROVEEDOR -> BAJA (score 20-34)
- SPAM, newsletters, publicidad -> BAJA (score 0-19)
- OTRO -> BAJA (score 10-29)

El borrador debe:
- Ser formal pero cercano, en espanol peninsular
- Identificar al cliente por su nombre si aparece
- Confirmar recepcion y siguiente paso concreto
- Nunca inventar datos de poliza o cobertura
- Firmarse siempre como: Atentamente, Objetiva Broker, Correduria de Seguros, Santa Cruz de Tenerife

Responde UNICAMENTE con el JSON valido, sin texto adicional, sin backticks."""


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
            max_tokens=1000,
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        result = json.loads(content)
        logger.info("Processed %s -> %s %s score=%s", email_event.id, result.get("categoria"), result.get("prioridad"), result.get("score"))
        return result
    except Exception as e:
        logger.error("Error processing email %s: %s", email_event.id, e)
        return _fallback(email_event)


def _fallback(email_event: EmailEvent) -> dict:
    subject_lower = email_event.subject.lower()
    if any(w in subject_lower for w in ["siniestro", "accidente", "urgente", "daño", "robo", "fallecimiento"]):
        categoria, prioridad, score = "SINIESTRO", "ALTA", 90
    elif any(w in subject_lower for w in ["impago", "recibo", "devuelto"]):
        categoria, prioridad, score = "IMPAGO", "ALTA", 75
    elif any(w in subject_lower for w in ["renovación", "vencimiento", "vence"]):
        categoria, prioridad, score = "RENOVACION", "MEDIA", 55
    elif any(w in subject_lower for w in ["póliza", "poliza", "suplemento"]):
        categoria, prioridad, score = "POLIZA", "MEDIA", 50
    elif any(w in subject_lower for w in ["unsubscribe", "newsletter", "promocion"]):
        categoria, prioridad, score = "SPAM", "BAJA", 10
    else:
        categoria, prioridad, score = "SOLICITUD_CLIENTE", "MEDIA", 45

    return {
        "categoria": categoria,
        "prioridad": prioridad,
        "score": score,
        "datos_clave": {
            "cliente": email_event.from_name,
            "poliza": None,
            "aseguradora": None,
            "ramo": None,
            "urgencia": None,
            "fecha_limite": None,
        },
        "resumen": email_event.snippet[:150] if email_event.snippet else email_event.subject,
        "borrador": f"Estimado/a {email_event.from_name.split()[0] if email_event.from_name else 'cliente'},\n\nGracias por contactar con nosotros. Hemos recibido su mensaje y nos pondremos en contacto con usted a la mayor brevedad posible.\n\nAtentamente,\nObjetiva Broker\nCorreduría de Seguros\nSanta Cruz de Tenerife"
    }
