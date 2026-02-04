from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'default-secret-key')
JWT_ALGORITHM = 'HS256'

# LLM Config
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== DATA CONTRACTS ====================

class EmailAttachment(BaseModel):
    id: str
    name: str
    size: int
    mime_type: str

class EmailEvent(BaseModel):
    """Standard email representation (provider-independent)"""
    model_config = ConfigDict(extra="ignore")
    id: str
    thread_id: str
    from_name: str
    from_email: str
    subject: str
    date: str
    snippet: str
    body: str
    labels: List[str] = []
    has_attachments: bool = False
    attachments: List[EmailAttachment] = []
    meta: Dict[str, Any] = {}

class PriorityResult(BaseModel):
    """Priority analysis output"""
    priority_score: int = Field(ge=0, le=100)
    priority_label: str  # PRIORITARIO / SEGUIMIENTO / INFO
    explain: str
    rule_hits: List[str] = []
    version: str = "1.0"

class ActionPlan(BaseModel):
    """Future autonomous agent action plan (stub)"""
    recommended_actions: List[str] = []
    risk_level: str = "low"
    requires_human_confirmation: bool = True
    rationale: str = ""
    audit_tags: List[str] = []

class EnrichedEmail(BaseModel):
    """Email with priority result"""
    email: EmailEvent
    priority: PriorityResult

# ==================== AUTH MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    language: str = "es"

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

# ==================== AI MODELS ====================

class AIIntent(BaseModel):
    assistant_text: str
    intent: str
    ui_state: str = "default"
    action: Dict[str, Any] = {}

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

class SummarizeRequest(BaseModel):
    email_id: str

class DraftReplyRequest(BaseModel):
    email_id: str
    instructions: str
    tone: str = "professional"

# ==================== MOCK DATA ====================

