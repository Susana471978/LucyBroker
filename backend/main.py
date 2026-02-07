from .server import app
from backend.services.gmail_auth import router as gmail_router


# Registrar rutas Gmail con prefijo /api
app.include_router(gmail_router, prefix="/api")


__all__ = ["app"]
