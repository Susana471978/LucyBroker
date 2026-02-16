from fastapi import FastAPI
from exec_app.routers.health import router as health_router
from exec_app.routers.session import router as session_router

app = FastAPI(title="SyntexIA Executive Engine")

app.include_router(health_router)
app.include_router(session_router)