MOCK_EMAILS: List[EmailEvent] = [
    EmailEvent(
        id="email-001",
        thread_id="thread-001",
        from_name="Carlos Mendoza",
        from_email="carlos.mendoza@acme.com",
        subject="URGENTE: Revisión contrato Q1 - Firma requerida hoy",
        date="2026-01-15T09:30:00Z",
        snippet="Necesitamos tu firma antes de las 5pm para cerrar el acuerdo con el cliente principal...",
        body="""Hola,

Necesitamos tu firma antes de las 5pm para cerrar el acuerdo con el cliente principal. El contrato ya fue revisado por legal y finanzas.

Puntos clave:
- Valor total: $250,000 USD
- Duración: 12 meses
- Cláusula de renovación automática

Por favor revisa el documento adjunto y confirma tu aprobación lo antes posible.

Saludos,
Carlos Mendoza
Director Comercial""",
        labels=["importante", "contratos"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-001", name="Contrato_Q1_2026.pdf", size=2456789, mime_type="application/pdf"),
            EmailAttachment(id="att-002", name="Anexo_Legal.docx", size=156234, mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        ]
    ),
    EmailEvent(
        id="email-002",
        thread_id="thread-002",
        from_name="Ana García",
        from_email="ana.garcia@techstart.io",
        subject="Propuesta colaboración estratégica - TechStart",
        date="2026-01-15T08:15:00Z",
        snippet="Me gustaría explorar una posible alianza entre nuestras empresas para el mercado LATAM...",
        body="""Estimado/a,

Me gustaría explorar una posible alianza entre nuestras empresas para el mercado LATAM.

TechStart ha crecido un 300% este año y buscamos partners estratégicos para expandir nuestra oferta.

¿Podríamos agendar una llamada esta semana?

Adjunto nuestra presentación corporativa.

Saludos cordiales,
Ana García
CEO, TechStart""",
        labels=["negocios", "oportunidades"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-003", name="TechStart_Presentacion_2026.pdf", size=5678901, mime_type="application/pdf")
        ]
    ),
    EmailEvent(
        id="email-003",
        thread_id="thread-003",
        from_name="Sistema de Pagos",
        from_email="noreply@pagos.empresa.com",
        subject="Factura #INV-2026-0142 - Vencimiento próximo",
        date="2026-01-14T16:45:00Z",
        snippet="Su factura por $12,500 vence en 3 días. Por favor realice el pago para evitar...",
        body="""Estimado cliente,

Le recordamos que su factura #INV-2026-0142 por un monto de $12,500 USD vence el 17 de enero de 2026.

Por favor realice el pago para evitar cargos por mora.

Puede pagar directamente en nuestro portal o transferencia bancaria.

Atentamente,
Sistema de Pagos Automático""",
        labels=["finanzas", "facturas"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-004", name="Factura_INV-2026-0142.pdf", size=234567, mime_type="application/pdf")
        ]
    ),
    EmailEvent(
        id="email-004",
        thread_id="thread-004",
        from_name="Roberto Sánchez",
        from_email="roberto.sanchez@cliente-vip.com",
        subject="RE: Problema con el servicio - Escalación",
        date="2026-01-15T07:20:00Z",
        snippet="Llevamos 3 días sin resolver el problema. Si no tenemos solución hoy, evaluaremos alternativas...",
        body="""Buenos días,

Llevamos 3 días sin resolver el problema reportado. Nuestras operaciones están afectadas significativamente.

Si no tenemos una solución definitiva hoy antes de las 2pm, nos veremos obligados a evaluar alternativas y escalar con su dirección general.

Esperamos su respuesta urgente.

Roberto Sánchez
Director de Operaciones
Cliente VIP Corp""",
        labels=["soporte", "urgente", "escalación"]
    ),
    EmailEvent(
        id="email-005",
        thread_id="thread-005",
        from_name="Newsletter Tech",
        from_email="news@tech-weekly.com",
        subject="Top 10 tendencias tecnológicas para 2026",
        date="2026-01-14T10:00:00Z",
        snippet="Descubre las tendencias que dominarán el panorama tecnológico este año...",
        body="""¡Hola!

Esta semana te traemos las 10 tendencias tecnológicas más importantes para 2026:

1. IA Generativa en empresas
2. Computación cuántica práctica
3. Web3 y descentralización
4. Ciberseguridad con IA
5. Automatización inteligente
...

Lee el artículo completo en nuestro sitio.

Saludos,
El equipo de Tech Weekly""",
        labels=["newsletter", "información"]
    ),
    EmailEvent(
        id="email-006",
        thread_id="thread-006",
        from_name="María López",
        from_email="maria.lopez@rrhh.empresa.com",
        subject="Recordatorio: Evaluación de desempeño Q4",
        date="2026-01-13T14:30:00Z",
        snippet="Te recordamos completar tu autoevaluación antes del viernes...",
        body="""Hola,

Te recordamos que debes completar tu autoevaluación de desempeño Q4 antes del viernes 17 de enero.

Accede al portal de RRHH para completar el formulario.

Cualquier duda, estamos a tu disposición.

Saludos,
María López
Recursos Humanos""",
        labels=["rrhh", "interno"]
    ),
    EmailEvent(
        id="email-007",
        thread_id="thread-007",
        from_name="Pedro Martínez",
        from_email="pedro.martinez@proveedor.com",
        subject="Confirmación pedido #PO-2026-089",
        date="2026-01-14T11:20:00Z",
        snippet="Confirmamos la recepción de su orden de compra. Fecha estimada de entrega...",
        body="""Estimado cliente,

Confirmamos la recepción de su orden de compra #PO-2026-089.

Detalles:
- Productos: 50 unidades modelo X-500
- Valor total: $75,000 USD
- Fecha estimada entrega: 22 de enero 2026

El envío será coordinado con su departamento de logística.

Atentamente,
Pedro Martínez
Ventas Corporativas""",
        labels=["compras", "proveedores"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-005", name="Confirmacion_PO-2026-089.pdf", size=189234, mime_type="application/pdf")
        ]
    ),
    EmailEvent(
        id="email-008",
        thread_id="thread-008",
        from_name="Alertas Sistema",
        from_email="alerts@monitoring.empresa.com",
        subject="[ALERTA] Uso de CPU alto en servidor PROD-01",
        date="2026-01-15T06:45:00Z",
        snippet="Se ha detectado uso de CPU superior al 90% en el servidor de producción...",
        body="""ALERTA DE SISTEMA

Servidor: PROD-01
Métrica: CPU Usage
Valor actual: 94%
Umbral: 90%
Hora detección: 06:45 UTC

Acción recomendada: Revisar procesos activos y escalar horizontalmente si es necesario.

Este es un mensaje automático del sistema de monitoreo.""",
        labels=["sistema", "alertas", "técnico"]
    ),
    EmailEvent(
        id="email-009",
        thread_id="thread-009",
        from_name="Laura Fernández",
        from_email="laura.fernandez@partner.com",
        subject="Reunión estratégica - Agenda confirmada",
        date="2026-01-14T09:00:00Z",
        snippet="Confirmo la reunión del jueves 16 a las 10am. Adjunto la agenda propuesta...",
        body="""Hola,

Confirmo nuestra reunión estratégica para el jueves 16 de enero a las 10:00am (hora local).

Agenda:
1. Revisión resultados Q4
2. Objetivos Q1 2026
3. Nuevas iniciativas conjuntas
4. Próximos pasos

Por favor confirma tu asistencia.

Saludos,
Laura Fernández""",
        labels=["reuniones", "partners"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-006", name="Agenda_Reunion_16Ene.docx", size=45678, mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        ]
    ),
    EmailEvent(
        id="email-010",
        thread_id="thread-010",
        from_name="Promociones Empresa",
        from_email="promo@tienda-online.com",
        subject="¡50% de descuento solo por hoy!",
        date="2026-01-13T08:00:00Z",
        snippet="Aprovecha nuestra mega oferta de enero. Descuentos en toda la tienda...",
        body="""¡MEGA OFERTA DE ENERO!

Solo por hoy, 50% de descuento en todos los productos.

Usa el código: ENERO50

¡No te lo pierdas!

Términos y condiciones aplican.

Tienda Online""",
        labels=["promociones", "spam"]
    ),
    EmailEvent(
        id="email-011",
        thread_id="thread-011",
        from_name="Diego Torres",
        from_email="diego.torres@legal.empresa.com",
        subject="Revisión urgente: Cláusulas contrato Proyecto Delta",
        date="2026-01-15T10:15:00Z",
        snippet="Necesito tu feedback sobre las cláusulas 4.2 y 7.1 del contrato antes de enviarlo al cliente...",
        body="""Hola,

Necesito tu feedback urgente sobre las cláusulas 4.2 (responsabilidades) y 7.1 (penalizaciones) del contrato del Proyecto Delta.

El cliente espera la versión final hoy a las 3pm.

Las cláusulas en cuestión están resaltadas en el documento adjunto.

¿Puedes revisarlo en la próxima hora?

Gracias,
Diego Torres
Asesor Legal""",
        labels=["legal", "urgente", "contratos"],
        has_attachments=True,
        attachments=[
            EmailAttachment(id="att-007", name="Contrato_Proyecto_Delta_v3.pdf", size=3456789, mime_type="application/pdf")
        ]
    ),
    EmailEvent(
        id="email-012",
        thread_id="thread-012",
        from_name="Soporte IT",
        from_email="soporte@it.empresa.com",
        subject="Ticket #IT-4521 resuelto",
        date="2026-01-14T15:30:00Z",
        snippet="Tu ticket sobre el acceso VPN ha sido resuelto. Por favor verifica...",
        body="""Hola,

Tu ticket #IT-4521 sobre problemas de acceso VPN ha sido resuelto.

Solución aplicada: Regeneración de certificados y actualización de configuración.

Por favor verifica que puedes conectarte correctamente y cierra el ticket si todo funciona.

Soporte IT""",
        labels=["it", "soporte", "resuelto"]
    )
]

# ==================== PRIORITY ENGINE ====================

def calculate_priority(email: EmailEvent) -> PriorityResult:
    """Calculate priority with explainable rules"""
    score = 50
    rules = []
    explanations = []
    
    subject_lower = email.subject.lower()
    body_lower = email.body.lower()
    from_email_lower = email.from_email.lower()
    
    # Rule 1: Urgent keywords
    urgent_keywords = ["urgente", "urgent", "asap", "inmediato", "hoy", "today", "escalación", "escalation"]
    for kw in urgent_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 25
            rules.append(f"URGENT_KEYWORD:{kw}")
            explanations.append(f"Contiene palabra clave urgente: '{kw}'")
            break
    
    # Rule 2: Deadline mentions
    deadline_keywords = ["deadline", "vencimiento", "fecha límite", "antes de", "before", "expires", "vence"]
    for kw in deadline_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 15
            rules.append(f"DEADLINE_MENTION:{kw}")
            explanations.append("Menciona una fecha límite o vencimiento")
            break
    
    # Rule 3: Client/VIP sender
    vip_domains = ["cliente-vip", "partner", "vip", "premium"]
    for domain in vip_domains:
        if domain in from_email_lower:
            score += 20
            rules.append(f"VIP_SENDER:{domain}")
            explanations.append("Remitente de cuenta VIP o partner estratégico")
            break
    
    # Rule 4: Action required
    action_keywords = ["firma", "sign", "aprobar", "approve", "confirmar", "confirm", "revisar", "review"]
    for kw in action_keywords:
        if kw in body_lower:
            score += 15
            rules.append(f"ACTION_REQUIRED:{kw}")
            explanations.append(f"Requiere acción: '{kw}'")
            break
    
    # Rule 5: Financial content
    financial_keywords = ["factura", "invoice", "pago", "payment", "contrato", "contract", "$"]
    for kw in financial_keywords:
        if kw in subject_lower or kw in body_lower:
            score += 10
            rules.append(f"FINANCIAL_CONTENT:{kw}")
            explanations.append("Contenido financiero o contractual")
            break
    
    # Rule 6: Has attachments (slight boost)
    if email.has_attachments:
        score += 5
        rules.append("HAS_ATTACHMENTS")
        explanations.append("Incluye documentos adjuntos")
    
    # Rule 7: Promotional/Newsletter penalty
    promo_keywords = ["newsletter", "promoción", "promo", "descuento", "oferta", "suscríbete", "unsubscribe"]
    for kw in promo_keywords:
        if kw in subject_lower or kw in body_lower or kw in email.labels:
            score -= 30
            rules.append(f"PROMOTIONAL:{kw}")
            explanations.append("Contenido promocional o newsletter")
            break
    
    # Rule 8: System/automated penalty
    if "noreply" in from_email_lower or "no-reply" in from_email_lower:
        score -= 10
        rules.append("AUTOMATED_SENDER")
        explanations.append("Mensaje automático del sistema")
    
    # Clamp score
    score = max(0, min(100, score))
    
    # Determine label
    if score >= 70:
        label = "PRIORITARIO"
    elif score >= 40:
        label = "SEGUIMIENTO"
    else:
        label = "INFO"
    
    # Build explanation
    if not explanations:
        explanations.append("Correo estándar sin indicadores especiales de urgencia")
    
    return PriorityResult(
        priority_score=score,
        priority_label=label,
        explain=" | ".join(explanations),
        rule_hits=rules,
        version="1.0"
    )

def get_enriched_emails() -> List[EnrichedEmail]:
    """Get all emails with priority analysis"""
    result = []
    for email in MOCK_EMAILS:
        priority = calculate_priority(email)
        result.append(EnrichedEmail(email=email, priority=priority))
    return sorted(result, key=lambda x: x.priority.priority_score, reverse=True)

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
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

# ==================== AI SERVICE ====================

class AIService:
    def __init__(self):
        self.api_key = EMERGENT_LLM_KEY
        
    async def process_intent(self, message: str, context: str = None) -> AIIntent:
        """Process user message and determine intent"""
        
        message_lower = message.lower()
        
        # Intent detection with keywords
        if any(kw in message_lower for kw in ["prioritario", "importante", "urgente", "priority", "urgent"]):
            return AIIntent(
                assistant_text="Mostrando correos prioritarios que requieren tu atención inmediata.",
                intent="SHOW_PRIORITARIOS",
                ui_state="filter_priority",
                action={"type": "filter", "payload": {"label": "PRIORITARIO"}}
            )
        
        if any(kw in message_lower for kw in ["seguimiento", "pendiente", "follow", "pending"]):
            return AIIntent(
                assistant_text="Mostrando correos que requieren seguimiento.",
                intent="SHOW_SEGUIMIENTO",
                ui_state="filter_followup",
                action={"type": "filter", "payload": {"label": "SEGUIMIENTO"}}
            )
        
        if any(kw in message_lower for kw in ["adjunto", "attachment", "archivo", "documento", "pdf"]):
            return AIIntent(
                assistant_text="Filtrando correos con archivos adjuntos.",
                intent="FILTER_ATTACHMENTS",
                ui_state="filter_attachments",
                action={"type": "filter", "payload": {"has_attachments": True}}
            )
        
        if any(kw in message_lower for kw in ["resumen", "resume", "summary", "resumir"]):
            return AIIntent(
                assistant_text="Selecciona un correo para generar su resumen.",
                intent="SUMMARIZE_SELECTED",
                ui_state="await_selection",
                action={"type": "prompt_selection", "payload": {}}
            )
        
        if any(kw in message_lower for kw in ["responder", "reply", "contestar", "redactar", "borrador", "draft"]):
            return AIIntent(
                assistant_text="¿Sobre qué correo te ayudo a redactar una respuesta?",
                intent="DRAFT_REPLY",
                ui_state="await_selection",
                action={"type": "prompt_selection", "payload": {}}
            )
        
        if any(kw in message_lower for kw in ["todo", "all", "completo", "ver todo", "mostrar todo"]):
            return AIIntent(
                assistant_text="Mostrando todos los correos ordenados por prioridad.",
                intent="SHOW_ALL",
                ui_state="default",
                action={"type": "filter", "payload": {"label": None}}
            )
        
        if any(kw in message_lower for kw in ["info", "información", "informativo", "newsletter"]):
            return AIIntent(
                assistant_text="Mostrando correos informativos de baja prioridad.",
                intent="SHOW_INFO",
                ui_state="filter_info",
                action={"type": "filter", "payload": {"label": "INFO"}}
            )
        
        # Out of scope detection
        out_of_scope_keywords = ["clima", "weather", "historia", "history", "cocina", "recipe", 
                                  "chiste", "joke", "música", "music", "película", "movie",
                                  "juego", "game", "deporte", "sport", "año", "year", "quien", "who",
                                  "qué es", "what is", "cómo funciona", "how does"]
        
        if any(kw in message_lower for kw in out_of_scope_keywords):
            return AIIntent(
                assistant_text="Estoy diseñada para ayudarte con correos: priorizar, resumir y redactar respuestas. Indícame qué mensajes quieres ver o qué respuesta necesitas.",
                intent="OUT_OF_SCOPE",
                ui_state="default",
                action={"type": "none", "payload": {}}
            )
        
        # Default helpful response
        return AIIntent(
            assistant_text="Puedo ayudarte a: ver correos prioritarios, filtrar por adjuntos, resumir mensajes o redactar respuestas. ¿Qué necesitas?",
            intent="HELP",
            ui_state="default",
            action={"type": "none", "payload": {}}
        )
    
    async def summarize_email(self, email: EmailEvent) -> str:
        """Generate email summary using LLM"""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"summary-{email.id}",
                system_message="""Eres un asistente especializado en resumir correos electrónicos de forma concisa y clara.
                Tu objetivo es extraer los puntos clave en máximo 3 oraciones.
                Responde siempre en español."""
            ).with_model("openai", "gpt-5.2")
            
            user_message = UserMessage(
                text=f"""Resume este correo en máximo 3 oraciones claras:

De: {email.from_name} <{email.from_email}>
Asunto: {email.subject}
Contenido:
{email.body}

Resume los puntos clave y acciones requeridas."""
            )
            
            response = await chat.send_message(user_message)
            return response
        except Exception as e:
            logging.error(f"Error summarizing email: {e}")
            # Fallback to snippet
            return f"Resumen: {email.snippet}"
    
    async def draft_reply(self, email: EmailEvent, instructions: str, tone: str = "professional") -> List[str]:
        """Generate draft reply options using LLM"""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"draft-{email.id}",
                system_message=f"""Eres un asistente que redacta respuestas de correo electrónico.
                Tono: {tone}
                Genera respuestas claras, concisas y profesionales.
                Responde siempre en español."""
            ).with_model("openai", "gpt-5.2")
            
            user_message = UserMessage(
                text=f"""Redacta 2 opciones de respuesta para este correo:

CORREO ORIGINAL:
De: {email.from_name} <{email.from_email}>
Asunto: {email.subject}
Contenido:
{email.body}

INSTRUCCIONES DEL USUARIO:
{instructions}

Genera 2 versiones diferentes de respuesta, separadas por "---".
Cada respuesta debe ser completa y lista para enviar."""
            )
            
            response = await chat.send_message(user_message)
            drafts = response.split("---")
            return [d.strip() for d in drafts if d.strip()][:2]
        except Exception as e:
            logging.error(f"Error drafting reply: {e}")
            return [f"Estimado/a {email.from_name},\n\nGracias por su mensaje. {instructions}\n\nSaludos cordiales."]

