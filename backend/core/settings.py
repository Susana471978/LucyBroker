# backend/core/settings.py
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class StripeSettings(BaseModel):
    enabled: bool = False
    secret_key: Optional[str] = None
    webhook_secret: Optional[str] = None
    price_monthly: Optional[str] = None
    price_yearly: Optional[str] = None


class GmailSettings(BaseModel):
    enabled: bool = False
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None  # e.g. http://127.0.0.1:8000/api/gmail/callback


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "dev"
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://127.0.0.1:8000"

    # Stripe raw env
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_price_monthly: Optional[str] = None
    stripe_price_yearly: Optional[str] = None

    # Gmail raw env
    gmail_client_id: Optional[str] = None
    gmail_client_secret: Optional[str] = None
    gmail_redirect_uri: Optional[str] = None

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


settings = AppSettings()
