from __future__ import annotations

import httpx
from typing import List, Dict, Any

from utils.logger import get_logger


class LocalLLMService:
    def __init__(self):
        self.base_url = "http://127.0.0.1:8080/v1"
        self.logger = get_logger(self.__class__.__name__)

    async def chat(self, messages: List[Dict[str, str]], max_tokens: int = 300, temperature: float = 0.2) -> str:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json={
                        "model": "local-model",
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )

                response.raise_for_status()
                data = response.json()

                return data["choices"][0]["message"]["content"]

        except Exception as e:
            self.logger.error(f"Local LLM error: {e}")
            return "No se pudo generar respuesta desde el modelo local."
