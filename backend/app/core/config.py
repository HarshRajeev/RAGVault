from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Document Q&A RAG API"
    environment: str = "local"

    database_url: str
    db_pool_size: int = 1
    db_max_overflow: int = 1

    supabase_url: str
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_secret: str | None = None

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    huggingface_api_token: str
    huggingface_embedding_model: str = "BAAI/bge-small-en-v1.5"
    huggingface_timeout_seconds: float = 45
    huggingface_batch_size: int = 8

    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 45

    max_upload_mb: int = 50
    rag_candidate_limit: int = 20
    rag_context_limit: int = 5

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("supabase_jwt_secret", mode="before")
    @classmethod
    def empty_secret_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def supabase_auth_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_auth_issuer}/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