ai_service = AIService()

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    
    return TokenResponse(
        token=token,
        user=UserResponse(id=user_id, email=user_data.email, name=user_data.name)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_token(user["id"], user["email"])
    
    return TokenResponse(
        token=token,
        user=UserResponse(id=user["id"], email=user["email"], name=user["name"], language=user.get("language", "es"))
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        language=user.get("language", "es")
    )

@api_router.put("/auth/language")
async def update_language(language: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"language": language}})
    return {"status": "ok", "language": language}

# ==================== EMAIL ROUTES ====================

@api_router.get("/emails", response_model=List[EnrichedEmail])
async def get_emails(
    label: Optional[str] = None,
    has_attachments: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Get enriched emails with optional filtering"""
    emails = get_enriched_emails()
    
    if label:
        emails = [e for e in emails if e.priority.priority_label == label]
    
    if has_attachments is not None:
        emails = [e for e in emails if e.email.has_attachments == has_attachments]
    
    return emails

@api_router.get("/emails/{email_id}", response_model=EnrichedEmail)
async def get_email(email_id: str, user: dict = Depends(get_current_user)):
    """Get single email with priority analysis"""
    for email in MOCK_EMAILS:
        if email.id == email_id:
            return EnrichedEmail(email=email, priority=calculate_priority(email))
    
    raise HTTPException(status_code=404, detail="Email no encontrado")

@api_router.get("/emails/stats/summary")
async def get_email_stats(user: dict = Depends(get_current_user)):
    """Get email statistics"""
    emails = get_enriched_emails()
    
    stats = {
        "total": len(emails),
        "prioritarios": len([e for e in emails if e.priority.priority_label == "PRIORITARIO"]),
        "seguimiento": len([e for e in emails if e.priority.priority_label == "SEGUIMIENTO"]),
        "info": len([e for e in emails if e.priority.priority_label == "INFO"]),
        "with_attachments": len([e for e in emails if e.email.has_attachments])
    }
    
    return stats

# ==================== AI ROUTES ====================

@api_router.post("/ai/chat", response_model=AIIntent)
async def ai_chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    """Process AI chat message and return intent"""
    return await ai_service.process_intent(request.message, request.context)

@api_router.post("/ai/summarize")
async def ai_summarize(request: SummarizeRequest, user: dict = Depends(get_current_user)):
    """Summarize an email"""
    email = None
    for e in MOCK_EMAILS:
        if e.id == request.email_id:
            email = e
            break
    
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")
    
    summary = await ai_service.summarize_email(email)
    return {"email_id": request.email_id, "summary": summary}

@api_router.post("/ai/draft-reply")
async def ai_draft_reply(request: DraftReplyRequest, user: dict = Depends(get_current_user)):
    """Generate draft replies for an email"""
    email = None
    for e in MOCK_EMAILS:
        if e.id == request.email_id:
            email = e
            break
    
    if not email:
        raise HTTPException(status_code=404, detail="Email no encontrado")
    
    drafts = await ai_service.draft_reply(email, request.instructions, request.tone)
    return {"email_id": request.email_id, "drafts": drafts}

# ==================== BASE ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Email Control System API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
