from __future__ import annotations

import os
import uuid
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Header, Response
from fastapi.middleware.cors import CORSMiddleware

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uvicorn

from backend.config import settings

from backend.services.ai_service import AIService

# ✅ IMPORTS DE MODELOS (CRÍTICO PARA AUTH)
from backend.models import (
    EmailEvent,
    EnrichedEmail,
    MensajeEntrante,
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
from backend.services.push_service import save_subscription, delete_subscription, send_push, broadcast_push
from backend.services.email_service import (
    get_enriched_emails,
    get_mensaje_by_id,
    sincronizar_imap,
    get_email_by_id,
    get_email_stats,
)
from backend.services.mensajes_service import guardar_mensaje, actualizar_estado
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
SSO_SECRET = os.environ.get('SSO_SECRET')
REFRESH_SECRET = os.environ.get('REFRESH_TOKEN_SECRET', 'lucy-refresh-secret-2026')
ACCESS_EXPIRE_MIN = 15
REFRESH_EXPIRE_DAYS = 7

# LLM Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

ai_service = AIService()


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


def create_sso_token(email: str) -> str:
    """Token SSO para los módulos embebidos (Clavex, CRM, Siniestros).
    Indexado por email — cada módulo busca al usuario por email en su propia base.
    Firmado con SSO_SECRET, compartido por los cuatro servicios."""
    payload = {
        "email": email,
        "type": "sso",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MIN),
    }
    return jwt.encode(payload, SSO_SECRET, algorithm=JWT_ALGORITHM)


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

async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Token requerido")
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

def require_role(*roles: str):
    """Dependencia que exige uno de los roles indicados."""
    async def checker(user: Dict[str, Any] = Depends(get_current_user)):
        if user.get("role", "agent") not in roles:
            raise HTTPException(status_code=403, detail="Permiso denegado")
        return user
    return checker

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
            role=user.get("role", "agent"),
        ),
    )
    legacy = token_response.model_dump()
    legacy["sso_token"] = create_sso_token(user["email"])
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

@api_router.get("/auth/users")
async def list_users(request: Request, user: Dict[str, Any] = Depends(require_role("director", "admin"))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return {"users": users}

@api_router.put("/auth/users/{user_id}/role")
async def update_user_role(request: Request, user_id: str, body: dict, user: Dict[str, Any] = Depends(require_role("director", "admin"))):
    new_role = body.get("role")
    if new_role not in ["director", "agent", "admin"]:
        raise HTTPException(status_code=400, detail="Rol inválido")
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": f"Rol actualizado a {new_role}", "user_id": user_id}


@api_router.post("/auth/admin/create-user")
async def admin_create_user(request: Request, body: UserCreate, user: Dict[str, Any] = Depends(require_role("director", "admin"))):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": body.email,
        "password": hash_password(body.password),
        "name": body.name,
        "role": body.role if body.role in ["director", "agent", "admin"] else "agent",
        "language": "es",
        "created_at": datetime.utcnow().isoformat()
    }
    await db.users.insert_one(user_doc)
    return {"message": "Usuario creado", "user_id": user_id, "email": body.email, "role": user_doc["role"]}
@api_router.get("/auth/me")
async def get_me(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        language=user.get("language", "es"),
    )
    legacy = user_response.model_dump()
@api_router.put("/auth/language")
async def update_language(request: Request, response: Response, language: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"language": language}})
    legacy = {"status": "ok", "language": language}
# ==================== EMAIL ROUTES ====================


