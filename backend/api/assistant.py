from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user
from backend.api.gmail import fetch_enriched_messages
from backend.api.calendar import fetch_today_events, _parse_event, CALENDAR_SCOPES
from backend.api.habits import get_habits_summary
from backend.core.database import db
from backend.services.executive_memory import set_memory, get_memory
from backend.services.contact_memory import get_all_contacts, build_contact_insight
from backend.services.user_memory import get_user_memory, build_user_memory_context
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
# HELPERS — CONTEXTO MEJORADO
# =====================================================

def _build_inbox_context(items: list, counts: dict) -> str:
    lines = [
        f"Total: {counts['total']} correos en bandeja.",
        f"Prioritarios: {counts['prioritarios']} · Seguimiento: {counts['seguimiento']} · Con adjuntos: {counts['adjuntos']}",
    ]

    senders = Counter()
    for item in items:
        sender = item["email"].get("from_name", "") or item["email"].get("from_email", "")
        name_match = re.match(r'^"?([^"<]+)"?\s*<', sender)
        clean_name = name_match.group(1).strip() if name_match else sender.split("@")[0]
        senders[clean_name] += 1

    if senders:
        top_senders = senders.most_common(4)
        sender_summary = ", ".join(f"{name} ({count})" for name, count in top_senders)
        lines.append(f"Remitentes principales: {sender_summary}")

    top = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO"][:4]
    if top:
        lines.append("\nCorreos prioritarios:")
        for item in top:
            email = item["email"]
            sender = email.get("from_name", "") or email.get("from_email", "")
            name_match = re.match(r'^"?([^"<]+)"?\s*<', sender)
            clean = name_match.group(1).strip() if name_match else sender
            subject = email.get("subject", "(Sin asunto)")
            snippet = email.get("snippet", "")[:80]
            lines.append(f'  · {clean}: "{subject}" — {snippet}')

    follow = [i for i in items if i["priority"]["priority_label"] == "SEGUIMIENTO"][:3]
    if follow:
        follow_names = [
            (re.match(r'^"?([^"<]+)"?\s*<', i["email"].get("from_name", "")) or type("", (), {"group": lambda s, x: i["email"].get("from_name", "").split("@")[0]})).group(1).strip()
            for i in follow
        ]
        lines.append(f"\nEn seguimiento: {', '.join(follow_names)}")

    return "\n".join(lines)


def _build_contacts_context(contacts: list) -> str:
    if not contacts:
        return ""
    lines = ["Contactos frecuentes:"]
    for c in contacts[:5]:
        insight = build_contact_insight(c)
        if insight:
            lines.append(f"  · {insight}")
    return "\n".join(lines)


def _build_calendar_context(events: list) -> str:
    if not events:
        return "Agenda: día libre, sin reuniones ni eventos."

    meetings = [e for e in events if not e.get("all_day")]
    all_day = [e for e in events if e.get("all_day")]

    lines = [f"Agenda: {len(events)} evento{'s' if len(events) != 1 else ''} hoy."]

    if all_day:
        for e in all_day:
            lines.append(f"  · Todo el día: {e.get('title', '')}")

    if meetings:
        lines.append("  Reuniones/citas:")
        for e in meetings:
            raw = e.get("start", "")
            try:
                parsed = datetime.fromisoformat(raw)
                time_str = parsed.strftime("%H:%M")
            except Exception:
                time_str = raw[:16].replace("T", " ")

            attendees = e.get("attendees", [])[:3]
            line = f"    · {time_str} — {e.get('title', '')}"
            if attendees:
                line += f" (con {', '.join(attendees)})"
            if e.get("meet_link"):
                line += " [videollamada]"
            if e.get("location"):
                line += f" en {e['location']}"
            lines.append(line)

    return "\n".join(lines)


def _build_tasks_context(tasks: list) -> str:
    if not tasks:
        return ""

    high = [t for t in tasks if t.get("priority") == "high"]
    normal = [t for t in tasks if t.get("priority") != "high"]

    lines = [f"Tareas pendientes: {len(tasks)} total."]

    if high:
        lines.append("  Urgentes:")
        for t in high:
            due = f" (vence: {t['due_date']})" if t.get("due_date") else ""
            lines.append(f"    · {t['title']}{due}")

    if normal:
        for t in normal[:3]:
            due = f" (vence: {t['due_date']})" if t.get("due_date") else ""
            lines.append(f"  · {t['title']}{due}")
        if len(normal) > 3:
            lines.append(f"  ...y {len(normal) - 3} más.")

    return "\n".join(lines)


