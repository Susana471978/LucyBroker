# backend/core/settings.py

from __future__ import annotations

from pathlib import Path
from typing import Optional, List

from pydantic import BaseModel, Field, AliasChoices
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


# ======================================================
# PATHS
# ======================================================
# BACKEND_DIR points to the backend/ folder (where .env.* files live).
# ROOT_DIR is the repo root (one level above backend/).
BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent

# Select .env file based on APP_ENV (default: development).
# Matches the loading strategy in backend/server.py - single source of truth.
APP_ENV = os.environ.get("APP_ENV", "development").lower()
ENV_FILE = BACKEND_DIR / f".env.{APP_ENV}"


# ======================================================
# STRIPE
# ======================================================

class StripeSettings(BaseModel):
    enabled: bool = False
    secret_key: Optional[str] = None
    webhook_secret: Optional[str] = None
    price_monthly: Optional[str] = None
    price_yearly: Optional[str] = None


# ======================================================
# GMAIL
# ======================================================

class GmailSettings(BaseModel):
    enabled: bool = False
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None


# ======================================================
# MAIN SETTINGS
# ======================================================

class AppSettings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ===== Core =====
    env: str = Field(default="development", validation_alias="ENV")
    frontend_url: str = Field(default="http://localhost:3000", validation_alias="FRONTEND_URL")
    backend_url: str = Field(default="http://127.0.0.1:8000", validation_alias="BACKEND_URL")

    # ===== Security =====
    jwt_secret: str = Field(
        default="change_me",
        validation_alias=AliasChoices("JWT_SECRET", "SECRET_KEY"),
    )

    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM", "ALGORITHM"),
    )

    # ===== Rate Limiting (🔥 esto faltaba)
    rate_limit_requests: int = Field(
        default=100,
        validation_alias="RATE_LIMIT_REQUESTS"
    )

    rate_limit_window_seconds: int = Field(
        default=60,
        validation_alias="RATE_LIMIT_WINDOW_SECONDS"
    )

    # ===== Mongo =====
    mongo_url: str = Field(..., validation_alias="MONGO_URL")

    mongo_db: str = Field(
        default="email_control_system",
        validation_alias=AliasChoices("MONGO_DB", "DB_NAME"),
    )

    # ===== Stripe =====
    stripe_secret_key: Optional[str] = Field(default=None, validation_alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: Optional[str] = Field(default=None, validation_alias="STRIPE_WEBHOOK_SECRET")
    stripe_price_monthly: Optional[str] = Field(default=None, validation_alias="STRIPE_PRICE_MONTHLY")
    stripe_price_yearly: Optional[str] = Field(default=None, validation_alias="STRIPE_PRICE_YEARLY")

    # ===== Gmail =====
    gmail_client_id: Optional[str] = Field(default=None, validation_alias="GMAIL_CLIENT_ID")
    gmail_client_secret: Optional[str] = Field(default=None, validation_alias="GMAIL_CLIENT_SECRET")
    gmail_redirect_uri: Optional[str] = Field(default=None, validation_alias="GMAIL_REDIRECT_URI")

    # ===== Executive Engine =====
    exec_engine_url: Optional[str] = Field(default=None, validation_alias="EXEC_ENGINE_URL")
    exec_internal_api_key: Optional[str] = Field(default=None, validation_alias="EXEC_INTERNAL_API_KEY")

    # ===== CORS =====
    cors_origins: Optional[str] = Field(default=None, validation_alias="CORS_ORIGINS")

    # ===== CSRF =====
    csrf_enabled: bool = Field(
        default=False,
        validation_alias="CSRF_ENABLED"
    )

    csrf_header_name: str = Field(
        default="X-CSRF-Token",
        validation_alias="CSRF_HEADER_NAME"
    )

    csrf_cookie_name: str = Field(
        default="csrf_token",
        validation_alias="CSRF_COOKIE_NAME"
    )

    csrf_secret: str = Field(
        default="change_me_csrf_secret",
        validation_alias="CSRF_SECRET"
    )

    # ======================================================
    # HELPERS
    # ======================================================

    def stripe(self) -> StripeSettings:
        enabled = all([
            self.stripe_secret_key,
            self.stripe_webhook_secret,
            self.stripe_price_monthly,
            self.stripe_price_yearly,
        ])
        return StripeSettings(
            enabled=enabled,
            secret_key=self.stripe_secret_key,
            webhook_secret=self.stripe_webhook_secret,
            price_monthly=self.stripe_price_monthly,
            price_yearly=self.stripe_price_yearly,
        )

    def gmail(self) -> GmailSettings:
        enabled = all([
            self.gmail_client_id,
            self.gmail_client_secret,
            self.gmail_redirect_uri,
        ])
        return GmailSettings(
            enabled=enabled,
            client_id=self.gmail_client_id,
            client_secret=self.gmail_client_secret,
            redirect_uri=self.gmail_redirect_uri,
        )

    def cors_list(self) -> List[str]:
        if not self.cors_origins:
            return []
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = AppSettings()
