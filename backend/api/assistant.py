from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user
from backend.api.gmail import fetch_enriched_messages
from backend.api.calendar import fetch_today_events, _parse_event, CALENDAR_SCOPES
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
# HELPERS — CONTEXTO
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


def _build_calendar_context(events: list) -> str:
    if not events:
        return "Agenda de hoy: libre, sin eventos programados."
    lines = ["Agenda de hoy:"]
    for e in events:
        if e.get("all_day"):
            time_str = "Todo el día"
        else:
            raw = e.get("start", "")
            try:
                parsed = datetime.fromisoformat(raw)
                time_str = parsed.strftime("%H:%M")
            except Exception:
                time_str = raw[:16].replace("T", " ")
        attendees = ", ".join(e.get("attendees", [])[:3])
        line = f"  · {time_str} — {e.get('title', '')}"
        if attendees:
            line += f" (con {attendees})"
        if e.get("meet_link"):
            line += " [Google Meet]"
        lines.append(line)
    return "\n".join(lines)


def _build_tasks_context(tasks: list) -> str:
    if not tasks:
        return ""
    lines = ["Tareas pendientes:"]
    for t in tasks:
        due = f" · Vence: {t['due_date']}" if t.get("due_date") else ""
        priority_mark = " ⚡" if t.get("priority") == "high" else ""
        lines.append(f"  · {t['title']}{priority_mark}{due}")
    return "\n".join(lines)


# =====================================================
# DETECCIÓN DE INTENCIÓN — CREAR EVENTO
# =====================================================

_EVENT_ACTION_KEYWORDS = [
    "anota", "apunta", "crea", "añade", "agenda", "pon",
    "programa", "reserva", "bloquea", "mete", "agéndame",
    "apúntame", "ponme",
]

_EVENT_TYPE_KEYWORDS = [
    "reunión", "reunion", "meeting", "cita", "evento",
    "llamada", "call", "almuerzo", "comida", "visita",
]

_TIME_PATTERN = re.compile(
    r'\b('
    r'\d{1,2}[h:]\d{0,2}'          # 12h30, 12:30
    r'|mañana|pasado mañana'
    r'|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo'
    r'|enero|febrero|marzo|abril|mayo|junio'
    r'|julio|agosto|septiembre|octubre|noviembre|diciembre'
    r'|\d{1,2}\s+de\s+\w+'          # 5 de agosto
    r'|\d{1,2}/\d{1,2}'             # 5/8
    r')',
    re.IGNORECASE,
)


def _is_create_event_intent(text: str) -> bool:
    """
    Detecta si el usuario quiere crear un evento.
    Necesita: (keyword de acción O keyword de tipo evento) + referencia temporal.
    """
    t = text.lower()
    has_action = any(k in t for k in _EVENT_ACTION_KEYWORDS)
    has_type   = any(k in t for k in _EVENT_TYPE_KEYWORDS)
    has_time   = bool(_TIME_PATTERN.search(t))
    return (has_action or has_type) and has_time


