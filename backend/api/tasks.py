# backend/api/tasks.py

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from backend.utils.response import build_response
from backend.core.dependencies import get_current_user
from backend.core.database import db
from backend.core.feature_gate import check_feature

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _serialize(doc: Dict) -> Dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# ======================================================
# LISTAR TAREAS
# ======================================================

@router.get("")
async def list_tasks(
    request: Request,
    done: Optional[bool] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    check_feature(user, "tasks_management")

    query: Dict[str, Any] = {"user_id": user["id"]}
    if done is not None:
        query["done"] = done

    cursor = db.tasks.find(query).sort("created_at", -1)
    tasks = []
    async for doc in cursor:
        tasks.append(_serialize(doc))

    return build_response(request, data={"tasks": tasks}, legacy={"tasks": tasks})


# ======================================================
# CREAR TAREA
# ======================================================

@router.post("")
async def create_task(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    check_feature(user, "tasks_management")

    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="El título es obligatorio")

    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "user_id": user["id"],
        "title": title,
        "notes": (payload.get("notes") or "").strip(),
        "due_date": payload.get("due_date"),
        "priority": payload.get("priority", "normal"),
        "done": False,
        "done_at": None,
        "created_at": now,
        "source_email_id": payload.get("source_email_id"),
    }

    result = await db.tasks.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    return build_response(request, data={"task": doc}, legacy={"task": doc})


# ======================================================
# MARCAR HECHA / DESHACER
# ======================================================

@router.patch("/{task_id}/done")
async def toggle_done(
    task_id: str,
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    check_feature(user, "tasks_management")

    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    done = bool(payload.get("done", True))
    now = datetime.now(timezone.utc).isoformat()

    result = await db.tasks.update_one(
        {"_id": oid, "user_id": user["id"]},
        {"$set": {"done": done, "done_at": now if done else None}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    doc = await db.tasks.find_one({"_id": oid}, {"_id": 0})
    doc["id"] = task_id

    return build_response(request, data={"task": doc}, legacy={"task": doc})


# ======================================================
# EDITAR TAREA
# ======================================================

@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    check_feature(user, "tasks_management")

    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    allowed = {"title", "notes", "due_date", "priority"}
    updates = {k: v for k, v in payload.items() if k in allowed}

    if not updates:
        raise HTTPException(status_code=400, detail="Sin campos para actualizar")

    result = await db.tasks.update_one(
        {"_id": oid, "user_id": user["id"]},
        {"$set": updates},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    doc = await db.tasks.find_one({"_id": oid}, {"_id": 0})
    doc["id"] = task_id

    return build_response(request, data={"task": doc}, legacy={"task": doc})


# ======================================================
# ELIMINAR TAREA
# ======================================================

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    check_feature(user, "tasks_management")

    try:
        oid = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.tasks.delete_one({"_id": oid, "user_id": user["id"]})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    return build_response(request, data={"deleted": task_id}, legacy={"deleted": task_id})


# ======================================================
# TAREAS PENDIENTES (para briefing — NO gated, internal use)
# ======================================================

async def get_pending_tasks(user_id: str) -> List[Dict]:
    """Devuelve tareas pendientes. Usada por assistant.py para el briefing."""
    cursor = db.tasks.find(
        {"user_id": user_id, "done": False}
    ).sort("due_date", 1).limit(10)

    tasks = []
    async for doc in cursor:
        tasks.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "due_date": doc.get("due_date"),
            "priority": doc.get("priority", "normal"),
        })
    return tasks