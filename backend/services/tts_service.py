# backend/services/tts_service.py

"""
TTS Service — OpenAI Text-to-Speech
Reemplaza ElevenLabs por OpenAI TTS (tts-1, voz nova).
Voz natural en español, sin configuración extra — usa OPENAI_API_KEY.
"""

import os
import asyncio


def generate_tts_audio(text: str) -> bytes:
    """
    Genera audio MP3 usando OpenAI TTS.
    Interfaz síncrona compatible con el endpoint existente en server.py.
    """
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise Exception("OPENAI_API_KEY no configurada")

    text = text.strip()
    if not text:
        raise Exception("Texto vacío")

    # Límite defensivo
    if len(text) > 4096:
        text = text[:4096]

    async def _generate():
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        response = await client.audio.speech.create(
            model="tts-1",
            voice="shimmer",       # voz femenina, natural en español
            input=text,
            speed=1.0,
        )
        return response.content

    # Ejecutar async desde contexto síncrono
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Si hay un loop activo (FastAPI), usar run_coroutine_threadsafe
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _generate())
                return future.result(timeout=30)
        else:
            return loop.run_until_complete(_generate())
    except Exception as e:
        raise Exception(f"OpenAI TTS error: {e}")