async def _extract_event_data(user_text: str) -> Optional[Dict[str, Any]]:
    """
    Extrae los datos del evento desde lenguaje natural usando el LLM.
    Devuelve: title, date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM),
              location, description.
    """
    now = datetime.now(timezone.utc)
    today_str     = now.strftime("%Y-%m-%d")
    today_weekday = now.strftime("%A")  # Monday, Tuesday…

    prompt = f"""Eres un extractor de datos de eventos de calendario.
Hoy es {today_str} ({today_weekday}). Zona horaria: Europe/Madrid.
El usuario dice: "{user_text}"

Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional ni backticks.

Formato exacto:
{{
  "title": "nombre del evento",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "location": "",
  "description": ""
}}

Reglas:
- Si no hay hora de fin, suma 1 hora a la de inicio.
- "mañana" = {(now.replace(hour=0,minute=0,second=0,microsecond=0)).__class__.__name__} → calcula desde hoy.
- Si dice un día de la semana, calcula la PRÓXIMA ocurrencia desde hoy.
- Año: usa el más próximo futuro (si "5 de agosto" ya pasó en 2025, usa 2026).
- "12h30" o "12.30" o "12:30" = start_time "12:30".
- Si no hay título explícito, construye uno con las palabras clave (ej: "Reunión Macan").
- location y description pueden quedar vacíos.
"""

    raw = await generate_llm_response(prompt)
    clean = raw.strip().replace("```json", "").replace("```", "").strip()

    try:
        data = json.loads(clean)
        if data.get("date") and data.get("title"):
            return data
    except Exception:
        pass

    # Fallback: extraer JSON con regex por si el LLM añadió texto
    match = re.search(r'\{[^{}]+\}', clean, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if data.get("date") and data.get("title"):
                return data
        except Exception:
            pass

    return None


async def _create_calendar_event_direct(
    user: Dict[str, Any],
    event_data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Crea el evento directamente con las credenciales del usuario."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build as build_service

    tokens = user.get("calendar_tokens") or {}
    if not tokens.get("token"):
        return None

    try:
        creds = Credentials(
            token=tokens.get("token"),
            refresh_token=tokens.get("refresh_token"),
            token_uri=tokens.get("token_uri"),
            client_id=tokens.get("client_id"),
            client_secret=tokens.get("client_secret"),
            scopes=tokens.get("scopes") or CALENDAR_SCOPES,
        )
        service = build_service("calendar", "v3", credentials=creds)

        date       = event_data.get("date", "")
        start_time = event_data.get("start_time", "09:00")
        end_time   = event_data.get("end_time", "10:00")

        body: Dict[str, Any] = {
            "summary": event_data.get("title", "Evento"),
            "start": {"dateTime": f"{date}T{start_time}:00", "timeZone": "Europe/Madrid"},
            "end":   {"dateTime": f"{date}T{end_time}:00",   "timeZone": "Europe/Madrid"},
        }
        if event_data.get("description"):
            body["description"] = event_data["description"]
        if event_data.get("location"):
            body["location"] = event_data["location"]

        created = service.events().insert(calendarId="primary", body=body).execute()
        return _parse_event(created)

    except Exception as exc:
        print(f"[assistant] Error creating calendar event: {exc}")
        return None


def _format_event_confirmation(
    event_data: Dict[str, Any],
    created: Optional[Dict[str, Any]],
) -> str:
    """Genera la respuesta hablada de confirmación."""
    title      = event_data.get("title", "el evento")
    date       = event_data.get("date", "")
    start_time = event_data.get("start_time", "")
    location   = event_data.get("location", "")

    # Fecha en español
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        months = [
            "enero","febrero","marzo","abril","mayo","junio",
            "julio","agosto","septiembre","octubre","noviembre","diciembre",
        ]
        days = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
        date_str = f"el {days[dt.weekday()]} {dt.day} de {months[dt.month - 1]}"
    except Exception:
        date_str = f"el {date}"

    if created:
        parts = [f"Anotado. {title} {date_str}"]
        if start_time:
            parts.append(f"a las {start_time}")
        if location:
            parts.append(f"en {location}")
        return ", ".join(parts) + ". Ya está en tu calendario."
    else:
        return (
            "No he podido crear el evento. "
            "Comprueba que tu calendario está conectado en ajustes."
        )


# =====================================================
# ENDPOINT PRINCIPAL
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

        # ── INTENCIÓN: crear evento en calendario ──────────────────────────
        if _is_create_event_intent(user_text):
            if not user.get("calendar_connected"):
                return AssistantResponse(
                    assistant_text=(
                        "Me encantaría anotar eso, pero tu calendario no está conectado todavía. "
                        "Puedes conectarlo desde la sección de ajustes."
                    ),
                    actions=None,
                    status="ok",
                    timestamp=datetime.utcnow().isoformat(),
                )

            event_data = await _extract_event_data(user_text)
            if event_data:
                created = await _create_calendar_event_direct(user, event_data)
                text    = _format_event_confirmation(event_data, created)
                actions = None
                if created:
                    actions = [AssistantAction(
                        type="calendar_event_created",
                        payload={"event": created},
                    )]
                return AssistantResponse(
                    assistant_text=text,
                    actions=actions,
                    status="ok",
                    timestamp=datetime.utcnow().isoformat(),
                )
            # Si el LLM no pudo extraer datos, caer al flujo normal
            # (Lucy pedirá que concrete)

        # ── FLUJO NORMAL — briefing y respuestas generales ────────────────
        items = await fetch_enriched_messages(user, db, max_results=20)
        total = len(items)

        prioritarios = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO"]
        seguimiento  = [i for i in items if i["priority"]["priority_label"] == "SEGUIMIENTO"]
        adjuntos     = [i for i in items if i["email"].get("has_attachments", False)]

        counts = {
            "total": total,
            "prioritarios": len(prioritarios),
            "seguimiento":  len(seguimiento),
            "adjuntos":     len(adjuntos),
        }

        exec_memory = await get_memory(db, user["id"])
        contacts    = await get_all_contacts(db, user["id"], limit=5)

        calendar_events  = await fetch_today_events(user)
        calendar_context = _build_calendar_context(calendar_events)

        try:
            from backend.api.tasks import get_pending_tasks
            pending_tasks = await get_pending_tasks(user["id"])
        except Exception:
            pending_tasks = []
        tasks_context = _build_tasks_context(pending_tasks)

        inbox_context    = _build_inbox_context(items, counts)
        contacts_context = _build_contacts_context(contacts)

        last_action = exec_memory.get("last_action", "")
        last_focus  = exec_memory.get("last_focus", "")
        memory_context = ""
        if last_action:
            memory_context = f"Última acción del usuario: {last_action}."
            if last_focus:
                memory_context += f" Estaba mirando: {last_focus}."

        # Detectar acciones de navegación UI
        actions: Optional[List[AssistantAction]] = None
        text_lower = user_text.lower()

        if any(k in text_lower for k in ["mensajes", "correos", "bandeja", "ir a mensajes"]):
            actions = [AssistantAction(type="go_to", payload={"screen": "messages"})]
        elif any(k in text_lower for k in ["tareas", "pendientes", "ir a tareas"]):
            actions = [AssistantAction(type="go_to", payload={"screen": "tasks"})]
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

        tasks_block = f"\n{tasks_context}" if tasks_context else ""

        # Fecha actual para que Lucy no confunda días
        now_madrid = datetime.now(timezone.utc)
        try:
            from zoneinfo import ZoneInfo
            now_madrid = datetime.now(ZoneInfo("Europe/Madrid"))
        except Exception:
            pass
        _months = ["enero","febrero","marzo","abril","mayo","junio",
                   "julio","agosto","septiembre","octubre","noviembre","diciembre"]
        _days   = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
        today_label = f"{_days[now_madrid.weekday()]} {now_madrid.day} de {_months[now_madrid.month-1]} de {now_madrid.year}"
        today_iso   = now_madrid.strftime("%Y-%m-%d")

        prompt = f"""Eres Lucy, la secretaria personal ejecutiva de {user.get('name', 'el usuario')}.

HOY ES: {today_label} ({today_iso}). Usa siempre esta fecha como referencia. Nunca confundas fechas pasadas con hoy.

Personalidad: elegante, directa, concisa. Hablas como una secretaria de confianza de alto nivel.
Siempre en español. Máximo 3 frases. Sin listas ni encabezados. Lenguaje natural y conversacional.
Cuando des el briefing matutino, integra correos, agenda y tareas pendientes en un resumen fluido.
Si el usuario dice "buenos días" o saluda, responde al saludo primero y luego da el briefing del día.

BANDEJA ACTUAL:
{inbox_context}

{calendar_context}
{tasks_block}
{contacts_context}

{memory_context}

El usuario dice: "{user_text}"

Responde de forma natural usando los datos reales de arriba.
Si pide el briefing, dale un resumen integrado de correos, agenda y tareas del día.
Si pide navegar o filtrar, confirma la acción brevemente.
Si pide resumir o responder un correo concreto, dile que lo seleccione en la bandeja.
Si menciona tareas, resume las pendientes o indícale que vaya a la sección de tareas.
Si pide crear un evento pero no hay datos suficientes, pídele que concrete fecha y hora.
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