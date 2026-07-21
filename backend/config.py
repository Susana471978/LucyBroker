from __future__ import annotations
import os
import secrets
import requests
from pathlib import Path
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ConfigDict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

def _resolve_env() -> str:
    return os.environ.get("ENV", "development").lower()

def _resolve_mongo_url() -> str:
    env = _resolve_env()
    value = os.environ.get("MONGO_URL")
    if value:
        return value
    if env == "development":
        return "mongodb://localhost:27017"
    raise ValueError("MONGO_URL is required in production")

def _resolve_db_name() -> str:
    env = _resolve_env()
    value = os.environ.get("DB_NAME")
    if value:
        return value
    if env == "development":
        return "emailsystem_dev"
    raise ValueError("DB_NAME is required in production")

# ── Clavex service credentials ──────────────────────────────────
_CLAVEX_URL = os.environ.get("CLAVEX_URL", "http://127.0.0.1:8020")
_SERVICE_API_KEY = os.environ.get("SERVICE_API_KEY")
_clavex_cache: dict = {}

def _fetch_from_clavex(nombre: str) -> dict | None:
    if nombre in _clavex_cache:
        return _clavex_cache[nombre]
    if not _SERVICE_API_KEY:
        return None
    try:
        resp = requests.get(
            f"{_CLAVEX_URL}/service-credentials/{nombre}",
            headers={"X-Service-Key": _SERVICE_API_KEY},
            timeout=3,
        )
        if resp.status_code == 200:
            data = resp.json()["campos"]
            _clavex_cache[nombre] = data
            return data
    except requests.RequestException:
        pass
    return None

def _imap_field(field: str, env_var: str, default=None):
    creds = _fetch_from_clavex("lucy_imap_principal")
    if creds and field in creds:
        return creds[field]
    return os.environ.get(env_var, default)

def _smtp_field(field: str, env_var: str, default=None):
    creds = _fetch_from_clavex("lucy_smtp_principal")
    if creds and field in creds:
        return creds[field]
    return os.environ.get(env_var, default)

class Settings(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    env: str = Field(default_factory=_resolve_env, alias="ENV")
    mongo_url: str = Field(default_factory=_resolve_mongo_url, alias="MONGO_URL")
    db_name: str = Field(default_factory=_resolve_db_name, alias="DB_NAME")
    jwt_secret: str = Field(
        default_factory=lambda: os.environ.get("JWT_SECRET") or secrets.token_urlsafe(32)
    )
    jwt_algorithm: str = "HS256"
    emergent_llm_key: str | None = Field(default_factory=lambda: os.environ.get("EMERGENT_LLM_KEY"))
    encryption_key: str | None = Field(default_factory=lambda: os.environ.get("ENCRYPTION_KEY"))
    imap_host: str = Field(default_factory=lambda: _imap_field("host", "IMAP_HOST", "imap.gmail.com"))
    imap_port: int = Field(default_factory=lambda: int(_imap_field("puerto", "IMAP_PORT", "993")))
    imap_user: str | None = Field(default_factory=lambda: _imap_field("usuario", "IMAP_USER"))
    imap_password: str | None = Field(default_factory=lambda: _imap_field("password", "IMAP_PASSWORD"))
    smtp_host: str = Field(default_factory=lambda: _smtp_field("host", "SMTP_HOST", "smtp.gmail.com"))
    smtp_port: int = Field(default_factory=lambda: int(_smtp_field("puerto", "SMTP_PORT", "587")))
    smtp_user: str | None = Field(default_factory=lambda: _smtp_field("usuario", "SMTP_USER"))
    smtp_password: str | None = Field(default_factory=lambda: _smtp_field("password", "SMTP_PASSWORD"))
    groq_api_key: str | None = Field(default_factory=lambda: os.environ.get("GROQ_API_KEY"))
    cors_origins: List[str] = Field(
        default_factory=lambda: os.environ.get("CORS_ORIGINS", "*").split(",")
    )
    rate_limit_requests: int = Field(
        default_factory=lambda: int(os.environ.get("RATE_LIMIT_REQUESTS", "120"))
    )
    rate_limit_window_seconds: int = Field(
        default_factory=lambda: int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))
    )
    csrf_header_name: str = Field(default="X-CSRF-Token")
    csrf_cookie_name: str = Field(default="csrf_token")
    clavex_url: str = Field(default_factory=lambda: os.environ.get("CLAVEX_URL", "http://127.0.0.1:8020"))

settings = Settings()
