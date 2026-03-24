# backend/api/vip_companies.py

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.utils.response import build_response
from backend.core.feature_gate import check_feature


class VipCompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Nombre visible de la empresa")
    domain: str = Field(..., min_length=3, max_length=100, description="Dominio de email (ej: google.com)")


class VipCompanyOut(BaseModel):
    id: str
    name: str
    domain: str
    created_at: str


def create_vip_companies_router(db, get_current_user: Callable) -> APIRouter:
    router = APIRouter(tags=["vip-companies"])

    # ── helpers ──

    def _normalize_domain(domain: str) -> str:
        """Strip whitespace, @, protocol, trailing slashes."""
        d = domain.strip().lower()
        d = d.replace("https://", "").replace("http://", "")
        d = d.lstrip("@").rstrip("/")
        # If user entered "user@google.com", extract domain
        if "@" in d:
            d = d.split("@")[-1]
        return d

    async def _get_user_vips(user_id: str) -> List[Dict[str, Any]]:
        cursor = db.vip_companies.find({"user_id": user_id}).sort("created_at", -1)
        return await cursor.to_list(length=50)

    # ── GET list ──

    @router.get("/vip-companies")
    async def list_vip_companies(
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        check_feature(user, "vip_companies")
        docs = await _get_user_vips(user["id"])
        companies = [
            VipCompanyOut(
                id=str(doc["_id"]),
                name=doc["name"],
                domain=doc["domain"],
                created_at=doc.get("created_at", ""),
            ).model_dump()
            for doc in docs
        ]
        data = {"companies": companies}
        return build_response(request, data=data, legacy=data)

    # ── POST create ──

    @router.post("/vip-companies")
    async def add_vip_company(
        body: VipCompanyCreate,
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        check_feature(user, "vip_companies")
        domain = _normalize_domain(body.domain)
        if not domain or "." not in domain:
            raise HTTPException(status_code=400, detail="Dominio inválido. Ejemplo: google.com")

        # Check duplicates
        existing = await db.vip_companies.find_one({
            "user_id": user["id"],
            "domain": domain,
        })
        if existing:
            raise HTTPException(status_code=409, detail=f"'{domain}' ya está en tu lista VIP")

        # Max 20 companies per user
        count = await db.vip_companies.count_documents({"user_id": user["id"]})
        if count >= 20:
            raise HTTPException(status_code=400, detail="Máximo 20 empresas VIP")

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "user_id": user["id"],
            "name": body.name.strip(),
            "domain": domain,
            "created_at": now,
        }
        result = await db.vip_companies.insert_one(doc)
        doc["_id"] = result.inserted_id

        # Return updated list
        docs = await _get_user_vips(user["id"])
        companies = [
            VipCompanyOut(
                id=str(d["_id"]),
                name=d["name"],
                domain=d["domain"],
                created_at=d.get("created_at", ""),
            ).model_dump()
            for d in docs
        ]
        data = {"companies": companies}
        return build_response(request, data=data, legacy=data)

    # ── DELETE ──

    @router.delete("/vip-companies/{company_id}")
    async def delete_vip_company(
        company_id: str,
        request: Request,
        user: Dict[str, Any] = Depends(get_current_user),
    ):
        check_feature(user, "vip_companies")
        from bson import ObjectId

        try:
            oid = ObjectId(company_id)
        except Exception:
            raise HTTPException(status_code=400, detail="ID inválido")

        result = await db.vip_companies.delete_one({
            "_id": oid,
            "user_id": user["id"],
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")

        docs = await _get_user_vips(user["id"])
        companies = [
            VipCompanyOut(
                id=str(d["_id"]),
                name=d["name"],
                domain=d["domain"],
                created_at=d.get("created_at", ""),
            ).model_dump()
            for d in docs
        ]
        data = {"companies": companies}
        return build_response(request, data=data, legacy=data)

    return router