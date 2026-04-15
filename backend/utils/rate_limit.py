from __future__ import annotations
import time
import jwt
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# ── Límites por endpoint (requests, ventana_segundos) ──────────────────────
ENDPOINT_LIMITS: Dict[str, Tuple[int, int]] = {
    "/api/assistant":  (20, 60),   # 20 req/min por usuario
    "/api/tts":        (25, 60),   # 25 req/min por usuario
    "/api/auth/login": (5,  60),   # 5 intentos/min
    "/api/auth/register": (3, 60), # 3 registros/min
    "/api/gmail":      (30, 60),
    "/api/calendar":   (30, 60),
}
DEFAULT_LIMIT: Tuple[int, int] = (60, 60)  # 60 req/min general

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int, window_seconds: int, logger):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.logger = logger
        # Buckets separados: por IP y por usuario autenticado
        self.ip_buckets: Dict[str, Deque[float]] = defaultdict(deque)
        self.user_buckets: Dict[str, Deque[float]] = defaultdict(deque)

    def _get_endpoint_limit(self, path: str) -> Tuple[int, int]:
        for prefix, limits in ENDPOINT_LIMITS.items():
            if path.startswith(prefix):
                return limits
        return DEFAULT_LIMIT

    def _check_bucket(self, bucket: Deque[float], max_req: int, window: int, now: float) -> bool:
        """Retorna True si se excede el límite."""
        while bucket and bucket[0] <= now - window:
            bucket.popleft()
        if len(bucket) >= max_req:
            return True
        bucket.append(now)
        return False

    def _extract_user_id(self, request: Request) -> str | None:
        """Extrae user_id del JWT sin verificar firma completa — solo para rate limiting."""
        try:
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return None
            token = auth.split(" ", 1)[1]
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload.get("user_id")
        except Exception:
            return None

    async def dispatch(self, request: Request, call_next):
        if request.url.path in {"/health", "/metrics"}:
            return await call_next(request)

        path = request.url.path
        now = time.time()
        max_req, window = self._get_endpoint_limit(path)

        # ── Check por IP (siempre) ─────────────────────────────────
        client_ip = self._get_client_ip(request)
        ip_key = f"{client_ip}:{path}"
        if self._check_bucket(self.ip_buckets[ip_key], max_req, window, now):
            self.logger.warning("Rate limit IP: %s path=%s", client_ip, path)
            return self._rate_limit_response()

        # ── Check por usuario autenticado (endpoints protegidos) ───
        user_id = self._extract_user_id(request)
        if user_id:
            user_key = f"user:{user_id}:{path}"
            if self._check_bucket(self.user_buckets[user_key], max_req, window, now):
                self.logger.warning("Rate limit USER: %s path=%s", user_id, path)
                return self._rate_limit_response()

        return await call_next(request)

    @staticmethod
    def _rate_limit_response() -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "data": {},
                "meta": {
                    "detail": "Demasiadas peticiones. Por favor espera un momento.",
                    "retry_after": 60,
                },
            },
            headers={"Retry-After": "60"},
        )

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"
