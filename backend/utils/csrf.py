from __future__ import annotations

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class OAuthCSRFMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, header_name: str, cookie_name: str, logger):
        super().__init__(app)
        self.header_name = header_name
        self.cookie_name = cookie_name
        self.logger = logger

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/oauth"):
            return await call_next(request)

        if request.method not in {"POST", "PUT", "DELETE"}:
            return await call_next(request)

        header_token = request.headers.get(self.header_name)
        cookie_token = request.cookies.get(self.cookie_name)
        state_token = request.query_params.get("state")

        if not header_token or header_token not in {cookie_token, state_token}:
            self.logger.warning("CSRF validation failed for %s", request.url.path)
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "data": {},
                    "meta": {"detail": "CSRF validation failed"},
                },
            )

        return await call_next(request)