# backend/api/tts.py

from __future__ import annotations

import os
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.core.dependencies import get_current_user

router = APIRouter(prefix="/tts", tags=["TTS"])


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"        # nova = voz femenina natural en español
    speed: float = 1.0


@router.post("")
async def tts_endpoint(
    payload: TTSRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Convierte texto a voz usando OpenAI TTS.
    Devuelve audio/mpeg para reproducir directamente en el navegador.

    Voces disponibles: nova (femenina), alloy, echo, fable, onyx, shimmer
    nova es la que mejor suena en español.
    """

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY no configurada"
        )

    text = payload.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Texto vacío")

    # Límite defensivo — evita requests enormes
    if len(text) > 4096:
        text = text[:4096]

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)

        response = await client.audio.speech.create(
            model="tts-1",
            voice=payload.voice,
            input=text,
            speed=payload.speed,
        )

        # OpenAI devuelve bytes — los streameamos directamente al frontend
        audio_bytes = response.content

        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Cache-Control": "no-cache",
            },
        )

    except Exception as e:
        print(f"[TTS] OpenAI error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error generando audio"
        )