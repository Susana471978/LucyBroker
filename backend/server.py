from __future__ import annotations

import os
import inspect
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import (
    FastAPI,
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Header,
    Query,
    Response,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware

import uvicorn
import bcrypt
import jwt
import stripe

from backend.core.settings import settings
from backend.services.executive_client import restore_executive_session
from backend.services.executive_memory import ensure_ttl_index

# =========================
# AI
# =========================
from backend.api.ai import router as ai_router
from backend.api.tasks import router as tasks_router
from backend.api.memory import router as memory_router

from backend.api.billing import router as billing_router

from backend.api.contacts import router as contacts_router

# Junto a los otros imports arriba
from backend.api.assistant import router as assistant_router

from backend.api.calendar import create_calendar_router

from backend.api.habits import router as habits_router

from backend.api.alerts import router as alerts_router

from backend.api.vip_companies import create_vip_companies_router


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
# TTS (ElevenLabs)
# =========================
from backend.services.tts_service import generate_tts_audio, stream_openai_tts

# =========================
# DB
# =========================
from backend.core.database import db

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
# DEBUG — SEGURO (secrets enmascarados)
# ======================================================

def _mask(value: Optional[str], show: int = 6) -> str:
    """Muestra solo los primeros `show` caracteres de un secret."""
    if not value:
        return "(not set)"
    if len(value) <= show:
        return "***"
    return value[:show] + "***"


logger.info("MONGO_URL: %s", _mask(settings.mongo_url, 20))
logger.info("MONGO_DB: %s", settings.mongo_db)
logger.info("EXEC_ENGINE_URL: %s", settings.exec_engine_url or "(not set)")
logger.info("EXEC_INTERNAL_API_KEY: %s", _mask(settings.exec_internal_api_key))
logger.info("GMAIL_CLIENT_ID: %s", _mask(settings.gmail_client_id, 12))
logger.info("GMAIL_REDIRECT_URI: %s", settings.gmail_redirect_uri or "(not set)")
logger.info("JWT_SECRET configured: %s", "YES" if settings.jwt_secret and settings.jwt_secret != "change_me" else "⚠️  NO — USING DEFAULT (INSECURE)")
logger.info("STRIPE_SECRET_KEY: %s", _mask(settings.stripe_secret_key, 12))


# ======================================================
# HELPERS DB (COMPAT Motor async / PyMongo sync)
# ======================================================

async def _maybe_await(result):
    if inspect.isawaitable(result):
        return await result
    return result


async def db_find_one(collection, *args, **kwargs):
    return await _maybe_await(collection.find_one(*args, **kwargs))


async def db_insert_one(collection, *args, **kwargs):
    return await _maybe_await(collection.insert_one(*args, **kwargs))


async def db_update_one(collection, *args, **kwargs):
    return await _maybe_await(collection.update_one(*args, **kwargs))


# ======================================================
# APP
# ======================================================

app = FastAPI(title="Email Control System API")
api_router = APIRouter(prefix="/api")

# Swagger auth
_bearer_scheme = HTTPBearer(auto_error=False)

# Stripe webhooks (NO van bajo api_router)
app.include_router(stripe_router, prefix="/api")

app.include_router(contacts_router, prefix="/api")

api_router.include_router(assistant_router)

api_router.include_router(habits_router)

api_router.include_router(billing_router)


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
    """
    IMPORTANTE:
    - Funciona con Motor (async) y con PyMongo (sync).
    - Evita falsos 401 "Token inválido" cuando el problema era 'await' sobre PyMongo.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = authorization.replace("Bearer ", "").strip()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )

        user = await db_find_one(
            db.users,
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
    except HTTPException:
        raise
    except Exception:
        logger.exception("Auth error (DB/unknown)")
        raise HTTPException(status_code=401, detail="Token inválido")

vip_router = create_vip_companies_router(db, get_current_user)
app.include_router(vip_router, prefix="/api")

# ======================================================
# ROUTERS (orden importante)
# ======================================================

# GMAIL OAUTH
_gmail_router = create_gmail_router(db, get_current_user)
api_router.include_router(_gmail_router)

# CALENDAR OAUTH
_calendar_router = create_calendar_router(db, get_current_user)
api_router.include_router(_calendar_router)

# AI router ✅ (esto garantiza /api/ai/...)
api_router.include_router(ai_router)

# TASKS router
api_router.include_router(tasks_router)
api_router.include_router(memory_router)
api_router.include_router(alerts_router)

from backend.api.reminders import router as reminders_router
api_router.include_router(reminders_router)

# ======================================================
# TTS ROUTES (ElevenLabs)
# ======================================================

tts_router = APIRouter(prefix="/tts", tags=["TTS"])


@tts_router.post("")
async def tts_endpoint(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    """
    Devuelve audio/mpeg generado por ElevenLabs.
    Nota: NO usamos build_response aquí porque devolvemos bytes de audio.
    """
    text = (payload or {}).get("text", "")
    text = text.strip() if isinstance(text, str) else ""

    if not text:
        raise HTTPException(status_code=400, detail="Texto vacío")

    try:
        audio_bytes = await generate_tts_audio(text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception:
        logger.exception("TTS error")
        raise HTTPException(status_code=502, detail="Error generando audio")


api_router.include_router(tts_router)
@tts_router.post("/stream")
async def tts_stream_endpoint(
    request: Request,
    payload: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    """Streaming TTS — empieza a devolver audio antes de tener el blob completo."""
    from fastapi.responses import StreamingResponse
    text = (payload or {}).get("text", "")
    text = text.strip() if isinstance(text, str) else ""
    if not text:
        raise HTTPException(status_code=400, detail="Texto vacío")
    try:
        return StreamingResponse(
            stream_openai_tts(text),
            media_type="audio/mpeg",
            headers={"X-Accel-Buffering": "no"},
        )
    except Exception:
        logger.exception("TTS stream error")
        raise HTTPException(status_code=502, detail="Error generando audio")


# ======================================================
# AUTH ROUTES
# ======================================================

@api_router.post("/auth/register")
async def register(request: Request, user_data: UserCreate):
    existing = await db_find_one(db.users, {"email": user_data.email}, {"_id": 0})
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
        "trial_limit": 14400,
        "trial_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db_insert_one(db.users, user_doc)

    token = create_token(user_id, user_data.email)

    legacy = TokenResponse(
        token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
        ),
    ).model_dump()

    # flags extra (compatibilidad frontend)
    legacy["user"]["gmail_connected"] = False
    legacy["user"]["is_admin"] = False

    return build_response(
        request,
        data=legacy,
        legacy=legacy,
        meta={"user_id": user_id},
    )


@api_router.post("/auth/login")
async def login(request: Request, credentials: UserLogin):
    user = await db_find_one(db.users, {"email": credentials.email}, {"_id": 0})

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

    # flags extra (compatibilidad frontend)
    legacy["user"]["gmail_connected"] = bool(user.get("gmail_connected", False))
    legacy["user"]["is_admin"] = bool(user.get("is_admin", False))

    # Restaurar sesión executive automáticamente
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

    legacy["is_admin"] = bool(user.get("is_admin", False))
    legacy["gmail_connected"] = bool(user.get("gmail_connected", False))

    return build_response(request, data=legacy, legacy=legacy)

from pydantic import BaseModel as _BaseModel
 
class _LanguageUpdate(_BaseModel):
    language: str   # "es" | "en"
 
@api_router.put("/auth/language")
async def update_language(
    request: Request,
    body: _LanguageUpdate,
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    lang = body.language.strip().lower()
    if lang not in ("es", "en"):
        raise HTTPException(status_code=400, detail="Idioma no soportado. Usa 'es' o 'en'.")
 
    await db_update_one(
        db.users,
        {"id": user["id"]},
        {"$set": {"language": lang}},
    )
 
    data = {"language": lang}
    return build_response(request, data=data, legacy=data)


# ======================================================
# TRIAL
# ======================================================

@api_router.get("/trial/status")
async def trial_status(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
    _credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
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
    if user.get("is_admin") or user.get("subscription_active"):
        return build_response(
            request,
            data={"trial_remaining": 0, "trial_expired": False, "subscription_active": True},
            legacy={"trial_remaining": 0, "trial_expired": False, "subscription_active": True},
        )

    increment = 60
    seconds_used = user.get("trial_seconds_used", 0) + increment
    limit = user.get("trial_limit", 14400)
    remaining = max(0, limit - seconds_used)
    expired = remaining <= 0

    await db_update_one(
        db.users,
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
# ROUTER + MIDDLEWARE
# ======================================================

# ✅ Registrar el api_router al final, después de incluir subrouters
app.include_router(api_router)

# --- DEBUG ROUTES (solo en desarrollo) ---
if settings.env == "development":
    logger.info("=== ROUTES REGISTERED ===")
    for r in app.routes:
        try:
            methods = ",".join(sorted(getattr(r, "methods", []) or []))
            path = getattr(r, "path", "")
            name = getattr(r, "name", "")
            if "/ai" in path or "/api" in path:
                logger.info("%20s %35s %s", methods, path, name)
        except Exception:
            pass
    logger.info("=== END ROUTES ===")

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

# CORS — restringido a métodos y headers necesarios
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
frontend_url_env = os.environ.get("FRONTEND_URL") or getattr(settings, "frontend_url", None)
if frontend_url_env:
    cors_origins.append(frontend_url_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(cors_origins)),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-CSRF-Token",
    ],
)


# ======================================================
# LIFECYCLE
# ======================================================

@app.on_event("startup")
async def startup_state():
    app.state.started_at = datetime.now(timezone.utc)

    # JWT secret safety check
    if not settings.jwt_secret or settings.jwt_secret == "change_me":
        logger.critical("JWT_SECRET is not configured or uses default value. This is a security risk!")

    # 🔵 Inicializar índice TTL para memoria Executive
    try:
        await ensure_ttl_index(db)
        logger.info("Executive memory TTL index ensured")
    except Exception:
        logger.exception("Error ensuring Executive TTL index")

    # 🔵 Índices MongoDB para colecciones frecuentes
    try:
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.tasks.create_index([("user_id", 1), ("done", 1)])
        await db.habits.create_index("user_id")
        await db.reminders.create_index([("user_id", 1), ("done", 1), ("remind_at", 1)])
        await db.alert_dismissals.create_index([("user_id", 1), ("date", 1)])
        logger.info("MongoDB indexes ensured")
    except Exception:
        logger.exception("Error creating MongoDB indexes (non-fatal)")


@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        if hasattr(db, "client") and db.client:
            db.client.close()
    except Exception:
        logger.exception("Error closing DB client")


if __name__ == "__main__":
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.env == "development",
    )