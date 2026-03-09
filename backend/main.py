from .server import app
from backend.services.gmail_auth import router as gmail_router
from backend.api.assistant import router as assistant_router
from backend.services.executive import router as executive_router  # 👈 nuevo
from backend.core.settings import settings
from backend.api.tasks import router as tasks_router

app.include_router(gmail_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")
app.include_router(executive_router, prefix="/api")  # 👈 nuevo
app.include_router(tasks_router, prefix="/api")

__all__ = ["app"]
