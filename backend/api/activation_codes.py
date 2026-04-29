# backend/api/activation_codes.py

from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.core.dependencies import get_current_user
from backend.core.plans import PLANS
from backend.core.database import db
from backend.utils.response import build_response
from backend.utils.logger import logger


router = APIRouter(tags=["activation"])


# ======================================================
# SCHEMAS
# ======================================================

class CreateCodeRequest(BaseModel):
    plan_key: str
    max_uses: int = Field(default=1, ge=1, le=100)
    expires_days: int = Field(default=30, ge=1, le=365)
    label: Optional[str] = None   # e.g. "Beta tester - María González"


class ActivateCodeRequest(BaseModel):
    code: str


# ======================================================
# HELPERS
# ======================================================

def _generate_code() -> str:
    """Genera código legible tipo LUCY-XXXX-XXXX."""
    alphabet = string.ascii_uppercase + string.digits
    part1 = "".join(secrets.choice(alphabet) for _ in range(4))
    part2 = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"LUCY-{part1}-{part2}"


# ======================================================
# ADMIN: CREAR CÓDIGO
# ======================================================

@router.post("/admin/codes")
async def create_activation_code(
    request: Request,
    body: CreateCodeRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Solo admin puede crear códigos de activación."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear códigos")

    if body.plan_key not in PLANS:
        raise HTTPException(
            status_code=400,
            detail=f"Plan inválido. Opciones: {', '.join(PLANS.keys())}",
        )

    code = _generate_code()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=body.expires_days)

    doc = {
        "code": code,
        "plan_key": body.plan_key,
        "max_uses": body.max_uses,
        "uses": 0,
        "label": body.label or "",
        "created_by": user["id"],
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "active": True,
        "redeemed_by": [],
    }

    await db.activation_codes.insert_one(doc)

    plan = PLANS[body.plan_key]
    logger.info("Código creado: %s → plan=%s label=%s", code, body.plan_key, body.label)

    return build_response(
        request,
        data={
            "code": code,
            "plan_key": body.plan_key,
            "plan_name": plan["name"],
            "max_uses": body.max_uses,
            "expires_at": expires_at.isoformat(),
            "label": body.label or "",
        },
        legacy={
            "code": code,
            "plan_key": body.plan_key,
            "plan_name": plan["name"],
            "max_uses": body.max_uses,
            "expires_at": expires_at.isoformat(),
        },
    )


# ======================================================
# ADMIN: LISTAR CÓDIGOS
# ======================================================

@router.get("/admin/codes")
async def list_activation_codes(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Lista todos los códigos de activación (solo admin)."""
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Solo administradores")

    cursor = db.activation_codes.find({}, {"_id": 0}).sort("created_at", -1)
    codes = []
    async for doc in cursor:
        codes.append(doc)

    return build_response(request, data={"codes": codes}, legacy={"codes": codes})


# ======================================================
# USER: ACTIVAR CÓDIGO
# ======================================================

@router.post("/billing/activate")
async def activate_code(
    request: Request,
    body: ActivateCodeRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Activa un plan usando un código promocional."""
    code = body.code.strip().upper()

    # Buscar código
    doc = await db.activation_codes.find_one({"code": code})

    if not doc:
        raise HTTPException(status_code=404, detail="Código no válido")

    if not doc.get("active"):
        raise HTTPException(status_code=400, detail="Este código ya no está activo")

    # Verificar expiración
    expires_at = datetime.fromisoformat(doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Este código ha expirado")

    # Verificar usos
    if doc["uses"] >= doc["max_uses"]:
        raise HTTPException(status_code=400, detail="Este código ha alcanzado el límite de usos")

    # Verificar que el usuario no lo haya usado ya
    if user["id"] in doc.get("redeemed_by", []):
        raise HTTPException(status_code=400, detail="Ya has usado este código")

    plan_key = doc["plan_key"]
    plan = PLANS.get(plan_key)

    if not plan:
        raise HTTPException(status_code=500, detail="Plan del código no encontrado")

    # Activar plan en el usuario (misma estructura que Stripe webhook)
    now = datetime.now(timezone.utc).isoformat()
    update = {
        f"subscriptions.{plan_key}": {
            "customer_id": None,
            "subscription_id": f"code:{code}",
            "status": "active",
            "product": plan["product"],
            "tier": plan["tier"],
            "started_at": now,
            "updated_at": now,
            "activation_code": code,
        },
        "subscription_active": True,
    }

    await db.users.update_one({"id": user["id"]}, {"$set": update})

    # Incrementar usos y registrar quién lo usó
    await db.activation_codes.update_one(
        {"code": code},
        {
            "$inc": {"uses": 1},
            "$push": {"redeemed_by": user["id"]},
            "$set": {
                "active": doc["uses"] + 1 < doc["max_uses"],
            },
        },
    )

    logger.info("Código activado: %s → user=%s plan=%s", code, user["id"], plan_key)

    return build_response(
        request,
        data={
            "message": f"Plan {plan['name']} activado correctamente",
            "plan_key": plan_key,
            "plan_name": plan["name"],
            "features": plan["features"],
        },
        legacy={
            "message": f"Plan {plan['name']} activado correctamente",
            "plan_key": plan_key,
            "plan_name": plan["name"],
        },
    )