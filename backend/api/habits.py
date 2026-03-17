# backend/api/habits.py

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from bson import ObjectId

from backend.utils.response import build_response
from backend.core.dependencies import get_current_user
from backend.core.database import db


router = APIRouter(prefix="/habits", tags=["habits"])


def _serialize(doc: Dict) -> Dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _today_str() -> str:
    """Returns today's date as YYYY-MM-DD in Europe/Madrid timezone."""
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%d")


def _calculate_streak(completions: List[str], today: str) -> int:
    """Calculate current streak from a list of date strings (YYYY-MM-DD)."""
    if not completions:
        return 0

    dates = sorted(set(completions), reverse=True)

    # Check if today or yesterday is in the list (streak is still alive)
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        now = datetime.now(timezone.utc)

    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    if dates[0] != today and dates[0] != yesterday:
        return 0

    streak = 1
    for i in range(1, len(dates)):
        prev_date = datetime.strptime(dates[i - 1], "%Y-%m-%d")
        curr_date = datetime.strptime(dates[i], "%Y-%m-%d")
        if (prev_date - curr_date).days == 1:
            streak += 1
        else:
            break

    return streak


# =====================================================
# LIST HABITS
# =====================================================

@router.get("")
async def list_habits(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    today = _today_str()
    cursor = db.habits.find({"user_id": user["id"]}).sort("created_at", 1)
    habits = []
    async for doc in cursor:
        habit = _serialize(doc)
        completions = habit.get("completions", [])
        habit["completed_today"] = today in completions
        habit["streak"] = _calculate_streak(completions, today)
        habit["total_completions"] = len(completions)
        # Don't send full completions list to frontend (can be large)
        habit.pop("completions", None)
        habits.append(habit)

    return build_response(request, data={"habits": habits, "today": today}, legacy={"habits": habits, "today": today})


# =====================================================
# CREATE HABIT
# =====================================================

@router.post("")
async def create_habit(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    icon = payload.get("icon", "✅")
    frequency = payload.get("frequency", "daily")  # daily, weekdays, custom
    target_days = payload.get("target_days", [])  # ["mon","tue",...] for custom

    # Check for duplicate name
    existing = await db.habits.find_one({"user_id": user["id"], "name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes un hábito con ese nombre")

    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "user_id": user["id"],
        "name": name,
        "icon": icon,
        "frequency": frequency,
        "target_days": target_days,
        "completions": [],
        "active": True,
        "created_at": now,
    }

    result = await db.habits.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    doc["completed_today"] = False
    doc["streak"] = 0
    doc["total_completions"] = 0
    doc.pop("completions", None)

    return build_response(request, data={"habit": doc}, legacy={"habit": doc})


# =====================================================
# TOGGLE COMPLETION (today)
# =====================================================

@router.post("/{habit_id}/toggle")
async def toggle_habit(
    habit_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        oid = ObjectId(habit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    habit = await db.habits.find_one({"_id": oid, "user_id": user["id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")

    today = _today_str()
    completions = habit.get("completions", [])

    if today in completions:
        # Unmark
        completions.remove(today)
        completed_today = False
    else:
        # Mark
        completions.append(today)
        completed_today = True

    await db.habits.update_one(
        {"_id": oid},
        {"$set": {"completions": completions}},
    )

    streak = _calculate_streak(completions, today)

    return build_response(
        request,
        data={"completed_today": completed_today, "streak": streak},
        legacy={"completed_today": completed_today, "streak": streak},
    )


# =====================================================
# DELETE HABIT
# =====================================================

@router.delete("/{habit_id}")
async def delete_habit(
    habit_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        oid = ObjectId(habit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.habits.delete_one({"_id": oid, "user_id": user["id"]})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")

    return build_response(request, data={"deleted": habit_id}, legacy={"deleted": habit_id})


# =====================================================
# GET HABIT HISTORY (last 30 days)
# =====================================================

@router.get("/{habit_id}/history")
async def habit_history(
    habit_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        oid = ObjectId(habit_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    habit = await db.habits.find_one({"_id": oid, "user_id": user["id"]})
    if not habit:
        raise HTTPException(status_code=404, detail="Hábito no encontrado")

    completions = habit.get("completions", [])
    today = _today_str()

    # Last 30 days
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("Europe/Madrid"))
    except Exception:
        now = datetime.now(timezone.utc)

    days = []
    for i in range(29, -1, -1):
        date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        days.append({
            "date": date,
            "completed": date in completions,
        })

    streak = _calculate_streak(completions, today)

    return build_response(
        request,
        data={"habit_id": habit_id, "name": habit.get("name", ""), "days": days, "streak": streak},
        legacy={"habit_id": habit_id, "name": habit.get("name", ""), "days": days, "streak": streak},
    )


# =====================================================
# HABITS SUMMARY (for briefing)
# =====================================================

async def get_habits_summary(user_id: str) -> Dict[str, Any]:
    """Returns a summary for the assistant briefing."""
    today = _today_str()
    cursor = db.habits.find({"user_id": user_id, "active": True}).sort("created_at", 1)

    habits = []
    completed_count = 0
    total_count = 0

    async for doc in cursor:
        total_count += 1
        completions = doc.get("completions", [])
        done = today in completions
        if done:
            completed_count += 1
        streak = _calculate_streak(completions, today)
        habits.append({
            "name": doc.get("name", ""),
            "icon": doc.get("icon", "✅"),
            "completed_today": done,
            "streak": streak,
        })

    return {
        "habits": habits,
        "completed": completed_count,
        "total": total_count,
        "all_done": completed_count == total_count and total_count > 0,
    }