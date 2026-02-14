import httpx

LLAMA_URL = "http://127.0.0.1:8080/v1/chat/completions"

async def generate_response(messages, max_tokens=150, temperature=0.2):
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            LLAMA_URL,
            json={
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
