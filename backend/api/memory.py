# backend/api/memory.py
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Any, Dict

from backend.utils.response import build_response
from backend.core.dependencies import get_current_user
from backend.core.database import db
from backend.services.user_memory import get_user_memory, add_memory_note, delete_memory_note

router = APIRouter(prefix="/memory", tags=["memory"])

@router.get("")
async def get_memory(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    memory = await get_user_memory(db, user["id"])
    notes = memory.get("notes", [])
    return build_response(request, data={"notes": notes}, legacy={"notes": notes})

@router.post("")
async def add_note(request: Request, payload: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    text = (payload.get("text") or "").strip()
    category = payload.get("category", "general")
    if not text:
        raise HTTPException(status_code=400, detail="El texto es obligatorio")
    if category not in ("general", "proyecto", "cliente", "preferencia"):
        category = "general"
    memory = await add_memory_note(db, user["id"], text, category)
    notes = memory.get("notes", [])
    return build_response(request, data={"notes": notes}, legacy={"notes": notes})

@router.delete("/{note_id}")
async def delete_note(note_id: str, request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    memory = await delete_memory_note(db, user["id"], note_id)
    notes = memory.get("notes", [])
    return build_response(request, data={"notes": notes}, legacy={"notes": notes})