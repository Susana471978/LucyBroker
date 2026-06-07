from __future__ import annotations

from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


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
    categoria: str = "OTRO"
    datos_clave: dict = {}
    resumen: str = ""
    borrador: str = ""


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