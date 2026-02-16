from fastapi import APIRouter, Depends
from backend.server import get_current_user
from backend.services.executive_client import restore_executive_session
from typing import Dict, Any

router = APIRouter()


@router.post("/executive/session/restore")
async def restore_session(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = str(user["id"])
    result = await restore_executive_session(user_id)
    return result