@api_router.get("/emails")
async def get_emails(
    request: Request,
    label: Optional[str] = None,
    canal: Optional[str] = None,
    has_attachments: Optional[bool] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Bandeja unificada. Lee de Mongo, no de IMAP."""
    emails = await get_enriched_emails(canal=canal)

    if label:
        emails = [e for e in emails if (e.get("priority") or {}).get("priority_label") == label]

    if has_attachments is not None:
        emails = [e for e in emails if (e.get("email") or {}).get("has_attachments") == has_attachments]

    legacy = emails
    return build_response(request, data=emails, legacy=legacy, meta={"total": len(emails)})


@api_router.post("/emails/sincronizar")
async def sincronizar(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    """Trae lo nuevo de IMAP y lo guarda. Es lo unico que llama al modelo."""
    resultado = await sincronizar_imap()
    return build_response(request, data=resultado, legacy=resultado)


@api_router.post("/mensajes/ingesta")
async def ingesta_mensaje(
    request: Request,
    payload: MensajeEntrante,
    x_ingesta_key: str = Header(default=""),
):
    """Entrada a la bandeja desde canales que no son IMAP.

    Lo usa el asistente virtual de la web y, mas adelante, los
    formularios y el webhook de WhatsApp. Se autentica con clave de
    servicio porque quien llama es otro proceso, no una persona con
    sesion iniciada.
    """
    esperada = os.environ.get("INGESTA_KEY", "")
    if not esperada:
        raise HTTPException(status_code=503, detail="Ingesta no configurada")
    if not hmac.compare_digest(x_ingesta_key, esperada):
        logger.warning("Intento de ingesta con clave invalida desde %s", request.client.host if request.client else "?")
        raise HTTPException(status_code=401, detail="Clave de servicio invalida")

    ahora = datetime.now(timezone.utc)
    semilla = f"{payload.canal}|{payload.contacto or payload.remitente}|{payload.cuerpo}|{ahora.isoformat()}"
    mensaje_id = f"{payload.canal.value}-" + hashlib.sha1(semilla.encode("utf-8", "replace")).hexdigest()[:16]

    evento = EmailEvent(
        id=mensaje_id,
        canal=payload.canal,
        thread_id=mensaje_id,
        from_name=payload.remitente,
        from_email=payload.contacto,
        subject=payload.asunto or f"Mensaje desde {payload.canal.value}",
        date=ahora.isoformat(),
        snippet=payload.cuerpo[:200].replace("\n", " "),
        body=payload.cuerpo,
        meta=payload.meta,
    )

    enriched = EnrichedEmail(
        email=evento,
        priority=calculate_priority(evento),
        categoria=payload.meta.get("categoria", "OTRO"),
        datos_clave=payload.meta,
        resumen=payload.cuerpo[:200],
    )

    nuevo = await guardar_mensaje(enriched)
    logger.info("Ingesta %s: %s (nuevo=%s)", payload.canal.value, mensaje_id, nuevo)

    datos = {"id": mensaje_id, "canal": payload.canal.value, "nuevo": nuevo}
    return build_response(request, data=datos, legacy=datos)


@api_router.patch("/emails/{email_id}/estado")
async def cambiar_estado(
    request: Request,
    email_id: str,
    estado: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Marca un mensaje como leido, respondido o archivado."""
    if estado not in ("nuevo", "leido", "respondido", "archivado"):
        raise HTTPException(status_code=400, detail="Estado no valido")
    if not await actualizar_estado(email_id, estado):
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    datos = {"id": email_id, "estado": estado}
    return build_response(request, data=datos, legacy=datos)

@api_router.get("/emails/{email_id}")
async def get_email(request: Request, email_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Un mensaje concreto, ya enriquecido, desde Mongo."""
    mensaje = await get_mensaje_by_id(email_id)
    if not mensaje:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    return build_response(request, data=mensaje, legacy=mensaje)

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

@api_router.get("/health")
@api_router.post("/log/accion")
async def registrar_accion(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    payload = await request.json()
    await log_action(
        db=db,
        user_id=user["id"],
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
async def get_informe(request: Request, fecha: Optional[str] = None, filter_user_id: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    if not fecha:
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    role = user.get("role", "agent")
    uid = user["id"] if role == "agent" else (filter_user_id or None)
    logs = await get_logs_by_date(db=db, fecha=fecha, user_id=uid)
    summary = generate_summary(logs, fecha)
    return build_response(request, data=summary)

@api_router.get("/log/global")
async def get_informe_global(request: Request, fecha: Optional[str] = None, user: Dict[str, Any] = Depends(require_role("director", "admin"))):
    if not fecha:
        fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = await get_logs_by_date(db=db, fecha=fecha, user_id=None)
    summary = generate_summary(logs, fecha)
    ranking = sorted(summary["por_usuario"].items(), key=lambda x: -x[1])
    summary["ranking_usuarios"] = [{"usuario": u, "acciones": n} for u, n in ranking]
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

@api_router.post("/push/subscribe")
async def push_subscribe(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    body = await request.json()
    ok = await save_subscription(db, user["id"], body)
    return {"ok": ok}

@api_router.post("/push/unsubscribe")
async def push_unsubscribe(request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    body = await request.json()
    ok = await delete_subscription(db, user["id"], body.get("endpoint", ""))
    return {"ok": ok}

@api_router.post("/push/send")
async def push_send(request: Request, user: Dict[str, Any] = Depends(require_role("director", "admin"))):
    body = await request.json()
    sent = await broadcast_push(db, body.get("title", "Lucy"), body.get("body", ""), body.get("url", "/"), body.get("role"))
    return {"sent": sent}

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


@api_router.post("/test/send-email")
async def test_send_email(payload: dict):
    """Endpoint de demo: envía un correo real usando las credenciales SMTP
    resueltas vía Clavex (con fallback al .env si Clavex no responde)."""
    from backend.services.smtp_client import send_email
    to = payload.get("to")
    subject = payload.get("subject", "Prueba desde Lucy")
    body = payload.get("body", "Correo de prueba enviado desde Lucy usando credenciales de Clavex.")
    if not to:
        return {"ok": False, "error": "Falta el campo 'to'"}
    enviado = send_email(to, subject, body)
    return {"ok": enviado, "to": to, "subject": subject}

@api_router.post("/clavex/login")
async def clavex_login(payload: dict):
    from backend.services.clavex_admin_client import login
    email = payload.get("email")
    password = payload.get("password")
    ok = login(email, password)
    return {"ok": ok}

@api_router.get("/clavex/service-credentials")
async def clavex_list_credentials():
    from backend.services.clavex_admin_client import list_credentials, is_logged_in
    if not is_logged_in():
        return {"ok": False, "error": "No hay sesion activa con Clavex"}
    return {"ok": True, "data": list_credentials()}

@api_router.post("/clavex/service-credentials")
async def clavex_upsert_credential(payload: dict):
    from backend.services.clavex_admin_client import upsert_credential, is_logged_in
    if not is_logged_in():
        return {"ok": False, "error": "No hay sesion activa con Clavex"}
    result = upsert_credential(
        payload.get("nombre"), payload.get("tipo"),
        payload.get("campos", {}), payload.get("activo", True)
    )
    return {"ok": True, "data": result}

@api_router.delete("/clavex/service-credentials/{nombre}")
async def clavex_deactivate_credential(nombre: str):
    from backend.services.clavex_admin_client import deactivate_credential, is_logged_in
    if not is_logged_in():
        return {"ok": False, "error": "No hay sesion activa con Clavex"}
    return {"ok": True, "data": deactivate_credential(nombre)}

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
