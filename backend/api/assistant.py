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
from backend.api.gmail import fetch_enriched_messages, fetch_enriched_messages_light, send_email, resolve_recipient
from backend.api.calendar import fetch_today_events, _parse_event, CALENDAR_SCOPES
from backend.api.habits import get_habits_summary
from backend.core.database import db
from backend.services.executive_memory import set_memory, get_memory
from backend.services.contact_memory import get_all_contacts, build_contact_insight
from backend.services.user_memory import get_user_memory, build_user_memory_context
from backend.services.ai_service import AIService, generate_llm_response
from backend.utils.logger import logger

async def _empty_list():
    return []

router = APIRouter(prefix="/assistant", tags=["Assistant"])
ai_service = AIService()


# =====================================================
# MODELOS
# =====================================================

class AssistantMessage(BaseModel):
    text: Optional[str] = None
    message: Optional[str] = None
    # Confirmación de email pendiente
    confirm_email: Optional[bool] = None   # True = usuario dijo "sí, envía"
    pending_email_id: Optional[str] = None # ID del borrador pendiente en DB


class AssistantAction(BaseModel):
    type: str
    payload: Dict[str, Any]


class AssistantResponse(BaseModel):
    assistant_text: str
    actions: Optional[List[AssistantAction]] = None
    status: str = "ok"
    timestamp: str
    # Borrador pendiente — frontend guarda esto hasta confirmación
    pending_email: Optional[Dict[str, Any]] = None


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
        follow_names = []
        for i in follow:
            sender = i["email"].get("from_name", "") or i["email"].get("from_email", "")
            m = re.match(r'^"?([^"<]+)"?\s*<', sender)
            follow_names.append(m.group(1).strip() if m else sender.split("@")[0])
        lines.append(f"\nEn seguimiento: {', '.join(follow_names)}")

    return "\n".join(lines)


def _build_inbox_context_with_vip(items: list, counts: dict) -> str:
    """
    Como _build_inbox_context pero sube los correos VIP al principio,
    con mención explícita del nombre de empresa VIP.
    """
    lines = [
        f"Total: {counts['total']} correos en bandeja.",
        f"Prioritarios: {counts['prioritarios']} · Seguimiento: {counts['seguimiento']} · Con adjuntos: {counts['adjuntos']}",
    ]

    # VIP primero
    vip_items = [i for i in items if i["email"].get("is_vip")]
    if vip_items:
        lines.append("\n⚑ Empresas VIP (máxima prioridad):")
        for item in vip_items[:4]:
            email = item["email"]
            sender = email.get("from_name", "") or email.get("from_email", "")
            name_match = re.match(r'^"?([^"<]+)"?\s*<', sender)
            clean = name_match.group(1).strip() if name_match else sender
            vip_name = email.get("vip_company_name", "")
            subject = email.get("subject", "(Sin asunto)")
            snippet = email.get("snippet", "")[:80]
            label = f" [{vip_name}]" if vip_name else ""
            lines.append(f'  · {clean}{label}: "{subject}" — {snippet}')

    top = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO" and not i["email"].get("is_vip")][:3]
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
        follow_names = []
        for i in follow:
            sender = i["email"].get("from_name", "") or i["email"].get("from_email", "")
            m = re.match(r'^"?([^"<]+)"?\s*<', sender)
            follow_names.append(m.group(1).strip() if m else sender.split("@")[0])
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
        status = "completado" if h["completed_today"] else "pendiente"
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
        issues.append("correo con error de autenticación")
    if not user.get("calendar_connected"):
        issues.append("agenda no conectada")
    elif not calendar_ok:
        issues.append("agenda con error de autenticación")
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
# DETECCIÓN DE INTENCIONES
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
    # No interpretar como tarea si hay contexto de email activo
    email_context_words = ["email", "correo", "mail", "mensaje", "cuerpo", "asunto", "destinatario"]
    if any(w in t for w in email_context_words):
        return False
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


