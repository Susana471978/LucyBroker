"""
Lucy — MuseTalk Lip-Sync Router
Gestiona el flujo: texto → TTS (shimmer) → MuseTalk (Colab) → vídeo MP4

Añadir a tu backend FastAPI existente:
1. Copia este archivo a backend/app/routers/lipsync.py
2. Añade las variables de entorno a .env
3. Registra el router en main.py: app.include_router(lipsync_router)
"""

import os
import io
import time
import uuid
import httpx
import asyncio
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# Si usas OpenAI para TTS
from openai import AsyncOpenAI

logger = logging.getLogger("lucy.lipsync")

router = APIRouter(prefix="/api/lipsync", tags=["lipsync"])

# ─── Config ───────────────────────────────────────────────────
MUSETALK_URL = os.getenv("MUSETALK_URL", "")  # URL ngrok del Colab
MUSETALK_SECRET = os.getenv("MUSETALK_SECRET", "lucy-musetalk-2025")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
TTS_VOICE = "shimmer"
TTS_MODEL = "tts-1"

# Directorio temporal para audio y vídeos generados
MEDIA_DIR = Path("/tmp/lucy_lipsync")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

# Cliente OpenAI
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


# ─── Models ───────────────────────────────────────────────────
class LipSyncRequest(BaseModel):
    text: str
    language: str = "es"


class LipSyncStatus(BaseModel):
    status: str  # "generating_tts" | "generating_video" | "ready" | "error"
    job_id: str
    video_url: Optional[str] = None
    elapsed: Optional[float] = None
    error: Optional[str] = None


# ─── Job tracking (in-memory, simple) ─────────────────────────
jobs: dict = {}


# ─── Endpoints ────────────────────────────────────────────────

@router.get("/health")
async def health():
    """Verifica conexión con Colab MuseTalk."""
    if not MUSETALK_URL:
        return JSONResponse(
            status_code=503,
            content={"status": "no_musetalk_url", "detail": "MUSETALK_URL not configured"}
        )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{MUSETALK_URL}/health")
            return {"status": "ok", "musetalk": resp.json()}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "musetalk_unreachable", "detail": str(e)}
        )


@router.post("/generate", response_model=LipSyncStatus)
async def generate_lipsync(req: LipSyncRequest):
    """
    Flujo completo:
    1. Genera audio TTS con OpenAI (shimmer)
    2. Envía audio a MuseTalk (Colab) para lip-sync
    3. Devuelve URL del vídeo generado

    El frontend puede hacer polling en /status/{job_id}
    """
    if not MUSETALK_URL:
        raise HTTPException(503, "MuseTalk URL not configured. Arranca el Colab notebook.")

    if not openai_client:
        raise HTTPException(503, "OpenAI API key not configured.")

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {"status": "generating_tts", "start": time.time()}

    # Lanzar generación en background
    asyncio.create_task(_process_lipsync(job_id, req.text))

    return LipSyncStatus(status="generating_tts", job_id=job_id)


@router.get("/status/{job_id}", response_model=LipSyncStatus)
async def get_status(job_id: str):
    """Polling endpoint para el frontend."""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")

    job = jobs[job_id]
    elapsed = round(time.time() - job["start"], 1)

    return LipSyncStatus(
        status=job["status"],
        job_id=job_id,
        video_url=job.get("video_url"),
        elapsed=elapsed,
        error=job.get("error")
    )


@router.get("/video/{job_id}")
async def get_video(job_id: str):
    """Descarga el vídeo generado."""
    video_path = MEDIA_DIR / f"{job_id}_lucy.mp4"
    if not video_path.exists():
        raise HTTPException(404, "Video not found")

    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename=f"lucy_{job_id}.mp4",
        headers={
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*"
        }
    )


# ─── Background processing ───────────────────────────────────

async def _process_lipsync(job_id: str, text: str):
    """Proceso completo en background."""
    try:
        # STEP 1: Generar audio TTS
        logger.info(f"[{job_id}] Generando TTS para: {text[:50]}...")
        jobs[job_id]["status"] = "generating_tts"

        audio_response = await openai_client.audio.speech.create(
            model=TTS_MODEL,
            voice=TTS_VOICE,
            input=text,
            response_format="mp3"
        )

        audio_path = MEDIA_DIR / f"{job_id}_audio.mp3"
        audio_bytes = audio_response.content
        audio_path.write_bytes(audio_bytes)

        logger.info(f"[{job_id}] Audio generado: {len(audio_bytes)} bytes")

        # STEP 2: Enviar a MuseTalk
        jobs[job_id]["status"] = "generating_video"
        logger.info(f"[{job_id}] Enviando a MuseTalk...")

        video_path = MEDIA_DIR / f"{job_id}_lucy.mp4"

        async with httpx.AsyncClient(timeout=180) as client:
            with open(audio_path, "rb") as f:
                resp = await client.post(
                    f"{MUSETALK_URL}/generate",
                    files={"audio": ("audio.mp3", f, "audio/mpeg")},
                    headers={"X-Api-Secret": MUSETALK_SECRET}
                )

            if resp.status_code != 200:
                error_detail = resp.text[:200]
                logger.error(f"[{job_id}] MuseTalk error: {error_detail}")
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = f"MuseTalk error: {resp.status_code}"
                return

            # Guardar vídeo
            video_path.write_bytes(resp.content)

        elapsed = round(time.time() - jobs[job_id]["start"], 1)
        logger.info(f"[{job_id}] Vídeo listo en {elapsed}s")

        jobs[job_id]["status"] = "ready"
        jobs[job_id]["video_url"] = f"/api/lipsync/video/{job_id}"

        # Limpiar audio temporal
        audio_path.unlink(missing_ok=True)

    except Exception as e:
        logger.exception(f"[{job_id}] Error en lip-sync pipeline")
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)


# ─── Cleanup periódico ────────────────────────────────────────

async def cleanup_old_jobs():
    """Eliminar jobs y vídeos con más de 30 minutos."""
    while True:
        await asyncio.sleep(300)  # Cada 5 min
        now = time.time()
        expired = [jid for jid, j in jobs.items() if now - j["start"] > 1800]
        for jid in expired:
            video = MEDIA_DIR / f"{jid}_lucy.mp4"
            video.unlink(missing_ok=True)
            del jobs[jid]
        if expired:
            logger.info(f"Cleaned up {len(expired)} old jobs")