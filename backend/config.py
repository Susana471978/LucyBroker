from __future__ import annotations

import os
import secrets
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ConfigDict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


def _resolve_env() -> str:
    return os.environ.get("ENV", "development").lower()


class ImapAccount(BaseModel):
    host: str
    port: int
    user: str
    password: str
    buzon: str = ""


def _resolve_imap_accounts() -> List["ImapAccount"]:
    cuentas: List[ImapAccount] = []
    sufijo = ""
    i = 1
    while True:
        user = os.environ.get(f"IMAP_USER{sufijo}")
        if not user:
            break
        host = os.environ.get(f"IMAP_HOST{sufijo}", "imap.gmail.com")
        port = int(os.environ.get(f"IMAP_PORT{sufijo}", "993"))
        password = os.environ.get(f"IMAP_PASSWORD{sufijo}", "")
        buzon = os.environ.get(f"IMAP_BUZON{sufijo}", "principal" if not sufijo else user)
        cuentas.append(ImapAccount(host=host, port=port, user=user, password=password, buzon=buzon))
        i += 1
        sufijo = f"_{i}"
    return cuentas


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
    imap_host: str = Field(default_factory=lambda: os.environ.get("IMAP_HOST", "imap.gmail.com"))
    imap_port: int = Field(default_factory=lambda: int(os.environ.get("IMAP_PORT", "993")))
    imap_user: str | None = Field(default_factory=lambda: os.environ.get("IMAP_USER"))
    imap_password: str | None = Field(default_factory=lambda: os.environ.get("IMAP_PASSWORD"))
    imap_accounts: List["ImapAccount"] = Field(default_factory=_resolve_imap_accounts)
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


settings = Settings()