# ── Intención de email ────────────────────────────────
_EMAIL_SEND_KEYWORDS = [
    "manda", "envía", "envia", "escribe", "redacta", "prepara",
    "mándame", "mandame", "manda un email", "manda un correo",
    "escribe un email", "escribe un correo", "envía un email",
    "quiero mandar", "quiero enviar", "quiero escribir",
]

def _is_email_send_intent(text: str) -> bool:
    t = text.lower()
    has_action = any(k in t for k in _EMAIL_SEND_KEYWORDS)
    has_email_word = any(w in t for w in ["email", "correo", "mail", "mensaje"])
    # También: "dile a Carlos que..." sin mencionar email explícitamente
    has_dile = "dile" in t or "cuéntale" in t or "avísale" in t
    return has_action and (has_email_word or has_dile)


# ── Confirmación de envío ─────────────────────────────
_CONFIRM_WORDS = [
    "sí", "si", "sí envíalo", "envíalo", "envialo", "mándalo", "mandalo",
    "perfecto", "adelante", "venga", "dale", "correcto", "de acuerdo",
    "confirmado", "confirmo", "hazlo", "procede",
]
_REJECT_WORDS = [
    "no", "cancela", "no lo envíes", "no lo mandes", "espera",
    "modifica", "cambia", "para", "stop",
]

def _is_confirm(text: str) -> bool:
    t = text.lower().strip()
    return any(w in t for w in _CONFIRM_WORDS)

def _is_reject(text: str) -> bool:
    t = text.lower().strip()
    return any(w in t for w in _REJECT_WORDS)


# ── Intención de leer correo ──────────────────────────
_READ_EMAIL_KEYWORDS = [
    "léeme", "lee", "leeme", "lee el correo", "léeme el correo",
    "qué dice", "que dice", "lee el último", "lee el ultimo",
    "léeme el último", "lee el de", "léeme el de",
]

def _is_read_email_intent(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in _READ_EMAIL_KEYWORDS)


# Navigation intents
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
# EMAIL EXTRACTION
# =====================================================

async def _extract_email_intent(user_text: str, user_name: str) -> Optional[Dict[str, Any]]:
    """
    Extrae destinatario, asunto y cuerpo de un comando de voz.
    Devuelve {"to_name": str, "subject": str, "body": str} o None.
    """
    prompt = f"""Eres un extractor de intenciones de email por voz.
El usuario se llama {user_name}.
El usuario dice: "{user_text}"

Extrae la intención de enviar un email.
Devuelve ÚNICAMENTE un JSON válido sin backticks ni texto adicional:
{{
    "to_name": "nombre o email del destinatario",
    "subject": "asunto del correo o string vacío si no se especificó",
    "body": "cuerpo del correo o string vacío si no se especificó"
}}

Reglas ESTRICTAS:
- to_name: solo el nombre/email del destinatario si se menciona explícitamente. Si no, string vacío "".
- subject: solo si el usuario lo especificó. Si no, string vacío "".
- body: SOLO si el usuario especificó claramente qué decir (ej: "dile que...", "que sepa que...", "escríbele que..."). Si no hay contenido explícito, DEJAR VACÍO "". NO INVENTAR NUNCA.
- No incluyas saludo formal. No firmes. No añadas nada que el usuario no haya dicho.
"""
    try:
        raw = await generate_llm_response(prompt)
        clean = raw.strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(clean)
        if data.get("to_name"):
            return data
    except Exception as e:
        logger.warning("Email extraction error: %s", e)
    return None


_GREETING_ONLY_WORDS = [
    "hola", "buenos días", "buenos dias", "buenas tardes",
    "buenas noches", "buenas", "qué tal", "que tal",
]


def _is_greeting_only(text: str) -> bool:
    t = text.lower().strip().rstrip(".")
    return t in _GREETING_ONLY_WORDS or any(
        t == f"hola {g}" for g in _GREETING_ONLY_WORDS
    )



# =====================================================
# EVENT EXTRACTION + CREATION
# =====================================================

