import os
import requests

ELEVEN_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")

if not ELEVEN_API_KEY:
    raise Exception("ELEVENLABS_API_KEY no configurada")

if not VOICE_ID:
    raise Exception("ELEVENLABS_VOICE_ID no configurada")


def generate_tts_audio(text: str) -> bytes:
    """
    Genera audio usando ElevenLabs y devuelve bytes MP3.
    Compatible con modelo v2.
    """

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream"

    headers = {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.55,
            "similarity_boost": 0.75,
            "style": 0.35,
            "use_speaker_boost": True,
        },
    }

    response = requests.post(url, json=payload, headers=headers)

    if response.status_code != 200:
        raise Exception(
            f"ElevenLabs error {response.status_code}: {response.text}"
        )

    return response.content