from __future__ import annotations

import httpx
from backend.core.settings import settings


async def restore_executive_session(user_id: str):
    """
    Restaura la sesión ejecutiva desde el engine externo.
    Si el engine no está disponible, retorna None silenciosamente.
    """
    if not settings.exec_internal_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.exec_engine_url}/v1/session/restore",
                headers={"X-EXEC-KEY": settings.exec_internal_api_key},
                json={"user_id": user_id},
            )
            response.raise_for_status()
            return response.json()

    except Exception as e:
        # ✔ FIX: fallback silencioso — el engine externo puede no estar activo
        # No interrumpe el flujo principal de la aplicación
        print(f"[executive_client] restore_session unavailable (non-critical): {e}")
        return None


async def update_executive_session(user_id: str, fields: dict):
    """
    Actualiza la sesión ejecutiva en el engine externo.
    Si el engine no está disponible, retorna None silenciosamente.
    """
    if not settings.exec_internal_api_key:
        # ✔ FIX: sin key configurada, no lanza RuntimeError — retorna silencioso
        return None

    try:
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

    except Exception as e:
        # ✔ FIX: fallback silencioso — no rompe summarize ni draft_reply
        print(f"[executive_client] update_session unavailable (non-critical): {e}")
        return None