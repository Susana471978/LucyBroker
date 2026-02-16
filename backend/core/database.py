from motor.motor_asyncio import AsyncIOMotorClient
from backend.core.settings import settings

if not settings.mongo_url:
    raise RuntimeError("MONGO_URL no configurado en .env")

client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.mongo_db]
