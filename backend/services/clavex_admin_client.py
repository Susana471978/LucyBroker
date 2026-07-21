from __future__ import annotations

import requests
from backend.config import settings
from backend.utils.logger import get_logger

logger = get_logger("clavex_admin_client")

_admin_token: str | None = None

def login(email: str, password: str) -> bool:
    global _admin_token
    try:
        resp = requests.post(
            f"{settings.clavex_url}/auth/login",
            json={"email": email, "password": password},
            timeout=5,
        )
        if resp.status_code == 200:
            _admin_token = resp.json()["access_token"]
            return True
        logger.error("Login a Clavex fallido: %s", resp.text)
        return False
    except requests.RequestException as e:
        logger.error("Error conectando con Clavex: %s", e)
        return False

def is_logged_in() -> bool:
    return _admin_token is not None

def _headers():
    return {"Authorization": f"Bearer {_admin_token}"}

def list_credentials() -> list[dict]:
    resp = requests.get(f"{settings.clavex_url}/service-credentials", headers=_headers(), timeout=5)
    resp.raise_for_status()
    return resp.json()

def upsert_credential(nombre: str, tipo: str, campos: dict, activo: bool = True) -> dict:
    resp = requests.post(
        f"{settings.clavex_url}/service-credentials",
        headers=_headers(),
        json={"nombre": nombre, "tipo": tipo, "campos": campos, "activo": activo},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()

def deactivate_credential(nombre: str) -> dict:
    resp = requests.delete(f"{settings.clavex_url}/service-credentials/{nombre}", headers=_headers(), timeout=5)
    resp.raise_for_status()
    return resp.json()
