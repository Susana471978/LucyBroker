from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user
from backend.api.gmail import fetch_enriched_messages, fetch_enriched_messages_light
from backend.api.calendar import fetch_today_events, _parse_event, CALENDAR_SCOPES
from backend.api.habits import get_habits_summary
from backend.core.database import db
from backend.services.executive_memory import set_memory, get_memory
from backend.services.contact_memory import get_all_contacts, build_contact_insight
from backend.services.user_memory import get_user_memory, build_user_memory_context
from backend.services.ai_service import AIService, generate_llm_response
from backend.utils.logger import logger

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


def _get_lucy_role(user: Dict[str, Any]) -> str:
    from backend.core.plans import get_user_plan
    user_plan = get_user_plan(user)
    _has_executive = user_plan.get("executive_tier") is not None
    _has_personal = user_plan.get("personal_tier") is not None
    _is_admin = user_plan.get("is_admin", False)

    if _is_admin or (_has_executive and _has_personal):
        return "secretaria ejecutiva y asistente personal"
    elif _has_executive:
        return "secretaria ejecutiva"
    elif _has_personal:
        return "asistente personal"
    else:
        return "asistente"


def _get_now_madrid():
    now_madrid = datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        now_madrid = datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        pass
    return now_madrid


def _get_date_context():
    now = _get_now_madrid()
    _months = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"]
    _days = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
    today_label = f"{_days[now.weekday()]} {now.day} de {_months[now.month-1]} de {now.year}"
    today_iso = now.strftime("%Y-%m-%d")
    hour = now.hour
    time_of_day = "por la mañana" if hour < 12 else ("por la tarde" if hour < 20 else "por la noche")
    return now, today_label, today_iso, time_of_day


# =====================================================
# DETECCIÓN DE INTENCIONES RÁPIDAS
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
    has_type = any(k in t for k in _EVENT_TYPE_KEYWORDS)
    has_time = bool(_TIME_PATTERN.search(t))
    return (has_action or has_type) and has_time

_TASK_KEYWORDS = [
    "tarea", "pendiente", "to-do", "todo", "añade como tarea",
    "nueva tarea", "apunta como tarea", "tengo que", "hay que",
    "no olvidar hacer", "agregar tarea",
]

def _is_task_intent(text: str) -> bool:
    t = text.lower().strip()
    return any(kw in t for kw in _TASK_KEYWORDS)

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

# Navigation intents — no LLM needed, instant response
_NAV_INTENTS = {
    "messages": (["mensajes", "correos", "bandeja", "ir a mensajes", "mis correos", "ver correos"],
                 "Te llevo a tus mensajes.", "messages"),
    "tasks": (["tareas", "pendientes", "ir a tareas", "mis tareas", "ver tareas"],
              "Aquí tienes tus tareas.", "tasks"),
    "habits": (["hábitos", "habitos", "mis hábitos", "ver hábitos"],
               "Aquí están tus hábitos.", "habits"),
    "settings": (["ajustes", "configuración", "configuracion", "settings"],
                 "Te llevo a la configuración.", "settings"),
    "overview": (["resumen", "overview", "inicio", "panel", "dashboard"],
                 "Volvemos al panel principal.", "overview"),
}

def _detect_nav_intent(text: str):
    t = text.lower().strip()
    for key, (keywords, response, screen) in _NAV_INTENTS.items():
        if any(k in t for k in keywords):
            return response, screen
    return None, None


# =====================================================
# EVENT EXTRACTION + CREATION (unchanged)
# =====================================================

