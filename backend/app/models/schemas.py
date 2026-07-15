from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserProfile(BaseModel):
    id: UUID
    email: str | None = None
    role: str | None = None


class DocumentIngestResponse(BaseModel):
    document_name: str
    pages_processed: int
    parent_chunks: int
    child_chunks: int


class DocumentSummary(BaseModel):
    document_name: str
    pages: int
    chunks: int
    created_at: datetime


class ChatSessionCreate(BaseModel):
    title: str = Field(default="New chat", max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        value = value.strip()
        return value or "New chat"


class ChatSessionUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank.")
        return value


class ChatSessionRead(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageRead(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    user_feedback: bool | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=8000)

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Question cannot be blank.")
        return value


class AskResponse(BaseModel):
    user_message: MessageRead
    assistant_message: MessageRead
    rewritten_query: str
    rate_limited: bool = False


class FeedbackRequest(BaseModel):
    user_feedback: bool


class FeedbackResponse(BaseModel):
    message_id: UUID
    user_feedback: bool
