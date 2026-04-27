# backend/services/whisper_service.py
"""
Whisper Service - Transcripcion de audio con OpenAI gpt-4o-transcribe

Recibe audio en formato webm/mp3/wav y devuelve texto transcrito.
Optimizado para comandos de voz cortos en espanol.
Modelo configurable via WHISPER_MODEL env var.

IMPORTANTE: esta version es completamente async.
El endpoint que la llame debe hacer: text = await transcribe_audio(audio_bytes, ...)
"""

import os
from io import BytesIO

from backend.utils.logger import logger


# -- Config --
DEFAULT_MODEL = "gpt-4o-transcribe"
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 MB (OpenAI limit)
SUPPORTED_FORMATS = {"webm", "mp3", "wav", "m4a", "ogg", "flac"}


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: str = "es",
    prompt: str = "",
) -> dict:
    """
    Transcribe audio usando OpenAI gpt-4o-transcribe (async).

    Args:
        audio_bytes: contenido del archivo de audio en bytes.
        filename: nombre del archivo con extension (para MIME type).
        language: codigo ISO del idioma (default: "es" para espanol).
        prompt: contexto opcional para mejorar la transcripcion.

    Returns:
        dict con text, language, model.

    Raises:
        ValueError: si el audio es invalido.
        RuntimeError: si no hay API key o la API falla.
    """
    if not audio_bytes or len(audio_bytes) == 0:
        raise ValueError("Audio vacio")

    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise ValueError(
            f"Audio demasiado grande: {len(audio_bytes) / (1024*1024):.1f} MB "
            f"(maximo {MAX_AUDIO_SIZE / (1024*1024):.0f} MB)"
        )

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext and ext not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Formato no soportado: .{ext}. "
            f"Formatos validos: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY no configurada")

    model = os.getenv("WHISPER_MODEL", DEFAULT_MODEL)

    base_prompt = (
        "Transcripcion de comandos de voz en espanol de Espana. "
        "Contexto: asistente ejecutivo profesional. "
        "Nombres propios de personas y empresas espanolas."
    )
    full_prompt = f"{base_prompt} {prompt}".strip() if prompt else base_prompt

    logger.info(
        "Whisper transcription: model=%s, size=%.1f KB, lang=%s",
        model,
        len(audio_bytes) / 1024,
        language,
    )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)

        audio_file = BytesIO(audio_bytes)
        audio_file.name = filename

        response = await client.audio.transcriptions.create(
            model=model,
            file=audio_file,
            language=language,
            prompt=full_prompt,
        )

        text = response.text.strip() if response.text else ""

        logger.info(
            "Whisper result: %d chars, text='%s'",
            len(text),
            text[:80] + ("..." if len(text) > 80 else ""),
        )

        return {
            "text": text,
            "language": language,
            "model": model,
        }

    except Exception as e:
        logger.error("Whisper transcription failed: %s", str(e))
        raise RuntimeError(f"Error en transcripcion: {str(e)}")