async def _extract_event_data(user_text: str) -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    _days_es = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
    today_weekday = _days_es[now.weekday()]

    prompt = f"""Eres un extractor de datos de eventos de calendario.
Hoy es {today_str} ({today_weekday}). Zona horaria: Europe/Madrid.
El usuario dice: "{user_text}"

Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional ni backticks.
Formato:
{{
  "title": "nombre del evento",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "location": "",
  "description": ""
}}

Reglas:
- Si no hay hora de fin, suma 1 hora.
- "mañana" → calcula desde hoy.
- Si dice un día de la semana, calcula la PRÓXIMA ocurrencia.
- Año: el más próximo futuro.
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
        parts = [f"Listo. {title} {date_str}"]
        if start_time:
            parts.append(f"a las {start_time}")
        if location:
            parts.append(f"en {location}")
        return ", ".join(parts) + ". Ya está en tu calendario."
    else:
        return "No he podido crear el evento. Comprueba que tu calendario está conectado en ajustes."


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

        now_ts = datetime.now(timezone.utc).isoformat()
        user_name = user.get("name", "")

        # ══════════════════════════════════════════════════════
        # CONFIRMACIÓN DE EMAIL PENDIENTE
        # Cuando el frontend guarda un borrador y el usuario confirma,
        # llega confirm_email=True + pending_email con los datos.
        # ══════════════════════════════════════════════════════

        if payload.pending_email_id:
            # Recuperar borrador de DB
            from bson import ObjectId
            try:
                draft_doc = await db.email_drafts.find_one({
                    "_id": ObjectId(payload.pending_email_id),
                    "user_id": user["id"],
                })
            except Exception:
                draft_doc = None

            if not draft_doc:
                return AssistantResponse(
                    assistant_text="No encuentro el borrador. ¿Quieres que lo redacte de nuevo?",
                    actions=None, status="ok", timestamp=now_ts,
                )


            # ── awaiting_email_address: el usuario acaba de dar el email ──
            if draft_doc.get("awaiting_email_address"):
                email_provided = user_text.strip()
                if "@" not in email_provided or "." not in email_provided:
                    return AssistantResponse(
                        assistant_text="Eso no parece una dirección de correo válida. ¿Puedes repetirla?",
                        actions=None, status="ok", timestamp=now_ts,
                        pending_email={
                            "id": str(draft_doc["_id"]),
                            "to_name": draft_doc.get("to_name", ""),
                            "to_email": None,
                            "subject": draft_doc.get("subject", ""),
                            "body": "",
                            "needs_confirm": False,
                            "awaiting_email_address": True,
                            "awaiting_body": False,
                        },
                    )
                await db.email_drafts.update_one(
                    {"_id": draft_doc["_id"]},
                    {"$set": {
                        "to": email_provided,
                        "resolved": True,
                        "awaiting_email_address": False,
                        "awaiting_body": True,
                    }},
                )
                to_name_disp = draft_doc.get("to_name", email_provided)
                return AssistantResponse(
                    assistant_text=f"Perfecto. ¿Qué quieres decirle a {to_name_disp}?",
                    actions=None, status="ok", timestamp=now_ts,
                    pending_email={
                        "id": str(draft_doc["_id"]),
                        "to_name": to_name_disp,
                        "to_email": email_provided,
                        "subject": draft_doc.get("subject", ""),
                        "body": "",
                        "needs_confirm": False,
                        "awaiting_email_address": False,
                        "awaiting_body": True,
                    },
                )

            # ── awaiting_recipient: el usuario acaba de decir a quién va ──
            if draft_doc.get("awaiting_recipient"):
                to_name_new = user_text.strip()
                resolved_email_new = await resolve_recipient(to_name_new, user["id"], db)
                await db.email_drafts.update_one(
                    {"_id": draft_doc["_id"]},
                    {"$set": {
                        "to": resolved_email_new or to_name_new,
                        "to_name": to_name_new,
                        "resolved": bool(resolved_email_new),
                        "awaiting_recipient": False,
                        "awaiting_body": True,
                    }},
                )
                return AssistantResponse(
                    assistant_text=f"Perfecto, le escribo a {to_name_new}. ¿Qué quieres decirle?",
                    actions=None, status="ok", timestamp=now_ts,
                    pending_email={
                        "id": str(draft_doc["_id"]),
                        "to_name": to_name_new,
                        "to_email": resolved_email_new,
                        "subject": draft_doc.get("subject", f"Mensaje de {user_name}"),
                        "body": "",
                        "needs_confirm": False,
                        "awaiting_recipient": False,
                        "awaiting_body": True,
                    },
                )

            # ── awaiting_body: el usuario acaba de decir el cuerpo del email ──
            if draft_doc.get("awaiting_body"):
                body_from_user = user_text.strip()
                if not body_from_user or len(body_from_user) < 3:
                    return AssistantResponse(
                        assistant_text="No he entendido bien el mensaje. ¿Qué quieres decirle exactamente?",
                        actions=None, status="ok", timestamp=now_ts,
                        pending_email={
                            "id": str(draft_doc["_id"]),
                            "to_name": draft_doc.get("to_name", ""),
                            "to_email": draft_doc["to"] if draft_doc.get("resolved") else None,
                            "subject": draft_doc.get("subject", ""),
                            "body": "",
                            "needs_confirm": False,
                            "awaiting_body": True,
                        },
                    )
                # Generar cuerpo profesional con LLM
                body_prompt = f"""Redacta un email profesional en español.
