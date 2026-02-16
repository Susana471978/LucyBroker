from motor.motor_asyncio import AsyncIOMotorClient
from exec_app.config import settings

print("DEBUG MONGO URI:", settings.MONGO_URL)

if not settings.MONGO_URL:
    raise RuntimeError("MONGO_URL not configured")

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]
