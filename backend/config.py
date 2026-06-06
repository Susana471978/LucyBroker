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

    emergent_llm_key: str | None = Field(default=None, alias="EMERGENT_LLM_KEY")
    encryption_key: str | None = Field(default=None, alias="ENCRYPTION_KEY")
    imap_host: str = Field(default="imap.gmail.com", alias="IMAP_HOST")
    imap_port: int = Field(default=993, alias="IMAP_PORT")
    imap_user: str | None = Field(default=None, alias="IMAP_USER")
    imap_password: str | None = Field(default=None, alias="IMAP_PASSWORD")
    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")

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