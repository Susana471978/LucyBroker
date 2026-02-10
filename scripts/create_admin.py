"""
Script para crear la cuenta de administradora en MongoDB.
Uso: python -m scripts.create_admin
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

from backend.config import settings

ADMIN_EMAIL = "susana.pierre.online@gmail.com"
ADMIN_PASSWORD = "Mantacornuda78"
ADMIN_NAME = "Susana Pierre"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def main() -> None:
    client = AsyncIOMotorClient(settings.mongo_url)
    db = client[settings.db_name]

    existing = await db.users.find_one({"email": ADMIN_EMAIL})

    if existing:
        # Solo actualizar el campo is_admin y la contraseña
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {
                "is_admin": True,
                "password": hash_password(ADMIN_PASSWORD),
            }},
        )
        print(f"✅ Usuario existente actualizado como admin: {ADMIN_EMAIL}")
    else:
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password": hash_password(ADMIN_PASSWORD),
            "name": ADMIN_NAME,
            "language": "es",
            "plan": "demo",
            "subscription_active": False,
            "trial_seconds_used": 0,
            "trial_limit": 7200,
            "trial_active": True,
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc)
        print(f"✅ Admin creada: {ADMIN_EMAIL}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
