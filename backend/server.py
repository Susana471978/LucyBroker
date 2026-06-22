from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Header, Response
from fastapi.middleware.cors import CORSMiddleware

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uvicorn

from backend.config import settings

# ✅ IMPORTS DE MODELOS (CRÍTICO PARA AUTH)
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

from backend.services.activity_service import log_action, get_logs_by_date, generate_csv, generate_summary, generate_pdf
from backend.services.email_service import (
    get_enriched_emails,
    get_email_by_id,
    get_email_stats,
)
from backend.services.rules_engine import calculate_priority

from backend.utils.rate_limit import RateLimitMiddleware
from backend.utils.csrf import OAuthCSRFMiddleware
from backend.utils.logger import logger

import bcrypt
import jwt


try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
except ImportError:
    LlmChat = None
    UserMessage = None


def build_response(request, data=None, legacy=None, meta=None):
    return {
        "data": data,
        "legacy": legacy,
        "meta": meta,
        "path": str(request.url.path) if request else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / '.env')
   
# MongoDB connection
mongo_url = settings.mongo_url
client = AsyncIOMotorClient(mongo_url)
db = client[settings.db_name]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')
JWT_ALGORITHM = 'HS256'
REFRESH_SECRET = os.environ.get('REFRESH_TOKEN_SECRET', 'lucy-refresh-secret-2026')
ACCESS_EXPIRE_MIN = 15
REFRESH_EXPIRE_DAYS = 7

# LLM Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

ai_service = None


# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str, email: str, role: str = "agent") -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, REFRESH_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    is_prod = os.environ.get("ENV", "development") == "production"
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=is_prod, samesite="lax",
        max_age=ACCESS_EXPIRE_MIN * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=is_prod, samesite="lax",
        max_age=REFRESH_EXPIRE_DAYS * 24 * 3600, path="/api/auth/refresh",
    )

def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")

async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Token requerido")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register")
async def register(request: Request, response: Response, user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "role": "agent",
        "language": "es",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)

    access  = create_access_token(user_id, user_data.email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)

    token_response = TokenResponse(
        token=access,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name),
    )
    legacy = token_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user_id})

@api_router.post("/auth/login")
async def login(request: Request, response: Response, credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    access  = create_access_token(user["id"], user["email"], user.get("role", "agent"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)

    token_response = TokenResponse(
        token=access,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            language=user.get("language", "es"),
        ),
    )
    legacy = token_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy, meta={"user_id": user["id"]})

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sin refresh token")
    try:
        payload = jwt.decode(token, REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada, vuelve a iniciar sesión")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    new_access  = create_access_token(user["id"], user["email"], user.get("role", "agent"))
    new_refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, new_access, new_refresh)

    return {"message": "Token renovado"}

@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Sesión cerrada"}

@api_router.get("/auth/me")
async def get_me(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        language=user.get("language", "es"),
    )
    legacy = user_response.model_dump()
    return build_response(request, data=legacy, legacy=legacy)

@api_router.put("/auth/language")
async def update_language(request: Request, response: Response, language: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"language": language}})
    legacy = {"status": "ok", "language": language}
    return build_response(request, data=legacy, legacy=legacy)

# ==================== EMAIL ROUTES ====================


@api_router.get("/emails")
async def get_emails(
    request: Request,
    label: Optional[str] = None,
    has_attachments: Optional[bool] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Get enriched emails with optional filtering"""
    emails = await get_enriched_emails()
    
    if label:
        emails = [e for e in emails if e.priority.priority_label == label]
    
    if has_attachments is not None:
        emails = [e for e in emails if e.email.has_attachments == has_attachments]
    
    legacy = emails
    return build_response(request, data=emails, legacy=legacy, meta={"total": len(emails)})

@api_router.get("/emails/{email_id}")
async def get_email(request: Request, email_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Get single email with priority analysis"""
    email = get_email_by_id(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    enriched = EnrichedEmail(email=email, priority=calculate_priority(email))
    legacy = enriched
    return build_response(request, data=enriched, legacy=legacy)

@api_router.get("/emails/stats/summary")
async def get_email_stats_route(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    """Get email statistics"""
    emails = await get_enriched_emails()
    stats = get_email_stats(emails)
    legacy = stats
    return build_response(request, data=stats, legacy=legacy)

# ==================== AI ROUTES ====================

@api_router.post("/ai/chat")
async def ai_chat(request: Request, payload: ChatRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Process AI chat message and return intent"""
    if not ai_service:
        raise HTTPException(status_code=503, detail="AI service not available in this environment")
    intent = await ai_service.process_intent(payload.message, payload.context)
    legacy = intent.model_dump()
    return build_response(request, data=legacy, legacy=legacy)

@api_router.post("/ai/summarize")
async def ai_summarize(request: Request, payload: SummarizeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Summarize an email"""
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
    """Generate draft replies for an email"""
    if not ai_service:
        raise HTTPException(status_code=503, detail="AI service not available in this environment")
    email = get_email_by_id(payload.email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")

    drafts = await ai_service.draft_reply(email, payload.instructions, payload.tone)
    legacy = {"email_id": payload.email_id, "drafts": drafts}
    return build_response(request, data=legacy, legacy=legacy)

# ==================== BASE ROUTES ====================

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

        client = redis.Redis.from_url(redis_url)
        client.ping()
        return {"status": "ok"}
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)
        return {"status": "error"}


@api_router.get("/")
async def root(request: Request):
    legacy = {"message": "Email Control System API", "version": "1.0.0"}
    return build_response(request, data=legacy, legacy=legacy)


@api_router.get("/health")
@api_router.post("/log/accion")
async def registrar_accion(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    payload = await request.json()
    await log_action(
        db=db,
        user_id=user["user_id"],
        user_name=user.get("name", user.get("email", "Usuario")),
        accion=payload.get("accion", "LEIDO"),
        correo_id=payload.get("correo_id", ""),
        correo_asunto=payload.get("correo_asunto", ""),
        correo_de=payload.get("correo_de", ""),
        categoria=payload.get("categoria", ""),
        prioridad=payload.get("prioridad", ""),
        notas=payload.get("notas", ""),
    )
    return build_response(request, data={"ok": True})

@api_router.get("/log/informe")
async def get_informe(request: Request, fecha: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    if not fecha:
        from datetime import datetime, timezone
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = await get_logs_by_date(db=db, fecha=fecha)
    summary = generate_summary(logs, fecha)
    return build_response(request, data=summary)

@api_router.get("/log/pdf")
async def get_pdf(request: Request, fecha: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    from fastapi.responses import Response
    from datetime import datetime, timezone
    if not fecha:
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = await get_logs_by_date(db=db, fecha=fecha)
    pdf_content = generate_pdf(logs, fecha)
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=informe_objetiva_{fecha}.pdf"}
    )

@api_router.get("/log/csv")
async def get_csv(request: Request, fecha: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    from fastapi.responses import Response
    from datetime import datetime, timezone
    if not fecha:
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = await get_logs_by_date(db=db, fecha=fecha)
    csv_content = generate_csv(logs)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=informe_objetiva_{fecha}.csv"}
    )

async def health_legacy(request: Request):
    legacy = {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
    return build_response(request, data=legacy, legacy=legacy)


@app.get("/health")
async def health_root(request: Request):
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "db": {"status": "ok"},
        "gmail": {"status": "not_configured"},
        "redis": {"status": "not_configured"},
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


# Include router
app.include_router(api_router)

# Middleware
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
    allow_credentials=True,
    allow_origins=settings.cors_origins,
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