def _build_habits_context(summary: dict) -> str:
    habits = summary.get("habits", [])
    if not habits:
        return ""
    total = summary.get("total", 0)
    completed = summary.get("completed", 0)
    lines = [f"Hábitos del día: {completed}/{total} completados."]
    for h in habits:
        status = "✓" if h["completed_today"] else "pendiente"
        streak_txt = f" (racha: {h['streak']} días)" if h.get("streak", 0) >= 2 else ""
        lines.append(f"  · {h['icon']} {h['name']}: {status}{streak_txt}")
    if summary.get("all_done"):
        lines.append("  ¡Todos los hábitos completados hoy!")
    return "\n".join(lines)


def _get_service_status(user: Dict[str, Any], gmail_ok: bool, calendar_ok: bool) -> str:
    issues = []
    if not user.get("gmail_connected"):
        issues.append("correo no conectado")
    elif not gmail_ok:
        issues.append("correo con error de autenticación (necesita reconectar)")
    if not user.get("calendar_connected"):
        issues.append("agenda no conectada")
    elif not calendar_ok:
        issues.append("agenda con error de autenticación (necesita reconectar)")

    if issues:
        return f"AVISO: {', '.join(issues)}. Informa al usuario si pregunta por esos servicios."
    return ""


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
    r'\d{1,2}[h:]\d{0,2}'
    r'|mañana|pasado mañana'
    r'|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo'
    r'|enero|febrero|marzo|abril|mayo|junio'
    r'|julio|agosto|septiembre|octubre|noviembre|diciembre'
    r'|\d{1,2}\s+de\s+\w+'
    r'|\d{1,2}/\d{1,2}'
    r')',
    re.IGNORECASE,
)


def _is_create_event_intent(text: str) -> bool:
    t = text.lower()
    has_action = any(k in t for k in _EVENT_ACTION_KEYWORDS)
    has_type   = any(k in t for k in _EVENT_TYPE_KEYWORDS)
    has_time   = bool(_TIME_PATTERN.search(t))
    return (has_action or has_type) and has_time


