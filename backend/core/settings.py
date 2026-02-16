# backend/core/settings.py

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


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
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # ===== Core =====
    env: str = "development"
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://127.0.0.1:8000"

    # ===== Security =====
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"

    # ===== Mongo =====
    mongo_url: str
    mongo_db: str = "email_control_system"


    # ===== Stripe =====
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_price_monthly: Optional[str] = None
    stripe_price_yearly: Optional[str] = None

    # ===== Gmail =====
    gmail_client_id: Optional[str] = None
    gmail_client_secret: Optional[str] = None
    gmail_redirect_uri: Optional[str] = None

    # ===== Executive Engine =====
    exec_engine_url: Optional[str] = None
    exec_internal_api_key: Optional[str] = None

    # ===== CSRF =====
    csrf_header_name: str = "X-CSRF-Token"
    csrf_cookie_name: str = "csrf_token"

    # ===== Rate limit =====
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60

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


# Instancia global
settings = AppSettings()
