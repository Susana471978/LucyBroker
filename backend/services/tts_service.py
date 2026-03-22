# backend/services/tts_service.py

"""
TTS Service — ElevenLabs (Marta Jiménez) con fallback a OpenAI
Voz principal: ElevenLabs con voice_id BXtvkfRgOYGPQKVRgufE
Fallback automático: OpenAI TTS (shimmer) si ElevenLabs falla o no está disponible.
"""

import os
import asyncio
import httpx

from backend.utils.logger import logger

# ── Config ──────────────────────────────────────────────
ELEVENLABS_VOICE_ID = "BXtvkfRgOYGPQKVRgufE"  # Marta Jiménez
ELEVENLABS_MODEL = "eleven_multilingual_v2"
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"


def generate_tts_audio(text: str) -> bytes:
    """
    Genera audio MP3.
    Intenta ElevenLabs primero, si falla por cualquier razón cae a OpenAI.
    """
    text = (text or "").strip()
    if not text:
        raise Exception("Texto vacío")

    if len(text) > 4096:
        text = text[:4096]

    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

    if elevenlabs_key:
        try:
            return _generate_elevenlabs(text, elevenlabs_key)
        except Exception as e:
            logger.warning("ElevenLabs failed (%s), falling back to OpenAI TTS", str(e))

    # Fallback a OpenAI
    return _generate_openai(text)


def _generate_elevenlabs(text: str, api_key: str) -> bytes:
    url = f"{ELEVENLABS_API_URL}/{ELEVENLABS_VOICE_ID}"

    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.4,
            "use_speaker_boost": True,
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)

        if response.status_code == 200:
            return response.content
        else:
            raise Exception(f"ElevenLabs {response.status_code}")

    except httpx.TimeoutException:
        raise Exception("ElevenLabs timeout")


def _generate_openai(text: str) -> bytes:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise Exception("No TTS provider available")

    async def _call():
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        response = await client.audio.speech.create(
            model="tts-1",
            voice="shimmer",
            input=text,
            speed=1.0,
        )
        return response.content

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _call())
                return future.result(timeout=30)
        else:
            return loop.run_until_complete(_call())
    except Exception as e:
        raise Exception(f"OpenAI TTS error: {e}")