Remitente: {user_name}
Destinatario: {draft_doc.get("to_name", "")}
El remitente quiere decir: "{body_from_user}"
Devuelve SOLO el cuerpo del email, sin asunto ni saludo formal. Directo y profesional. Firma con {user_name}."""
                try:
                    body_generated = await generate_llm_response(body_prompt)
                    body_generated = body_generated.strip()
                except Exception:
                    body_generated = body_from_user

                # Actualizar draft con body y quitar awaiting_body
                await db.email_drafts.update_one(
                    {"_id": draft_doc["_id"]},
                    {"$set": {"body": body_generated, "awaiting_body": False}},
                )
                draft_doc["body"] = body_generated
                draft_doc["awaiting_body"] = False

                to_name_disp = draft_doc.get("to_name", draft_doc["to"])
                preview = body_generated[:200] + ("..." if len(body_generated) > 200 else "")
                confirmation_text = (
                    f"De acuerdo. He redactado esto para {to_name_disp}: {preview}. ¿Lo envío?"
                )
                return AssistantResponse(
                    assistant_text=confirmation_text,
                    actions=None, status="ok", timestamp=now_ts,
                    pending_email={
                        "id": str(draft_doc["_id"]),
                        "to_name": to_name_disp,
                        "to_email": draft_doc["to"] if draft_doc.get("resolved") else None,
                        "subject": draft_doc.get("subject", ""),
                        "body": body_generated,
                        "needs_confirm": True,
                        "awaiting_body": False,
                    },
                )

            if payload.confirm_email is False or _is_reject(user_text):
                await db.email_drafts.delete_one({"_id": draft_doc["_id"]})
                return AssistantResponse(
                    assistant_text="Entendido, cancelo el correo.",
                    actions=[AssistantAction(type="email_cancelled", payload={})],
                    status="ok", timestamp=now_ts,
                )

            if payload.confirm_email is True or _is_confirm(user_text):
                try:
                    result = await send_email(
                        user=user, db=db,
                        to=draft_doc["to"],
                        subject=draft_doc["subject"],
                        body=draft_doc["body"],
                    )
                    await db.email_drafts.delete_one({"_id": draft_doc["_id"]})
                    recipient_name = draft_doc.get("to_name") or draft_doc["to"]
                    return AssistantResponse(
                        assistant_text=f"Enviado. El correo a {recipient_name} acaba de salir.",
                        actions=[AssistantAction(type="email_sent", payload={
                            "to": draft_doc["to"],
                            "subject": draft_doc["subject"],
                            "message_id": result.get("message_id", ""),
                        })],
                        status="ok", timestamp=now_ts,
                    )
                except Exception as e:
                    logger.error("Send email error: %s", e)
                    return AssistantResponse(
                        assistant_text="Ha habido un problema al enviar el correo. Comprueba que Gmail sigue conectado en ajustes.",
                        actions=None, status="error", timestamp=now_ts,
                    )

        # ══════════════════════════════════════════════════════
        # FAST PATH — Instant intents
        # ══════════════════════════════════════════════════════

        # 1. Navigation intent
        nav_text, nav_screen = _detect_nav_intent(user_text)
        if nav_text and nav_screen:
            return AssistantResponse(
                assistant_text=nav_text,
                actions=[AssistantAction(type="go_to", payload={"screen": nav_screen})],
                status="ok", timestamp=now_ts,
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
        # MEDIUM PATH — LLM, no heavy fetch
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
                    _pri = " como urgente" if _task_data.get("priority") == "high" else ""
                    return AssistantResponse(
                        assistant_text=f"Tarea añadida{_pri}: {_task_data['title']}{_due}.",
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
                    assistant_text=f"Listo. Te recuerdo {reminder_data['text']} {friendly}.",
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
                "salud": "Anotado.",
                "general": "Anotado. Lo tendré en cuenta.",
            }
            return AssistantResponse(
                assistant_text=responses.get(category, responses["general"]),
                actions=[AssistantAction(type="memory_saved", payload={"note": note_text, "category": category})],
                status="ok", timestamp=now_ts,
            )

        # 7. ── EMAIL POR VOZ ─────────────────────────────────────────
        if _is_email_send_intent(user_text):
            if not user.get("gmail_connected"):
                return AssistantResponse(
                    assistant_text="Tu correo no está conectado. Puedes conectarlo desde ajustes.",
                    actions=None, status="ok", timestamp=now_ts,
                )

            email_data = await _extract_email_intent(user_text, user_name)
            to_name = email_data.get("to_name", "") if email_data else ""
            subject = email_data.get("subject", "") if email_data else ""
            body_text = email_data.get("body", "") if email_data else ""

            # Sin destinatario claro → preguntar quién primero
            if not to_name or len(to_name.strip()) < 2:
                draft_doc_pre = {
                    "user_id": user["id"],
                    "to": "",
                    "to_name": "",
                    "subject": "",
                    "body": "",
                    "resolved": False,
                    "awaiting_recipient": True,
                    "awaiting_body": False,
                    "created_at": now_ts,
                }
                draft_result_pre = await db.email_drafts.insert_one(draft_doc_pre)
                return AssistantResponse(
                    assistant_text="Claro, ¿a quién va dirigido el correo?",
                    actions=None, status="ok", timestamp=now_ts,
                    pending_email={
                        "id": str(draft_result_pre.inserted_id),
                        "to_name": "",
                        "to_email": None,
                        "subject": "",
                        "body": "",
                        "needs_confirm": False,
                        "awaiting_recipient": True,
                        "awaiting_body": False,
                    },
                )

            # Sin cuerpo → preguntar qué decirle
            if not body_text or len(body_text.strip()) < 10:
                resolved_email_pre = await resolve_recipient(to_name, user["id"], db)
                awaiting_email_address = not bool(resolved_email_pre)
                draft_doc_pre = {
                    "user_id": user["id"],
                    "to": resolved_email_pre or to_name,
                    "to_name": to_name,
                    "subject": subject or f"Mensaje de {user_name}",
                    "body": "",
                    "resolved": bool(resolved_email_pre),
                    "awaiting_recipient": False,
                    "awaiting_body": not awaiting_email_address,
                    "awaiting_email_address": awaiting_email_address,
                    "created_at": now_ts,
                }
                draft_result_pre = await db.email_drafts.insert_one(draft_doc_pre)
                if awaiting_email_address:
                    reply_text = f"Entendido. No tengo el email de {to_name} en mis contactos. ¿Puedes decirme su dirección de correo?"
                else:
                    reply_text = f"Entendido, le escribo a {to_name}. ¿Qué quieres decirle?"
                return AssistantResponse(
                    assistant_text=reply_text,
                    actions=None, status="ok", timestamp=now_ts,
                    pending_email={
                        "id": str(draft_result_pre.inserted_id),
                        "to_name": to_name,
                        "to_email": resolved_email_pre,
                        "subject": subject or f"Mensaje de {user_name}",
                        "body": "",
                        "needs_confirm": False,
                        "awaiting_recipient": False,
                        "awaiting_body": not awaiting_email_address,
                        "awaiting_email_address": awaiting_email_address,
                    },
                )

            # Tenemos destinatario y cuerpo → resolver email y pedir confirmación
            resolved_email = await resolve_recipient(to_name, user["id"], db)
            draft_doc = {
                "user_id": user["id"],
                "to": resolved_email or to_name,
                "to_name": to_name,
                "subject": subject,
                "body": body_text,
                "resolved": bool(resolved_email),
                "awaiting_recipient": False,
                "awaiting_body": False,
                "created_at": now_ts,
            }
            draft_result = await db.email_drafts.insert_one(draft_doc)
            preview = body_text[:200] + ("..." if len(body_text) > 200 else "")
            return AssistantResponse(
                assistant_text=f"Listo. Le escribo a {to_name}. Asunto: {subject}. Dice: {preview}. ¿Lo envío?",
                actions=None, status="ok", timestamp=now_ts,
                pending_email={
                    "id": str(draft_result.inserted_id),
                    "to_name": to_name,
                    "to_email": resolved_email,
                    "subject": subject,
                    "body": body_text,
                    "needs_confirm": True,
                    "awaiting_recipient": False,
                    "awaiting_body": False,
                },
            )

        # 8. ── LEER CORREO EN VOZ ALTA ────────────────────────────────
        if _is_read_email_intent(user_text):
            if not user.get("gmail_connected"):
                return AssistantResponse(
                    assistant_text="Tu correo no está conectado.",
                    actions=None, status="ok", timestamp=now_ts,
                )
            try:
                recent = await fetch_enriched_messages_light(user, db, max_results=5)
                if not recent:
                    return AssistantResponse(
                        assistant_text="No encuentro correos recientes.",
                        actions=None, status="ok", timestamp=now_ts,
                    )
                # Elegir el más reciente o el prioritario
                target = recent[0]
                email = target["email"]
                sender = email.get("from_name", "") or email.get("from_email", "")
                name_match = re.match(r'^"?([^"<]+)"?\s*<', sender)
                clean_sender = name_match.group(1).strip() if name_match else sender
                subject = email.get("subject", "sin asunto")
                snippet = email.get("snippet", "")[:300]
                read_text = f"El correo más reciente es de {clean_sender}. Asunto: {subject}. Dice: {snippet}."
                return AssistantResponse(
                    assistant_text=read_text,
                    actions=[AssistantAction(type="highlight_email", payload={"email_id": email.get("id", "")})],
                    status="ok", timestamp=now_ts,
                )
            except Exception as e:
                logger.warning("Read email error: %s", e)

        # ══════════════════════════════════════════════════════
        # SLOW PATH — Briefing o consulta general con contexto
        # ══════════════════════════════════════════════════════

        is_briefing = _is_briefing_request(user_text)
        gmail_ok = True
        calendar_ok = True

        async def _fetch_gmail():
            nonlocal gmail_ok
            if not user.get("gmail_connected"):
                return []
            try:
                return await fetch_enriched_messages_light(user, db, max_results=15)
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
            _results = await asyncio.gather(
                _fetch_gmail(), _fetch_calendar(),
                get_memory(db, user["id"]), get_all_contacts(db, user["id"], limit=5),
                get_user_memory(db, user["id"]), _fetch_tasks(), _fetch_habits(),
                return_exceptions=True,
            )
        else:
            # Para comandos normales no hacer fetch pesado de Gmail
            _results = await asyncio.gather(
                _empty_list(),
                _fetch_calendar(), get_memory(db, user["id"]),
                _empty_list(), get_user_memory(db, user["id"]),
                _fetch_tasks(), _empty_list(),
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

        total = len(items)
        prioritarios = [i for i in items if i["priority"]["priority_label"] == "PRIORITARIO"]
        seguimiento = [i for i in items if i["priority"]["priority_label"] == "SEGUIMIENTO"]
        adjuntos = [i for i in items if i["email"].get("has_attachments", False)]
        counts = {
            "total": total,
            "prioritarios": len(prioritarios),
            "seguimiento": len(seguimiento),
            "adjuntos": len(adjuntos),
        }

        user_memory_context = build_user_memory_context(user_mem_doc)
        # Usar versión con VIP destacado
        inbox_context = _build_inbox_context_with_vip(items, counts) if items else "Bandeja: sin correos disponibles."
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

        # ── INSTRUCCIÓN BASE PARA VOZ ────────────────────────────────
        # Lucy siempre habla como si fuera audio: frases cortas, sin listas,
        # sin markdown, sin guiones, sin emojis. Natural y fluido.
        voice_base = """IMPORTANTE — tu respuesta se leerá en voz alta.
