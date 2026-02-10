from .server import app
from backend.services.gmail_auth import router as gmail_router
from backend.services.assistant import router as assistant_router  # 👈 nuevo

# Registrar rutas
app.include_router(gmail_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")  # 👈 clave

__all__ = ["app"]
