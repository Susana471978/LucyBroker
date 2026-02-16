from fastapi import APIRouter, Depends
from backend.services.executive_client import restore_executive_session
from backend.utils.crypto import decode_token  # usa tu sistema real
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException

router = APIRouter(prefix="/api/executive", tags=["executive"])

security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = decode_token(credentials.credentials)
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/session/restore")
async def restore_session(user=Depends(get_current_user)):
    user_id = str(user.get("user_id") or user.get("id"))
    result = await restore_executive_session(user_id)
    return result