async def _extract_event_data(user_text: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_str     = now.strftime("%Y-%m-%d")
    today_weekday = now.strftime("%A")

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
- "mañana" → calcula desde hoy.
- Si dice un día de la semana, calcula la PRÓXIMA ocurrencia desde hoy.
- Año: usa el más próximo futuro.
- "12h30" o "12.30" o "12:30" = start_time "12:30".
- Si no hay título explícito, construye uno con las palabras clave.
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
    title      = event_data.get("title", "el evento")
    date       = event_data.get("date", "")
    start_time = event_data.get("start_time", "")
    location   = event_data.get("location", "")

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
# BRIEFING DETECTION
# =====================================================

_BRIEFING_KEYWORDS = [
    "briefing", "buenos días", "buenos dias", "buen día", "buen dia",
    "dame mi briefing", "qué tengo hoy", "que tengo hoy",
    "cómo está mi día", "como esta mi dia", "resumen del día",
    "resumen matutino", "qué hay hoy", "que hay hoy",
    "hola lucy", "repite mi briefing",
]

def _is_briefing_request(text: str) -> bool:
    t = text.lower().strip()
    return any(k in t for k in _BRIEFING_KEYWORDS)


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

        # ── INTENCIÓN: crear recordatorio ──────────────────────────────────
        from backend.api.reminders import is_reminder_intent, extract_reminder_data
        if is_reminder_intent(user_text):
            reminder_data = await extract_reminder_data(user_text)
            if reminder_data:
                now_r = datetime.now(timezone.utc).isoformat()
                doc = {
                    "user_id": user["id"],
                    "text": reminder_data["text"],
                    "remind_at": reminder_data["remind_at"],
                    "done": False,
                    "notified": False,
                    "created_at": now_r,
                }
                result = await db.reminders.insert_one(doc)
                friendly = reminder_data.get("friendly_time", reminder_data["remind_at"])
                return AssistantResponse(
                    assistant_text=f"Listo. Te recordaré {reminder_data['text']} {friendly}.",
                    actions=[AssistantAction(
                        type="reminder_created",
                        payload={"id": str(result.inserted_id), "text": reminder_data["text"], "remind_at": reminder_data["remind_at"]},
                    )],
                    status="ok",
                    timestamp=datetime.utcnow().isoformat(),
                )
            else:
                return AssistantResponse(
                    assistant_text="¿A qué hora quieres que te lo recuerde?",
                    actions=None,
                    status="ok",
                    timestamp=datetime.utcnow().isoformat(),
                )

        # =====================================================
# BLOQUE PARA REEMPLAZAR EN assistant.py
# Busca: # ── INTENCIÓN: guardar en memoria ──
# Reemplaza TODO el bloque hasta el siguiente comentario: # ── RECOPILAR CONTEXTO ──
# =====================================================

        # ── INTENCIÓN: guardar nota / idea / memoria ───────────────────────
        from backend.services.user_memory import is_note_intent, extract_note_text, add_memory_note
        if is_note_intent(user_text):
            note_text, category = extract_note_text(user_text)

            if not note_text or len(note_text) < 3:
                return AssistantResponse(
                    assistant_text="¿Qué quieres que anote exactamente?",
                    actions=None,
                    status="ok",
                    timestamp=datetime.utcnow().isoformat(),
                )

            await add_memory_note(db, user["id"], note_text, category)

            # Respuesta según categoría
            responses = {
                "idea": f"Idea guardada: {note_text}. La tendré presente.",
                "cliente": f"Anotado sobre el cliente. Lo tendré en cuenta.",
                "proyecto": f"Anotado para el proyecto. Lo tendré presente.",
                "preferencia": f"Preferencia guardada. Lo recordaré.",
                "recado": f"Apuntado: {note_text}. Te lo recordaré.",
                "salud": f"Anotado. Lo tendré en cuenta.",
                "general": f"Anotado. Lo tendré en cuenta a partir de ahora.",
            }

            return AssistantResponse(
                assistant_text=responses.get(category, responses["general"]),
                actions=[AssistantAction(type="memory_saved", payload={"note": note_text, "category": category})],
                status="ok",
                timestamp=datetime.utcnow().isoformat(),
            )

        # ── RECOPILAR CONTEXTO ─────────────────────────────────────────────
        gmail_ok = True
        calendar_ok = True

        items = []
        if user.get("gmail_connected"):
            try:
                items = await fetch_enriched_messages(user, db, max_results=20)
            except Exception as e:
                gmail_ok = False
                print(f"[assistant] Gmail fetch error: {e}")

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

        calendar_events = []
        if user.get("calendar_connected"):
            try:
                calendar_events = await fetch_today_events(user)
            except Exception as e:
                calendar_ok = False
                print(f"[assistant] Calendar fetch error: {e}")

        exec_memory = await get_memory(db, user["id"])
        contacts    = await get_all_contacts(db, user["id"], limit=5)

        user_mem_doc = await get_user_memory(db, user["id"])
        user_memory_context = build_user_memory_context(user_mem_doc)

        try:
            from backend.api.tasks import get_pending_tasks
            pending_tasks = await get_pending_tasks(user["id"])
        except Exception:
            pending_tasks = []

        # Hábitos del día
        try:
            habits_summary = await get_habits_summary(user["id"])
        except Exception:
            habits_summary = {"habits": [], "completed": 0, "total": 0}

        # Construir bloques de contexto
        inbox_context    = _build_inbox_context(items, counts) if items else "Bandeja: sin correos disponibles."
        calendar_context = _build_calendar_context(calendar_events)
        tasks_context    = _build_tasks_context(pending_tasks)
        habits_context   = _build_habits_context(habits_summary)
        contacts_context = _build_contacts_context(contacts)
        service_status   = _get_service_status(user, gmail_ok, calendar_ok)

        last_action = exec_memory.get("last_action", "")
        last_focus  = exec_memory.get("last_focus", "")
        memory_context = ""
        if last_action:
            memory_context = f"Última acción: {last_action}."
            if last_focus:
                memory_context += f" Estaba en: {last_focus}."

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

        # ── FECHA ACTUAL ───────────────────────────────────────────────────
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

        hour = now_madrid.hour
        if hour < 12:
            time_of_day = "por la mañana"
        elif hour < 20:
            time_of_day = "por la tarde"
        else:
            time_of_day = "por la noche"

        # ── ELEGIR PROMPT SEGÚN INTENCIÓN ──────────────────────────────────
        is_briefing = _is_briefing_request(user_text)

        if is_briefing:
            prompt = f"""Eres Lucy, secretaria ejecutiva y asistente personal de {user.get('name', 'el usuario')}.

HOY: {today_label} ({today_iso}), {time_of_day}. Hora: {now_madrid.strftime("%H:%M")}.

Tu trabajo es dar un briefing completo, como haría una secretaria de confianza al empezar el día. Hablas con naturalidad, elegancia y cercanía profesional. Siempre en español.

ESTRUCTURA DEL BRIEFING (sigue este orden, integra todo en prosa fluida):
1. Saludo breve y cálido adaptado a la hora del día.
2. AGENDA: empieza siempre por las reuniones/eventos del día. Si hay videollamadas, menciónalo. Si el día está libre, dilo con tono positivo.
3. CORREOS: resumen de la bandeja. Destaca los prioritarios por nombre y asunto. Si hay muchos de un mismo remitente, agrúpalos. Menciona el total.
4. TAREAS: si hay tareas pendientes, menciónalas brevemente. Destaca las urgentes.
5. HÁBITOS: si hay hábitos registrados, menciona cuántos ha completado y cuáles faltan. Si hay rachas, celébralas. Si todos están hechos, felicita.
6. Cierre: una frase motivadora o práctica para arrancar el día.

DATOS REALES:
{calendar_context}

{inbox_context}

{tasks_context if tasks_context else "Sin tareas pendientes registradas."}

{habits_context if habits_context else "Sin hábitos registrados."}

{contacts_context}

{service_status}

{memory_context}

{user_memory_context}

REGLAS DE ESTILO:
- Prosa fluida y conversacional, NO listas ni viñetas.
- Máximo 8-10 frases. Sé concisa pero completa.
- Nombra personas y asuntos reales, no seas genérica.
- Si un servicio está desconectado, menciónalo con naturalidad.
- Si hay hábitos pendientes, anima a completarlos con tono motivador pero no presionante.
- Suena como alguien que conoce bien al usuario y su trabajo.
- NO inventes datos que no estén arriba.

El usuario dice: "{user_text}"
"""
        else:
            prompt = f"""Eres Lucy, secretaria ejecutiva y asistente personal de {user.get('name', 'el usuario')}.

HOY: {today_label} ({today_iso}). Hora: {now_madrid.strftime("%H:%M")}.

Personalidad: elegante, directa, concisa. Secretaria de confianza de alto nivel.
Siempre en español. Máximo 3-4 frases. Sin listas ni encabezados. Lenguaje natural.

DATOS DISPONIBLES:
{calendar_context}
{inbox_context}
{tasks_context}
{habits_context}
{contacts_context}
{service_status}
{memory_context}
{user_memory_context}

El usuario dice: "{user_text}"

Responde con los datos reales de arriba. No inventes información.
Si pide navegar o filtrar, confirma brevemente.
Si pide resumir un correo concreto, dile que lo seleccione en la bandeja.
Si menciona tareas, resume las pendientes o indícale la sección de tareas.
Si pregunta por hábitos, dile cuántos ha completado hoy y cuáles faltan.
Si pide crear un evento pero faltan datos, pídele que concrete.
"""

        # ── GENERAR RESPUESTA ──────────────────────────────────────────────
        max_tokens = 500 if is_briefing else 300

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            assistant_text = "No puedo procesar tu solicitud porque la configuración de IA no está disponible."
        else:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5 if is_briefing else 0.4,
                max_tokens=max_tokens,
            )
            assistant_text = response.choices[0].message.content.strip()

        # ── GUARDAR EN MEMORIA EJECUTIVA ───────────────────────────────────
        try:
            await set_memory(
                db=db,
                user_id=user["id"],
                fields={
                    "last_action": "briefing" if is_briefing else "assistant_query",
                    "last_focus": text_lower[:50],
                    "last_intent": "BRIEFING" if is_briefing else "ASSISTANT_QUERY",
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
            assistant_text="Disculpa, no he podido procesar tu solicitud en este momento. Inténtalo de nuevo.",
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
            prompt = f"""Resume este correo en máximo 4 frases.
Natural, claro y conversacional. Sin encabezados ni listas.
Solo síntesis clara. Si hay una acción requerida, menciónala al final.

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