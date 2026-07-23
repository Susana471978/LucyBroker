from __future__ import annotations

from typing import List, Optional, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field, ConfigDict


# ==================== CANALES ====================

class CanalEnum(str, Enum):
    """Origen de un mensaje que entra en la bandeja.

    El modelo se llama todavia EmailEvent por compatibilidad, pero la
    bandeja es omnicanal: `canal` distingue de donde viene cada mensaje.
    """

    email = "email"
    whatsapp = "whatsapp"
    web = "web"                # asistente virtual de la landing
    formulario = "formulario"  # formularios de contacto
    telefono = "telefono"      # registro manual de una llamada


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
    canal: CanalEnum = CanalEnum.email
    buzon: str = ""
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
    categoria: str = "OTRO"
    datos_clave: dict = {}
    resumen: str = ""
    borrador: str = ""


# ==================== ACTIVITY LOG ====================
class ActivityLog(BaseModel):
    id: str = ""
    user_id: str
    user_name: str
    fecha: str
    hora: str
    accion: str  # LEIDO | CLASIFICADO | RESPONDIDO | ADJUNTO_ENVIADO
    correo_id: str = ""
    correo_asunto: str = ""
    correo_de: str = ""
    categoria: str = ""
    prioridad: str = ""
    notas: str = ""

# ==================== AUTH MODELS ====================
class RoleEnum(str, Enum):
    director = "director"
    agent    = "agent"
    admin    = "admin"


class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "employee"  # admin | employee
    imap_user: Optional[str] = None
    imap_password: Optional[str] = None
    buzon_asignado: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    language: str = "es"
    role: str = "employee"
    imap_user: Optional[str] = None
    buzon_asignado: Optional[str] = None


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


# ==================== INGESTA EXTERNA ====================

class MensajeEntrante(BaseModel):
    """Mensaje que entra en la bandeja desde un canal que no es IMAP.

    Lo usan el asistente virtual de la web, los formularios de contacto
    y, mas adelante, el webhook de WhatsApp. Se autentica con clave de
    servicio, no con sesion de usuario.
    """

    canal: CanalEnum
    remitente: str = Field(min_length=1, max_length=200)
    contacto: str = Field(default="", max_length=200)
    asunto: str = Field(default="", max_length=300)
    cuerpo: str = Field(min_length=1, max_length=5000)
    meta: Dict[str, Any] = {}