Reglas absolutas:
        + Sin listas, sin guiones, sin asteriscos, sin markdown de ningún tipo.
        + Frases cortas y naturales, como en una conversación real.
        + Sin emojis.
        + En español de España, registro profesional pero cercano.
        + Máximo las frases indicadas en cada prompt.
        + Cierre natural: solo pregunta si hay algo más cuando sea apropiado.
          No lo hagas si acabas de dar un briefing completo, si acabas de confirmar
          una acción, o si el usuario claramente ha terminado."""

        # Saludo simple — respuesta directa sin slow path completo
        if _is_greeting_only(user_text) and not is_briefing:
            user_first = user_name.split()[0] if user_name else ""
            hour = now_madrid.hour
            if hour < 12:
                saludo = "Buenos días"
            elif hour < 20:
                saludo = "Buenas tardes"
            else:
                saludo = "Buenas noches"
            greeting_text = f"{saludo}{', ' + user_first if user_first else ''}. ¿En qué puedo ayudarte?"
            return AssistantResponse(
                assistant_text=greeting_text,
                actions=None,
                status="ok",
                timestamp=now_ts,
            )

        if is_briefing:
            prompt = f"""
Eres Lucy, {lucy_role} de {user_name or 'el usuario'}.
HOY: {today_label} ({today_iso}), {time_of_day}. Hora: {now_madrid.strftime("%H:%M")}.

