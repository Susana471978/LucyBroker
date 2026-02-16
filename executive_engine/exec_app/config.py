import os
from dotenv import load_dotenv
from pathlib import Path

# Cargar .env desde la raíz del proyecto
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
env_path = ROOT_DIR / ".env"

load_dotenv(dotenv_path=env_path)


class Settings:
    EXEC_ENGINE_ENV = os.getenv("ENV", "development")
    EXEC_ENGINE_PORT = int(os.getenv("EXEC_ENGINE_PORT", 8100))

    # Mongo (mismo naming que backend)
    MONGO_URL = os.getenv("MONGO_URL")
    DB_NAME = os.getenv("DB_NAME", "email_control_system")

    # Executive
    EXEC_ENGINE_URL = os.getenv("EXEC_ENGINE_URL")
    EXEC_INTERNAL_API_KEY = os.getenv("EXEC_INTERNAL_API_KEY")
    session_ttl_hours = int(os.getenv("EXEC_SESSIONS_TTL_HOURS", 24))


settings = Settings()
