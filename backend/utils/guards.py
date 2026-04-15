from __future__ import annotations
"""
guards.py — Protecciones de negocio para Lucy
- Daily quota por usuario
- Input sanitization
- TTS límite de caracteres
- Circuit breaker OpenAI
"""
import time
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException

# ── Quotas diarias por plan ────────────────────────────────────────────────
DAILY_QUOTAS = {
    "trial":       {"assistant": 30,  "tts": 20},
    "personal":    {"assistant": 150, "tts": 100},
    "executive":   {"assistant": 400, "tts": 250},
    "admin":       {"assistant": 9999,"tts": 9999},
}
DEFAULT_QUOTA = DAILY_QUOTAS["trial"]

# ── TTS límites ────────────────────────────────────────────────────────────
TTS_MAX_CHARS = 1000
TTS_MAX_CHARS_TRIAL = 400

# ── Input límites ──────────────────────────────────────────────────────────
ASSISTANT_MAX_INPUT_CHARS = 2000

# ── Patrones de prompt injection ──────────────────────────────────────────
_INJECTION_PATTERNS = [
    r"ignore (previous|all|above) instructions",
    r"disregard (previous|all|above)",
    r"you are now",
    r"new persona",
    r"act as (a |an )?(different|new|another)",
    r"forget (everything|all|your instructions)",
    r"system prompt",
    r"jailbreak",
    r"DAN mode",
    r"developer mode",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)

# ── Circuit breaker OpenAI ─────────────────────────────────────────────────
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_seconds: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_seconds = recovery_seconds
        self.failures = 0
        self.last_failure_time: Optional[float] = None
        self.state = "closed"  # closed | open | half-open

    def record_success(self):
        self.failures = 0
        self.state = "closed"

    def record_failure(self):
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= self.failure_threshold:
            self.state = "open"

    def is_available(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            if self.last_failure_time and time.time() - self.last_failure_time > self.recovery_seconds:
                self.state = "half-open"
                return True
            return False
        return True  # half-open: allow one request

openai_breaker = CircuitBreaker(failure_threshold=5, recovery_seconds=60)

# ── Funciones públicas ─────────────────────────────────────────────────────

def get_user_plan(user: Dict[str, Any]) -> str:
    if user.get("is_admin"):
        return "admin"
    plan = user.get("plan_key", "")
    if "executive" in plan:
        return "executive"
    if "personal" in plan:
        return "personal"
    if user.get("subscription_active"):
        return "personal"
    return "trial"

def sanitize_input(text: str, max_chars: int = ASSISTANT_MAX_INPUT_CHARS) -> str:
    """Limpia y valida input del usuario."""
    if not text or not isinstance(text, str):
        raise HTTPException(status_code=400, detail="Input inválido.")
    text = text.strip()
    if len(text) > max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"Mensaje demasiado largo. Máximo {max_chars} caracteres."
        )
    if _INJECTION_RE.search(text):
        raise HTTPException(status_code=400, detail="Input no permitido.")
    return text

def validate_tts_input(text: str, user: Dict[str, Any]) -> str:
    """Valida input de TTS según plan."""
    if not text or not isinstance(text, str):
        raise HTTPException(status_code=400, detail="Texto vacío.")
    text = text.strip()
    plan = get_user_plan(user)
    max_chars = TTS_MAX_CHARS_TRIAL if plan == "trial" else TTS_MAX_CHARS
    if len(text) > max_chars:
        text = text[:max_chars]  # Truncar silenciosamente en TTS
    return text

async def check_daily_quota(db, user: Dict[str, Any], endpoint: str) -> None:
    """Verifica y actualiza quota diaria. Lanza 429 si se supera."""
    plan = get_user_plan(user)
    quota = DAILY_QUOTAS.get(plan, DEFAULT_QUOTA)
    max_allowed = quota.get(endpoint, 50)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_id = user["id"]
    quota_key = f"quota:{user_id}:{today}:{endpoint}"

    doc = await db.quotas.find_one({"key": quota_key})
    current = doc["count"] if doc else 0

    if current >= max_allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Has alcanzado tu límite diario de {max_allowed} peticiones. Reinicia mañana o mejora tu plan."
        )

    await db.quotas.update_one(
        {"key": quota_key},
        {"$inc": {"count": 1}, "$set": {"expires": today}},
        upsert=True,
    )
