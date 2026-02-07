from __future__ import annotations

import os
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uvicorn

import bcrypt
import jwt

from backend.config import settings

# ✅ MODELOS (CRÍTICO PARA AUTH / UI)
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

def build_response(request, data=None, legacy=None, meta=None):
    return {
        "data": data,
        "legacy": legacy,
        "meta": meta,
        "path": str(request.url.path) if request else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

# ======================================================
# DATABASE (Mongo)
# ======================================================

mongo_url = settings.mongo_url
client = AsyncIOMotorClient(mongo_url)
db = client[settings.db_name]

# ======================================================
# JWT
# ======================================================

JWT_SECRET = os.environ.get("JWT_SECRET", settings.jwt_secret)
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", settings.jwt_algorithm)

# ======================================================
# APP
# ======================================================

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token requerido")

    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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
    try:
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
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.users.insert_one(user_doc)

        token = create_token(user_id, user_data.email)

        token_response = TokenResponse(
            token=token,
            user=UserResponse(id=user_id, email=user_data.email, name=user_data.name),
        )
        legacy = token_response.model_dump()
        return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user_id})

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Register failed: %s", exc)
        raise HTTPException(status_code=500, detail="Error interno en registro")


@api_router.post("/auth/login")
async def login(request: Request, credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = create_token(user["id"], user["email"])

    token_response = TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            language=user.get("language", "es"),
        ),
    )
    legacy = token_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user["id"]})


@api_router.get("/auth/me")
async def get_me(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        language=user.get("language", "es"),
    )
    legacy = user_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy)


