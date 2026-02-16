from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


# =====================================================
# SESSION BASE MODEL (DB Representation)
# =====================================================

class SessionModel(BaseModel):
    user_id: str
    current_email_id: Optional[str] = None
    last_action: Optional[str] = None
    tone_preference: str = "neutral"
    last_draft_content: Optional[str] = None
    last_interaction_at: datetime
    expires_at: datetime


# =====================================================
# RESTORE
# =====================================================

class SessionRestoreIn(BaseModel):
    user_id: str


class SessionRestoreOut(BaseModel):
    restored: bool
    session: SessionModel


# =====================================================
# RESET
# =====================================================

class SessionResetIn(BaseModel):
    user_id: str


# =====================================================
# UPDATE (Memoria viva)
# =====================================================

class SessionUpdateIn(BaseModel):
    user_id: str
    fields: Dict[str, Any]


# =====================================================
# GENERIC RESPONSE
# =====================================================

class OkResponse(BaseModel):
    ok: bool
