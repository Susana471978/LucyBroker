from __future__ import annotations

import os
import secrets
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic import BaseModel, Field, ConfigDict

# ======================================================
# ENV
# ======================================================

# 📌 Raíz real del proyecto (EmailSystem-control/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 🔑 Cargar .env desde la raíz
load_dotenv(PROJECT_ROOT / ".env")


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


# ======================================================
# SETTINGS
# ======================================================

class Settings(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    # ======================================================
    # CORE
    # ======================================================
    env: str = Field(default_factory=_resolve_env, alias="ENV")
    mongo_url: str = Field(default_factory=_resolve_mongo_url, alias="MONGO_URL")
    db_name: str = Field(default_factory=_resolve_db_name, alias="DB_NAME")

    # ======================================================
    # AUTH / SECURITY
    # ======================================================
    jwt_secret: str = Field(
        default_factory=lambda: os.environ.get("JWT_SECRET") or secrets.token_urlsafe(32),
        alias="JWT_SECRET",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    encryption_key: str | None = Field(default=None, alias="ENCRYPTION_KEY")

    # ======================================================
    # AI / LLM
    # ======================================================
    emergent_llm_key: str | None = Field(default=None, alias="EMERGENT_LLM_KEY")

    # ======================================================
    # STRIPE 💳 (FIX APLICADO AQUÍ)
    # ======================================================
    stripe_secret_key: str | None = Field(
        default_factory=lambda: os.environ.get("STRIPE_SECRET_KEY"),
        alias="STRIPE_SECRET_KEY",
    )
    stripe_webhook_secret: str | None = Field(
        default_factory=lambda: os.environ.get("STRIPE_WEBHOOK_SECRET"),
        alias="STRIPE_WEBHOOK_SECRET",
    )
    stripe_price_monthly: str | None = Field(
        default_factory=lambda: os.environ.get("STRIPE_PRICE_MONTHLY"),
        alias="STRIPE_PRICE_MONTHLY",
    )
    stripe_price_yearly: str | None = Field(
        default_factory=lambda: os.environ.get("STRIPE_PRICE_YEARLY"),
        alias="STRIPE_PRICE_YEARLY",
    )

    # ======================================================
    # CORS / RATE LIMIT / CSRF
    # ======================================================
    cors_origins: List[str] = Field(
        default_factory=lambda: os.environ.get("CORS_ORIGINS", "*").split(","),
        alias="CORS_ORIGINS",
    )

    rate_limit_requests: int = Field(
        default_factory=lambda: int(os.environ.get("RATE_LIMIT_REQUESTS", "120")),
        alias="RATE_LIMIT_REQUESTS",
    )
    rate_limit_window_seconds: int = Field(
        default_factory=lambda: int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60")),
        alias="RATE_LIMIT_WINDOW_SECONDS",
    )

    csrf_header_name: str = Field(default="X-CSRF-Token", alias="CSRF_HEADER_NAME")
    csrf_cookie_name: str = Field(default="csrf_token", alias="CSRF_COOKIE_NAME")


# ======================================================
# INSTANCE
# ======================================================

settings = Settings()