async def _extract_event_data(user_text: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
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
    from googleapiclient.discovery import build as build_service
    from backend.services.google_auth import get_valid_credentials

    creds = await get_valid_credentials(
        user, db, token_field="calendar_tokens", default_scopes=CALENDAR_SCOPES,
    )
    if creds is None:
        return None

    try:
        service = build_service("calendar", "v3", credentials=creds)
        date = event_data.get("date", "")
        start_time = event_data.get("start_time", "09:00")
        end_time = event_data.get("end_time", "10:00")

        body: Dict[str, Any] = {
            "summary": event_data.get("title", "Evento"),
            "start": {"dateTime": f"{date}T{start_time}:00", "timeZone": "Europe/Madrid"},
            "end": {"dateTime": f"{date}T{end_time}:00", "timeZone": "Europe/Madrid"},
        }
        if event_data.get("description"):
            body["description"] = event_data["description"]
        if event_data.get("location"):
            body["location"] = event_data["location"]

        created = service.events().insert(calendarId="primary", body=body).execute()
        return _parse_event(created)
    except Exception as exc:
        logger.error("Error creating calendar event: %s", exc)
        return None


def _format_event_confirmation(event_data: Dict[str, Any], created: Optional[Dict[str, Any]]) -> str:
    title = event_data.get("title", "el evento")
    date = event_data.get("date", "")
    start_time = event_data.get("start_time", "")
    location = event_data.get("location", "")

    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        _months = ["enero","febrero","marzo","abril","mayo","junio",
                    "julio","agosto","septiembre","octubre","noviembre","diciembre"]
        _days = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
        date_str = f"el {_days[dt.weekday()]} {dt.day} de {_months[dt.month - 1]}"
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
        return "No he podido crear el evento. Comprueba que tu calendario está conectado en ajustes."


# =====================================================
# ENDPOINT PRINCIPAL — OPTIMIZED
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

        now_ts = datetime.now(timezone.utc).isoformat()

        # ══════════════════════════════════════════════════════
        # FAST PATH — Instant intents (no LLM, no data fetch)
        # ══════════════════════════════════════════════════════

        # 1. Navigation intent
        nav_text, nav_screen = _detect_nav_intent(user_text)
        if nav_text and nav_screen:
            return AssistantResponse(
                assistant_text=nav_text,
                actions=[AssistantAction(type="go_to", payload={"screen": nav_screen})],
                status="ok",
                timestamp=now_ts,
            )

        # 2. Filter intents
        text_lower = user_text.lower()
        if any(k in text_lower for k in ["prioritario", "urgente", "importante"]):
            return AssistantResponse(
                assistant_text="Filtrando por correos prioritarios.",
                actions=[AssistantAction(type="set_filter", payload={"priority": "PRIORITARIO"})],
                status="ok", timestamp=now_ts,
            )
        if any(k in text_lower for k in ["adjunto", "archivo", "documento"]):
            return AssistantResponse(
                assistant_text="Filtrando correos con adjuntos.",
                actions=[AssistantAction(type="set_filter", payload={"has_attachment": True})],
                status="ok", timestamp=now_ts,
            )
        if any(k in text_lower for k in ["todo", "todos", "limpiar filtro", "ver todo"]):
            return AssistantResponse(
                assistant_text="Mostrando todos los correos.",
                actions=[AssistantAction(type="clear_filters", payload={})],
                status="ok", timestamp=now_ts,
            )

        # ══════════════════════════════════════════════════════
        # MEDIUM PATH — LLM-powered but no heavy data fetch
        # ══════════════════════════════════════════════════════

        # 3. Create calendar event
        if _is_create_event_intent(user_text):
            if not user.get("calendar_connected"):
                return AssistantResponse(
                    assistant_text="Me encantaría anotar eso, pero tu calendario no está conectado. Puedes conectarlo desde ajustes.",
                    actions=None, status="ok", timestamp=now_ts,
                )
            event_data = await _extract_event_data(user_text)
            if event_data:
                created = await _create_calendar_event_direct(user, event_data)
                text = _format_event_confirmation(event_data, created)
                actions = [AssistantAction(type="calendar_event_created", payload={"event": created})] if created else None
                return AssistantResponse(assistant_text=text, actions=actions, status="ok", timestamp=now_ts)

        # 4. Create task
        if _is_task_intent(user_text):
            try:
                _task_prompt = f"""Extrae la tarea del texto del usuario.
Devuelve ÚNICAMENTE un JSON válido sin backticks:
{{"title": "descripción corta", "priority": "high" o "normal" o "low", "due_date": "YYYY-MM-DD" o null}}
Hoy es {datetime.now(timezone.utc).strftime("%Y-%m-%d")}.
El usuario dice: "{user_text}"
"""
                _raw = await generate_llm_response(_task_prompt)
                _clean = _raw.strip().replace("```json", "").replace("```", "").strip()
                _task_data = json.loads(_clean)

                if _task_data.get("title"):
                    _doc = {
                        "user_id": user["id"],
                        "title": _task_data["title"],
                        "notes": "",
                        "due_date": _task_data.get("due_date"),
                        "priority": _task_data.get("priority", "normal"),
                        "done": False,
                        "done_at": None,
                        "created_at": now_ts,
                        "source": "voice",
                    }
                    _result = await db.tasks.insert_one(_doc)
                    _due = f" para el {_task_data['due_date']}" if _task_data.get("due_date") else ""
                    _pri = " (prioritaria)" if _task_data.get("priority") == "high" else ""
                    return AssistantResponse(
                        assistant_text=f"Tarea añadida: {_task_data['title']}{_pri}{_due}.",
                        actions=[AssistantAction(type="task_created", payload={"id": str(_result.inserted_id), "title": _task_data["title"]})],
                        status="ok", timestamp=now_ts,
                    )
            except Exception as e:
                logger.warning("Task extraction error: %s", e)

        # 5. Create reminder
        from backend.api.reminders import is_reminder_intent, extract_reminder_data
        if is_reminder_intent(user_text):
            reminder_data = await extract_reminder_data(user_text)
            if reminder_data:
                doc = {
                    "user_id": user["id"],
                    "text": reminder_data["text"],
                    "remind_at": reminder_data["remind_at"],
                    "done": False,
                    "notified": False,
                    "created_at": now_ts,
                }
                result = await db.reminders.insert_one(doc)
                friendly = reminder_data.get("friendly_time", reminder_data["remind_at"])
                return AssistantResponse(
                    assistant_text=f"Listo. Te recordaré {reminder_data['text']} {friendly}.",
                    actions=[AssistantAction(type="reminder_created", payload={"id": str(result.inserted_id), "text": reminder_data["text"]})],
                    status="ok", timestamp=now_ts,
                )
            else:
                return AssistantResponse(
                    assistant_text="¿A qué hora quieres que te lo recuerde?",
                    actions=None, status="ok", timestamp=now_ts,
                )

        # 6. Save note/memory
        from backend.services.user_memory import is_note_intent, extract_note_text, add_memory_note
        if is_note_intent(user_text):
            note_text, category = extract_note_text(user_text)
            if not note_text or len(note_text) < 3:
                return AssistantResponse(
                    assistant_text="¿Qué quieres que anote exactamente?",
                    actions=None, status="ok", timestamp=now_ts,
                )
            await add_memory_note(db, user["id"], note_text, category)
            responses = {
                "idea": f"Idea guardada: {note_text}.",
                "cliente": "Anotado sobre el cliente. Lo tendré en cuenta.",
                "proyecto": "Anotado para el proyecto.",
                "preferencia": "Preferencia guardada. Lo recordaré.",
                "recado": f"Apuntado: {note_text}.",
                "salud": "Anotado. Lo tendré en cuenta.",
                "general": "Anotado. Lo tendré en cuenta.",
            }
            return AssistantResponse(
                assistant_text=responses.get(category, responses["general"]),
                actions=[AssistantAction(type="memory_saved", payload={"note": note_text, "category": category})],
                status="ok", timestamp=now_ts,
            )

        # ══════════════════════════════════════════════════════
        # SLOW PATH — Briefing or general query (full context)
        # ══════════════════════════════════════════════════════

        is_briefing = _is_briefing_request(user_text)

        # Only fetch heavy context for briefing or general queries that need it
        gmail_ok = True
        calendar_ok = True

        async def _fetch_gmail():
            nonlocal gmail_ok
            if not user.get("gmail_connected"):
                return []
            try:
                return await fetch_enriched_messages_light(user, db, max_results=50)
            except Exception as e:
                gmail_ok = False
                logger.warning("Gmail fetch error: %s", e)
                return []

        async def _fetch_calendar():
            nonlocal calendar_ok
            if not user.get("calendar_connected"):
                return []
            try:
                return await fetch_today_events(user, db)
            except Exception as e:
                calendar_ok = False
                logger.warning("Calendar fetch error: %s", e)
                return []

        async def _fetch_tasks():
            try:
                from backend.api.tasks import get_pending_tasks
                return await get_pending_tasks(user["id"])
            except Exception:
                return []

        async def _fetch_habits():
            try:
                return await get_habits_summary(user["id"])
            except Exception:
                return {"habits": [], "completed": 0, "total": 0}

        if is_briefing:
            # Full parallel fetch for briefing
            _results = await asyncio.gather(
                _fetch_gmail(),
                _fetch_calendar(),
                get_memory(db, user["id"]),
                get_all_contacts(db, user["id"], limit=5),
                get_user_memory(db, user["id"]),
                _fetch_tasks(),
                _fetch_habits(),
                return_exceptions=True,
            )
        else:
            # Light fetch for general queries — only fast local DB queries
            _results = await asyncio.gather(
                asyncio.coroutine(lambda: [])() if not user.get("gmail_connected") else _fetch_gmail(),
                _fetch_calendar(),
                get_memory(db, user["id"]),
                asyncio.coroutine(lambda: [])(),  # skip contacts
                get_user_memory(db, user["id"]),
                _fetch_tasks(),
                _fetch_habits(),
                return_exceptions=True,
            )

        def _safe(val, default):
            return default if isinstance(val, BaseException) else val

        items = _safe(_results[0], [])
        calendar_events = _safe(_results[1], [])
        exec_memory = _safe(_results[2], {})
        contacts = _safe(_results[3], [])
        user_mem_doc = _safe(_results[4], None)
        pending_tasks = _safe(_results[5], [])
        habits_summary = _safe(_results[6], {"habits": [], "completed": 0, "total": 0})

        for i, r in enumerate(_results):
            if isinstance(r, BaseException):
                logger.warning("Context gather task %d failed: %s", i, r)

        total = len(items)
        prioritarios = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO"]
        seguimiento = [i for i in items if i["priority"]["priority_label"] == "SEGUIMIENTO"]
        adjuntos = [i for i in items if i["email"].get("has_attachments", False)]
        counts = {"total": total, "prioritarios": len(prioritarios), "seguimiento": len(seguimiento), "adjuntos": len(adjuntos)}

        user_memory_context = build_user_memory_context(user_mem_doc)
        inbox_context = _build_inbox_context(items, counts) if items else "Bandeja: sin correos disponibles."
        calendar_context = _build_calendar_context(calendar_events)
        tasks_context = _build_tasks_context(pending_tasks)
        habits_context = _build_habits_context(habits_summary)
        contacts_context = _build_contacts_context(contacts)
        service_status = _get_service_status(user, gmail_ok, calendar_ok)

        last_action = exec_memory.get("last_action", "")
        last_focus = exec_memory.get("last_focus", "")
        memory_context = ""
        if last_action:
            memory_context = f"Última acción: {last_action}."
            if last_focus:
                memory_context += f" Estaba en: {last_focus}."

        now_madrid, today_label, today_iso, time_of_day = _get_date_context()
        lucy_role = _get_lucy_role(user)

        if is_briefing:
            prompt = f"""Eres Lucy, {lucy_role} de {user.get('name', 'el usuario')}.

HOY: {today_label} ({today_iso}), {time_of_day}. Hora: {now_madrid.strftime("%H:%M")}.

Tu trabajo es dar un briefing completo. Hablas con naturalidad, elegancia y cercanía profesional. En español.

ESTRUCTURA DEL BRIEFING (prosa fluida, no listas):
1. Saludo breve adaptado a la hora.
2. AGENDA: reuniones/eventos. Si hay videollamadas, menciónalo.
3. CORREOS: resumen de bandeja. Destaca prioritarios por nombre y asunto.
4. TAREAS: pendientes, destaca urgentes.
5. HÁBITOS: completados y pendientes.
6. Cierre motivador.

DATOS REALES:
{calendar_context}
{inbox_context}
{tasks_context if tasks_context else "Sin tareas pendientes."}
{habits_context if habits_context else "Sin hábitos registrados."}
{contacts_context}
{service_status}
{memory_context}
{user_memory_context}

REGLAS: Prosa fluida, máximo 8-10 frases. Nombra personas y asuntos reales. NO inventes datos.

El usuario dice: "{user_text}"
"""
            max_tokens = 500
        else:
            prompt = f"""Eres Lucy, {lucy_role} de {user.get('name', 'el usuario')}.
HOY: {today_label}. Hora: {now_madrid.strftime("%H:%M")}.
Personalidad: elegante, directa, concisa. Máximo 3-4 frases. En español.

DATOS:
{calendar_context}
{inbox_context if items else ""}
{tasks_context}
{habits_context}
{service_status}
{memory_context}
{user_memory_context}

El usuario dice: "{user_text}"

Responde con datos reales. No inventes. Si pide algo específico, responde directamente.
"""
            max_tokens = 250

        # Generate response
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

        # Save executive memory (fire-and-forget)
        try:
            await set_memory(db=db, user_id=user["id"], fields={
                "last_action": "briefing" if is_briefing else "assistant_query",
                "last_focus": text_lower[:50],
                "last_intent": "BRIEFING" if is_briefing else "ASSISTANT_QUERY",
            })
        except Exception:
            pass

        return AssistantResponse(
            assistant_text=assistant_text,
            actions=None,
            status="ok",
            timestamp=now_ts,
        )

    except Exception as e:
        logger.exception("Assistant error: %s", e)
        return AssistantResponse(
            assistant_text="Disculpa, no he podido procesar tu solicitud. Inténtalo de nuevo.",
            actions=None,
            status="error",
            timestamp=datetime.now(timezone.utc).isoformat(),
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
                "timestamp": datetime.now(timezone.utc).isoformat(),
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
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        else:
            raise HTTPException(status_code=400, detail="Modo no válido")

    except Exception as e:
        logger.exception("Assistant message error: %s", e)
        raise HTTPException(status_code=500, detail="Error procesando el mensaje")