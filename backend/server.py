from __future__ import annotations

import os
from dotenv import load_dotenv
load_dotenv()
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

from fastapi import (
    FastAPI,
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Header,
    Query,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware

from motor.motor_asyncio import AsyncIOMotorClient
import uvicorn

import bcrypt
import jwt
import stripe

from backend.core.settings import settings
from backend.services.executive_client import restore_executive_session
from backend.api.ai import router as ai_router
from backend.core.dependencies import get_current_user
from backend.core.database import db

# =========================
# STRIPE
# =========================
from backend.services.stripe_service import create_checkout_session
from backend.webhooks.stripe_webhook import router as stripe_router

# =========================
# GMAIL
# =========================
from backend.api.gmail import create_gmail_router

# =========================
# AI
# =========================
from backend.api.ai import router as ai_router
# =========================
# MODELOS
# =========================
from backend.models import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
)

# =========================
# RESPONSES
# =========================
from backend.utils.response import build_response

# =========================
# MIDDLEWARE / UTILS
# =========================
from backend.utils.rate_limit import RateLimitMiddleware
from backend.utils.csrf import OAuthCSRFMiddleware
from backend.utils.logger import logger


# ======================================================
# PATHS
# ======================================================

ROOT_DIR = Path(__file__).resolve().parent
CREDENTIALS_DIR = ROOT_DIR / "credentials"
CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)



# ======================================================
# DB (Mongo / Motor async)
# ======================================================

print("MONGO_URL:", settings.mongo_url)
print("MONGO_DB:", settings.mongo_db)

print("EXEC_ENGINE_URL:", settings.exec_engine_url)
print("EXEC_INTERNAL_API_KEY:", settings.exec_internal_api_key)

print("GMAIL_CLIENT_ID:", settings.gmail_client_id)
print("GMAIL_REDIRECT_URI:", settings.gmail_redirect_uri)



# ======================================================
# APP
# ======================================================

app = FastAPI(title="Email Control System API")
api_router = APIRouter(prefix="/api")

# Swagger auth
_bearer_scheme = HTTPBearer(auto_error=False)

# Stripe webhooks (NO van bajo api_router)
app.include_router(stripe_router, prefix="/api")


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
    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = authorization.replace("Bearer ", "").strip()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user = await db.users.find_one(
            {"id": payload["user_id"]},
            {"_id": 0},
        )
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ======================================================
# GMAIL OAUTH
# ======================================================

_gmail_router = create_gmail_router(db, get_current_user)
api_router.include_router(_gmail_router)

api_router.include_router(ai_router)

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
        "trial_seconds_used": 0,
        "trial_limit": 7200,
        "trial_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)

    token = create_token(user_id, user_data.email)

    legacy = TokenResponse(
        token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
        ),
    ).model_dump()

    return build_response(
        request,
        data=legacy,
        legacy=legacy,
        meta={"user_id": user_id},
    )


@api_router.post("/auth/login")
async def login(request: Request, credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})

    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_token(user["id"], user["email"])

    # 🔵 Restaurar sesión executive automáticamente
    try:
        await restore_executive_session(user["id"])
    except Exception:
        logger.exception("Executive session restore failed")

    legacy = TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            language=user.get("language", "es"),
        ),
    ).model_dump()

    return build_response(
        request,
        data=legacy,
        legacy=legacy,
        meta={"user_id": user["id"]},
    )

    try:
        executive_session = await restore_executive_session(user["id"])
        legacy["executive_session"] = executive_session
    except Exception:
        logger.exception("Executive Engine restore failed during login")

    return build_response(
        request,
        data=legacy,
        legacy=legacy,
        meta={"user_id": user["id"]},
    )


@api_router.get("/auth/me")
async def get_me(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    legacy = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        language=user.get("language", "es"),
    ).model_dump()

    # Include admin flag so frontend can use it
    legacy["is_admin"] = bool(user.get("is_admin", False))

    return build_response(request, data=legacy, legacy=legacy)


# ======================================================
# TRIAL
# ======================================================

@api_router.get("/trial/status")
async def trial_status(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    # Admin users and subscribed users bypass trial
    if user.get("is_admin") or user.get("subscription_active"):
        data = {
            "trial_active": False,
            "subscription_active": True,
            "trial_seconds_used": 0,
            "trial_limit": 0,
            "trial_remaining": 0,
            "trial_expired": False,
        }
        return build_response(request, data=data, legacy=data)

    seconds_used = user.get("trial_seconds_used", 0)
    limit = user.get("trial_limit", 7200)
    remaining = max(0, limit - seconds_used)

    data = {
        "trial_active": user.get("trial_active", True),
        "subscription_active": False,
        "trial_seconds_used": seconds_used,
        "trial_limit": limit,
        "trial_remaining": remaining,
        "trial_expired": remaining <= 0,
    }
    return build_response(request, data=data, legacy=data)


@api_router.post("/trial/heartbeat")
async def trial_heartbeat(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    """Frontend calls this periodically (e.g. every 60s) to track active usage."""
    # Admin and subscribed users: no-op
    if user.get("is_admin") or user.get("subscription_active"):
        return build_response(
            request,
            data={"trial_remaining": 0, "trial_expired": False, "subscription_active": True},
            legacy={"trial_remaining": 0, "trial_expired": False, "subscription_active": True},
        )

    increment = 60  # seconds per heartbeat
    seconds_used = user.get("trial_seconds_used", 0) + increment
    limit = user.get("trial_limit", 7200)
    remaining = max(0, limit - seconds_used)
    expired = remaining <= 0

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "trial_seconds_used": seconds_used,
            "trial_active": not expired,
        }},
    )

    data = {
        "trial_remaining": remaining,
        "trial_expired": expired,
        "subscription_active": False,
    }
    return build_response(request, data=data, legacy=data)


# ======================================================
# BILLING (STRIPE)
# ======================================================

@api_router.post("/billing/checkout")
async def billing_checkout(
    request: Request,
    plan: str = Query(..., description="Plan de suscripción (monthly|yearly)"),
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    if plan == "monthly":
        price_id = settings.stripe_price_monthly
    elif plan == "yearly":
        price_id = settings.stripe_price_yearly
    else:
        raise HTTPException(status_code=400, detail="Plan inválido (monthly|yearly)")

    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe no configurado")

    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price_id no configurado")

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
        logger.exception("Stripe error")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception:
        logger.exception("Checkout error")
        raise HTTPException(status_code=500, detail="Error interno creando checkout")

    return build_response(
        request,
        data={"checkout_url": session.url, "session_id": session.id},
        legacy={"checkout_url": session.url, "session_id": session.id},
    )


# ======================================================
# ROUTER + MIDDLEWARE
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

# CORS: ampliado para que funcione también en dominios/subdominios en pruebas.
# Puedes restringirlo luego en producción.
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Permitir FRONTEND_URL si está configurado
frontend_url_env = os.environ.get("FRONTEND_URL")
if frontend_url_env:
    cors_origins.append(frontend_url_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================================================
# LIFECYCLE
# ======================================================

@app.on_event("startup")
async def startup_state():
    app.state.started_at = datetime.now(timezone.utc)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.env == "development",
    )