Da un briefing completo en prosa fluida. Estructura natural hablada:
Primero saluda brevemente según la hora.
Luego la agenda de hoy con las reuniones importantes.
Después los correos, empezando siempre por los de empresas VIP si los hay, luego los prioritarios.
Después las tareas urgentes.
Después los hábitos pendientes.
Cierra con una frase natural. NO añadas "¿algo más?" al final del briefing.

DATOS:
{calendar_context}
{inbox_context}
{tasks_context if tasks_context else "Sin tareas pendientes."}
{habits_context if habits_context else "Sin hábitos registrados."}
{contacts_context}
{service_status}
{memory_context}
{user_memory_context}

Máximo 10 frases. Nombra personas y asuntos reales. No inventes datos.
El usuario dice: "{user_text}"
"""
            max_tokens = 500
        else:
            prompt = f"""
Eres Lucy, {lucy_role} de {user_name or 'el usuario'}.
HOY: {today_label}. Hora: {now_madrid.strftime("%H:%M")}.
Responde en máximo 3 frases, directo y natural.

DATOS:
{calendar_context}
{inbox_context if items else ""}
{tasks_context}
{habits_context}
{service_status}
{memory_context}
{user_memory_context}

El usuario dice: "{user_text}"
No inventes datos. Si pide algo específico, responde directamente.
Solo añade una pregunta de seguimiento si la respuesta fue corta y tiene continuación natural.
No lo añadas si acabas de confirmar una acción o dar información completa.
"""
            max_tokens = 200



        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            assistant_text = "La configuración de inteligencia artificial no está disponible en este momento."
        else:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": voice_base},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5 if is_briefing else 0.4,
                max_tokens=max_tokens,
            )
            assistant_text = response.choices[0].message.content.strip()
            logger.info("LLM response: %s", assistant_text)

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
            prompt = f"""Resume este correo en máximo 3 frases.
Natural, claro y conversacional. Sin encabezados ni listas. Sin markdown.
Si hay una acción requerida, menciónala al final.

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
Lista para enviar. Sin markdown.

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
    