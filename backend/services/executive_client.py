import httpx
from backend.core.settings import settings


async def restore_executive_session(user_id: str):
    if not settings.exec_internal_api_key:
        raise RuntimeError("EXEC_INTERNAL_API_KEY not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.exec_engine_url}/v1/session/restore",
            headers={"X-EXEC-KEY": settings.exec_internal_api_key},
            json={"user_id": user_id},
        )
        response.raise_for_status()
        return response.json()

async def update_executive_session(user_id: str, fields: dict):
    if not settings.exec_internal_api_key:
        raise RuntimeError("EXEC_INTERNAL_API_KEY not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.exec_engine_url}/v1/session/update",
            headers={"X-EXEC-KEY": settings.exec_internal_api_key},
            json={
                "user_id": user_id,
                "fields": fields,
            },
        )
        response.raise_for_status()
        return response.json()
