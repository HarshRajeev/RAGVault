import asyncio
from collections.abc import Sequence
from numbers import Number

import httpx

from app.core.config import get_settings


class EmbeddingServiceError(RuntimeError):
    pass


class HuggingFaceEmbeddingClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.huggingface_embedding_model
        self.api_token = settings.huggingface_api_token
        self.timeout = settings.huggingface_timeout_seconds
        self.batch_size = max(1, settings.huggingface_batch_size)
        self.endpoint = f"https://router.huggingface.co/hf-inference/models/{self.model}"

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        cleaned = [text.strip() for text in texts if text and text.strip()]
        if not cleaned:
            return []

        vectors: list[list[float]] = []
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for start in range(0, len(cleaned), self.batch_size):
                batch = cleaned[start : start + self.batch_size]
                vectors.extend(await self._embed_batch(client, batch))
        return vectors

    async def embed_text(self, text: str) -> list[float]:
        vectors = await self.embed_texts([text])
        if not vectors:
            raise EmbeddingServiceError("No embedding was generated.")
        return vectors[0]

    async def _embed_batch(
        self,
        client: httpx.AsyncClient,
        batch: Sequence[str],
        max_retries: int = 3,
    ) -> list[list[float]]:
        headers = {"Authorization": f"Bearer {self.api_token}"}
        payload = {
            "inputs": list(batch) if len(batch) > 1 else batch[0],
            "options": {"wait_for_model": False},
        }

        for attempt in range(max_retries + 1):
            try:
                response = await client.post(self.endpoint, headers=headers, json=payload)
            except httpx.RequestError as exc:
                raise EmbeddingServiceError(
                    "Could not reach Hugging Face embeddings API. Check your internet connection "
                    "and HUGGINGFACE_API_TOKEN, then try again."
                ) from exc

            if response.status_code == 503 and attempt < max_retries:
                await asyncio.sleep(min(2**attempt, 8))
                continue
            if response.status_code >= 400:
                detail = response.text[:300] if response.text else "No response body."
                raise EmbeddingServiceError(
                    f"Hugging Face embedding request failed with {response.status_code}: {detail}"
                )

            data = response.json()
            return self._normalize_embedding_response(data, expected_count=len(batch))

        raise EmbeddingServiceError("Hugging Face model did not become available.")

    def _normalize_embedding_response(self, data: object, expected_count: int) -> list[list[float]]:
        if expected_count == 1:
            vector = self._coerce_vector(data)
            return [vector]

        if not isinstance(data, list) or len(data) != expected_count:
            raise EmbeddingServiceError("Unexpected batch embedding response shape.")

        return [self._coerce_vector(item) for item in data]

    def _coerce_vector(self, value: object) -> list[float]:
        if self._is_number_list(value):
            vector = [float(item) for item in value]
        elif isinstance(value, list) and value and all(self._is_number_list(row) for row in value):
            vector = self._mean_pool(value)
        elif (
            isinstance(value, list)
            and len(value) == 1
            and isinstance(value[0], list)
            and self._is_number_list(value[0])
        ):
            vector = [float(item) for item in value[0]]
        else:
            raise EmbeddingServiceError("Unable to parse embedding vector response.")

        if len(vector) != 384:
            raise EmbeddingServiceError(f"Expected 384 dimensions, received {len(vector)}.")
        return vector

    @staticmethod
    def _is_number_list(value: object) -> bool:
        return isinstance(value, list) and bool(value) and all(isinstance(item, Number) for item in value)

    @staticmethod
    def _mean_pool(rows: Sequence[Sequence[Number]]) -> list[float]:
        width = len(rows[0])
        totals = [0.0] * width
        for row in rows:
            for index, item in enumerate(row):
                totals[index] += float(item)
        return [item / len(rows) for item in totals]