@api_router.put("/auth/language")
async def update_language(
    request: Request,
    language: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    await db.users.update_one({"id": user["id"]}, {"$set": {"language": language}})
    legacy = {"status": "ok", "language": language}
    return build_response(request, data=legacy, legacy=legacy)


# ======================================================
# EMAIL ROUTES
# ======================================================

def _priority_label_from_enriched(item: Any) -> Optional[str]:
    """
    Soporta dos formas comunes de EnrichedEmail:
    - item.priority.priority_label
    - item["priority"]["priority_label"]
    """
    try:
        return item.priority.priority_label  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        return (item.get("priority") or {}).get("priority_label")  # type: ignore[union-attr]
    except Exception:
        return None


def _has_attachments_from_enriched(item: Any) -> Optional[bool]:
    """
    Soporta:
    - item.email.has_attachments
    - item["email"]["has_attachments"]
    - item.has_attachments (si el modelo lo expone directo)
    """
    for path in (
        ("email", "has_attachments"),
        ("has_attachments",),
    ):
        try:
            if len(path) == 1:
                return bool(getattr(item, path[0]))
            return bool(getattr(getattr(item, path[0]), path[1]))
        except Exception:
            continue

    try:
        email = (item.get("email") or {})
        if "has_attachments" in email:
            return bool(email.get("has_attachments"))
    except Exception:
        pass

    try:
        if "has_attachments" in item:
            return bool(item.get("has_attachments"))
    except Exception:
        pass

    return None


def _load_token_path() -> Path:
    base_dir = Path(__file__).resolve().parent
    return base_dir / "credentials" / "gmail_token.json"


def _gmail_connected() -> bool:
    return _load_token_path().exists()


@api_router.get("/emails")
async def get_emails(
    request: Request,
    label: Optional[str] = None,
    has_attachments: Optional[bool] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Devuelve emails enriquecidos.
    - Si hay Gmail conectado => trae correos reales.
    - Si no => fallback a MOCK.
    """
    try:
        if _gmail_connected():
            emails = fetch_enriched_gmail(max_results=25)
            source = "gmail"
        else:
            emails = get_enriched_emails()
            source = "mock"

        if label:
            emails = [e for e in emails if _priority_label_from_enriched(e) == label]

        if has_attachments is not None:
            emails = [e for e in emails if _has_attachments_from_enriched(e) == has_attachments]

        legacy = emails
        return build_response(request, data=emails, legacy=legacy, meta={"total": len(emails), "source": source})

    except Exception as exc:
        logger.exception("Error fetching emails: %s", exc)
        # fallback final: mock
        emails = get_enriched_emails()
        legacy = emails
        return build_response(
            request,
            data=emails,
            legacy=legacy,
            meta={"total": len(emails), "source": "mock", "error": str(exc)},
        )


@api_router.get("/emails/{email_id}")
async def get_email(request: Request, email_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Get single email with priority analysis (DEMO: busca en mock)"""
    email = get_email_by_id(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    enriched = EnrichedEmail(email=email, priority=calculate_priority(email))
    legacy = enriched
    return build_response(request, data=enriched, legacy=legacy)


@api_router.get("/emails/stats/summary")
async def get_email_stats_route(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Stats para el panel.
    Mantiene compatibilidad con la UI: /api/emails/stats/summary
    """
    try:
        stats = get_email_stats()
        legacy = stats
        return build_response(request, data=stats, legacy=legacy)
    except Exception as exc:
        logger.exception("Error stats summary: %s", exc)
        legacy = {"total": 0, "by_label": {}, "error": str(exc)}
        return build_response(request, data=legacy, legacy=legacy)


# ======================================================
# GMAIL AUTH ROUTES (EXISTENTES EN gmail_auth.py)
# Si ya los incluyes vía backend/main.py, aquí NO hace falta.
# Los dejamos fuera para no duplicar rutas.
# ======================================================


# ======================================================
# AI ROUTES
# ======================================================

@api_router.post("/ai/chat")
async def ai_chat(request: Request, payload: ChatRequest, user: Dict[str, Any] = Depends(get_current_user)):
    if not ai_service:
        raise HTTPException(status_code=503, detail="AI service not available in this environment")
    intent = await ai_service.process_intent(payload.message, payload.context)
    legacy = intent.model_dump()
    return build_response(request, data=legacy, legacy=legacy)


@api_router.post("/ai/summarize")
async def ai_summarize(request: Request, payload: SummarizeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    if not ai_service:
        raise HTTPException(status_code=503, detail="AI service not available in this environment")
    email = get_email_by_id(payload.email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    summary = await ai_service.summarize_email(email)
    legacy = {"email_id": payload.email_id, "summary": summary}
    return build_response(request, data=legacy, legacy=legacy)


@api_router.post("/ai/draft-reply")
async def ai_draft_reply(request: Request, payload: DraftReplyRequest, user: Dict[str, Any] = Depends(get_current_user)):
    if not ai_service:
        raise HTTPException(status_code=503, detail="AI service not available in this environment")
    email = get_email_by_id(payload.email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    drafts = await ai_service.draft_reply(email, payload.instructions, payload.tone)
    legacy = {"email_id": payload.email_id, "drafts": drafts}
    return build_response(request, data=legacy, legacy=legacy)


# ======================================================
# BASE ROUTES / HEALTH
# ======================================================

async def check_db_health() -> Dict[str, Any]:
    try:
        await db.command("ping")
        return {"status": "ok"}
    except Exception as exc:
        logger.error("DB health check failed: %s", exc)
        return {"status": "error"}


async def check_redis_health() -> Dict[str, Any]:
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return {"status": "not_configured"}

    try:
        import redis  # type: ignore

        rclient = redis.Redis.from_url(redis_url)
        rclient.ping()
        return {"status": "ok"}
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)
        return {"status": "error"}


@api_router.get("/")
async def root(request: Request):
    legacy = {"message": "Email Control System API", "version": "1.0.0"}
    return build_response(request, data=legacy, legacy=legacy)


@api_router.get("/health")
async def health_legacy(request: Request):
    legacy = {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
    return build_response(request, data=legacy, legacy=legacy)


@app.get("/health")
async def health_root(request: Request):
    db_status = await check_db_health()
    redis_status = await check_redis_health()
    gmail_status = {"status": "connected"} if _gmail_connected() else {"status": "not_connected"}

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db": db_status,
        "gmail": gmail_status,
        "redis": redis_status,
    }


@app.get("/metrics")
async def metrics_root(request: Request):
    uptime_seconds = 0
    if getattr(app.state, "started_at", None):
        uptime_seconds = int((datetime.now(timezone.utc) - app.state.started_at).total_seconds())

    data = {
        "uptime_seconds": uptime_seconds,
        "emails_total": len(get_enriched_emails()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return build_response(request, data=data, legacy=data)


if settings.env == "development":

    @app.get("/")
    async def dev_root(request: Request):
        payload = {
            "service": "EmailSystem-control",
            "status": "running",
            "env": settings.env,
        }
        return build_response(request, data=payload, legacy=payload)


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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
