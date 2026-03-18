# backend/api/alerts.py

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Request

from backend.core.dependencies import get_current_user
from backend.core.database import db
from backend.utils.response import build_response

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _today_str() -> str:
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d")


def _now_madrid():
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        return datetime.now(timezone.utc)


# =====================================================
# CHECK ALERTS
# =====================================================

@router.get("/check")
async def check_alerts(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Returns proactive alerts for the user.
    Called every 5 minutes by the frontend.
    Returns only NEW alerts not yet dismissed.
    """
    user_id = user["id"]
    now = _now_madrid()
    today = _today_str()
    alerts: List[Dict[str, Any]] = []

    # Get dismissed alerts for today (to avoid repeating)
    dismissed_doc = await db.alert_dismissals.find_one(
        {"user_id": user_id, "date": today}
    ) or {}
    dismissed_ids = set(dismissed_doc.get("dismissed", []))

    # ── 1. Hábitos pendientes (después de las 18:00) ──
    if now.hour >= 18:
        try:
            from backend.api.habits import get_habits_summary
            habits = await get_habits_summary(user_id)
            pending = [h for h in habits.get("habits", []) if not h["completed_today"]]
            if pending and "habits_pending" not in dismissed_ids:
                names = ", ".join(h["name"] for h in pending[:3])
                alerts.append({
                    "id": "habits_pending",
                    "type": "habits",
                    "icon": "🎯",
                    "title": "Hábitos pendientes",
                    "message": f"Aún te faltan {len(pending)}: {names}. ¡Todavía hay tiempo!",
                    "priority": "low",
                    "action": "/app/habits",
                })
        except Exception:
            pass

    # ── 2. Tareas urgentes que vencen hoy ──
    try:
        from backend.api.tasks import get_pending_tasks
        tasks = await get_pending_tasks(user_id)
        due_today = [t for t in tasks if t.get("due_date") == today and t.get("priority") == "high"]
        if due_today and "tasks_due_today" not in dismissed_ids:
            names = ", ".join(t["title"] for t in due_today[:3])
            alerts.append({
                "id": "tasks_due_today",
                "type": "tasks",
                "icon": "⚡",
                "title": "Tareas urgentes hoy",
                "message": f"Tienes {len(due_today)} tarea{'s' if len(due_today) > 1 else ''} urgente{'s' if len(due_today) > 1 else ''} que vence{'n' if len(due_today) > 1 else ''} hoy: {names}.",
                "priority": "high",
                "action": "/app/tasks",
            })
    except Exception:
        pass

    # ── 3. Tareas que vencen mañana (aviso por la tarde) ──
    if now.hour >= 16:
        try:
            tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
            tasks = await get_pending_tasks(user_id)
            due_tomorrow = [t for t in tasks if t.get("due_date") == tomorrow]
            if due_tomorrow and "tasks_due_tomorrow" not in dismissed_ids:
                names = ", ".join(t["title"] for t in due_tomorrow[:3])
                alerts.append({
                    "id": "tasks_due_tomorrow",
                    "type": "tasks",
                    "icon": "📋",
                    "title": "Tareas para mañana",
                    "message": f"Mañana vence{'n' if len(due_tomorrow) > 1 else ''}: {names}. ¿Quieres adelantar algo?",
                    "priority": "medium",
                    "action": "/app/tasks",
                })
        except Exception:
            pass

    # ── 4. Recordatorios próximos (en los próximos 30 min) ──
    try:
        now_utc = datetime.now(timezone.utc)
        soon = now_utc + timedelta(minutes=30)
        cursor = db.reminders.find({
            "user_id": user_id,
            "done": False,
            "remind_at": {
                "$gte": now_utc.isoformat(),
                "$lte": soon.isoformat(),
            },
        })
        upcoming_reminders = []
        async for rem in cursor:
            upcoming_reminders.append(rem)

        if upcoming_reminders and "reminders_soon" not in dismissed_ids:
            names = ", ".join(r.get("text", "") for r in upcoming_reminders[:3])
            alerts.append({
                "id": "reminders_soon",
                "type": "reminders",
                "icon": "🔔",
                "title": "Recordatorios próximos",
                "message": f"En los próximos 30 minutos: {names}.",
                "priority": "medium",
            })
    except Exception:
        pass

    # ── 5. Racha de hábitos en peligro ──
    try:
        from backend.api.habits import get_habits_summary
        habits = await get_habits_summary(user_id)
        at_risk = [
            h for h in habits.get("habits", [])
            if h.get("streak", 0) >= 3 and not h["completed_today"]
        ]
        if at_risk and now.hour >= 20 and "streak_at_risk" not in dismissed_ids:
            names = ", ".join(h["name"] for h in at_risk[:2])
            streaks = ", ".join(f"{h['streak']} días" for h in at_risk[:2])
            alerts.append({
                "id": "streak_at_risk",
                "type": "habits",
                "icon": "🔥",
                "title": "Racha en peligro",
                "message": f"Tu racha de {names} ({streaks}) se pierde si no la completas hoy.",
                "priority": "high",
                "action": "/app/habits",
            })
    except Exception:
        pass

    # ── 6. Buenos días (primera vez del día, antes de las 11) ──
    if now.hour < 11 and "good_morning" not in dismissed_ids:
        # Check if user has opened the app today
        last_alert_check = await db.alert_dismissals.find_one(
            {"user_id": user_id, "date": today}
        )
        if not last_alert_check:
            alerts.append({
                "id": "good_morning",
                "type": "greeting",
                "icon": "☀️",
                "title": "Buenos días",
                "message": "¿Quieres que te dé tu briefing matutino?",
                "priority": "low",
                "action": "briefing",
            })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: priority_order.get(a.get("priority", "low"), 2))

    return build_response(
        request,
        data={"alerts": alerts, "count": len(alerts)},
        legacy={"alerts": alerts, "count": len(alerts)},
    )


# =====================================================
# DISMISS ALERT
# =====================================================

@router.post("/dismiss/{alert_id}")
async def dismiss_alert(
    alert_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Dismiss an alert for today (won't show again until tomorrow)."""
    today = _today_str()

    await db.alert_dismissals.update_one(
        {"user_id": user["id"], "date": today},
        {
            "$addToSet": {"dismissed": alert_id},
            "$set": {"user_id": user["id"], "date": today},
        },
        upsert=True,
    )

    return build_response(
        request,
        data={"dismissed": alert_id},
        legacy={"dismissed": alert_id},
    )