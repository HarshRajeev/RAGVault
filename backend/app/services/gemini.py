import httpx

from app.core.config import get_settings


class GeminiServiceError(RuntimeError):
    pass


class GeminiRateLimitError(GeminiServiceError):
    pass


class GeminiClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.timeout = settings.gemini_timeout_seconds
        self.endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        )

    async def generate_text(
        self,
        *,
        system_instruction: str,
        prompt: str,
        temperature: float = 0.2,
        max_output_tokens: int = 1024,
    ) -> str:
        payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_output_tokens,
            },
        }
        params = {"key": self.api_key}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(self.endpoint, params=params, json=payload)

        if response.status_code == 429:
            raise GeminiRateLimitError("Gemini rate limit reached.")
        if response.status_code >= 400:
            raise GeminiServiceError(f"Gemini request failed with {response.status_code}.")

        return self._extract_text(response.json())

    @staticmethod
    def _extract_text(data: dict) -> str:
        candidates = data.get("candidates") or []
        if not candidates:
            raise GeminiServiceError("Gemini returned no candidates.")

        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in parts).strip()
        if not text:
            raise GeminiServiceError("Gemini returned an empty response.")
        return text
