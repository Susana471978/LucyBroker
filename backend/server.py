from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware

from motor.motor_asyncio import AsyncIOMotorClient
import uvicorn

import bcrypt
import jwt
import stripe  # ✅ IMPORT NECESARIO

from backend.config import settings

# ✅ STRIPE
from backend.services.stripe_service import create_checkout_session
from backend.webhooks.stripe_webhook import router as stripe_router

# ✅ MODELOS
from backend.models import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    EnrichedEmail,
    ChatRequest,
    SummarizeRequest,
    DraftReplyRequest,
)

# ✅ SERVICIOS DEMO
from backend.services.email_service import (
    get_enriched_emails,
    get_email_by_id,
    get_email_stats,
)
from backend.services.rules_engine import calculate_priority

# ✅ GMAIL
from backend.services.gmail_email_adapter import fetch_enriched_gmail

# ✅ MIDDLEWARE / LOG
from backend.utils.rate_limit import RateLimitMiddleware
from backend.utils.csrf import OAuthCSRFMiddleware
from backend.utils.logger import logger


try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:
    LlmChat = None
    UserMessage = None


# ======================================================
# HELPERS
# ======================================================

def build_response(request: Request | None, data=None, legacy=None, meta=None):
    return {
        "data": data,
        "legacy": legacy,
        "meta": meta,
        "path": str(request.url.path) if request else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ======================================================
# PATHS (credentials)
# ======================================================

# ⚠️ NO cargamos .env aquí.
# `backend.config` es la única fuente de configuración.
ROOT_DIR = Path(__file__).resolve().parent
CREDENTIALS_DIR = ROOT_DIR / "credentials"
CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)


# ======================================================
# DATABASE (Mongo)
# ======================================================

client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]


# ======================================================
# APP
# ======================================================

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ✅ Webhooks Stripe (van sobre app, no api_router)
app.include_router(stripe_router)

ai_service = None


# ======================================================
# AUTH HELPERS
# ======================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ======================================================
# AUTH ROUTES
# ======================================================

@api_router.post("/auth/register")
async def register(request: Request, user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "language": "es",
        "plan": "demo",
        "subscription_active": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)

    token = create_token(user_id, user_data.email)
    legacy = TokenResponse(
        token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name),
    ).model_dump()

    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user_id})


@api_router.post("/auth/login")
async def login(request: Request, credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_token(user["id"], user["email"])
    legacy = TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            language=user.get("language", "es"),
        ),
    ).model_dump()

    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user["id"]})


@api_router.get("/auth/me")
async def get_me(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    legacy = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        language=user.get("language", "es"),
    ).model_dump()
    return build_response(request, data=legacy, legacy=legacy)


# ======================================================
# BILLING (STRIPE)
# ======================================================

@api_router.post("/billing/checkout")
async def billing_checkout(
    request: Request,
    plan: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if plan == "monthly":
        price_id = settings.stripe_price_monthly
    elif plan == "yearly":
        price_id = settings.stripe_price_yearly
    else:
        raise HTTPException(status_code=400, detail="Plan inválido (monthly|yearly)")

    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe no configurado: falta STRIPE_SECRET_KEY")

    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe no configurado: falta price_id del plan")

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    try:
        session = create_checkout_session(
            user_id=user["id"],
            email=user["email"],
            price_id=price_id,
            success_url=f"{frontend_url}/billing/success",
            cancel_url=f"{frontend_url}/billing/cancel",
        )
    except stripe.error.StripeError as e:
        logger.exception("Stripe error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Checkout error: %s", e)
        raise HTTPException(status_code=500, detail="Error interno creando checkout")

    return build_response(
        request,
        data={"checkout_url": session.url, "session_id": session.id},
        legacy={"checkout_url": session.url, "session_id": session.id},
    )


# ======================================================
# ROUTER + MIDDLEWARE + LIFECYCLE
# ======================================================

app.include_router(api_router)

app.add_middleware(
    RateLimitMiddleware,
    max_requests=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
    logger=logger,
)

app.add_middleware(
    OAuthCSRFMiddleware,
    header_name=settings.csrf_header_name,
    cookie_name=settings.csrf_cookie_name,
    logger=logger,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_state():
    app.state.started_at = datetime.now(timezone.utc)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


if __name__ == "__main__":
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.env == "development",
    )
