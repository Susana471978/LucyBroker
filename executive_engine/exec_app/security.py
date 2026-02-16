from fastapi import Header, HTTPException
from exec_app.config import settings

async def require_internal_key(x_exec_key: str = Header(default=None)):
    if not settings.EXEC_INTERNAL_API_KEY:
        raise HTTPException(status_code=500, detail="Internal key not configured")

    if x_exec_key != settings.EXEC_INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
