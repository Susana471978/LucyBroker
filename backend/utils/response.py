from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import Request


def build_response(
    request: Request,
    *,
    data: Any,
    meta: Optional[Dict[str, Any]] = None,
    legacy: Any = None,
    status: str = "ok",
):
    """Return standardized response when requested, otherwise preserve legacy shape."""

    wants_standard = (
        request.headers.get("X-Response-Format", "").lower() == "standard"
        or request.query_params.get("format") == "standard"
    )

    if wants_standard:
        return {
            "status": status,
            "data": data,
            "meta": meta or {},
        }

    return legacy if legacy is not None else data