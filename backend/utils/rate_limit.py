from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int, window_seconds: int, logger):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.logger = logger
        self.requests: Dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path in {"/health", "/metrics"}:
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        now = time.time()
        bucket = self.requests[client_ip]

        while bucket and bucket[0] <= now - self.window_seconds:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            self.logger.warning("Rate limit exceeded for %s", client_ip)
            return JSONResponse(
                status_code=429,
                content={
                    "status": "error",
                    "data": {},
                    "meta": {"detail": "Rate limit exceeded"},
                },
            )

        bucket.append(now)
        return await call_next(request)

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"