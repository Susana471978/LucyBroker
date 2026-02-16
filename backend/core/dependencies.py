from typing import Dict, Any, Optional
from fastapi import Header, HTTPException
import jwt

from backend.core.settings import settings
from backend.core.database import db


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = authorization.replace("Bearer ", "").strip()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )

        user = await db.users.find_one(
            {"id": payload["user_id"]},
            {"_id": 0},
        )

        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")

        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")

    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
