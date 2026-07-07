from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.schemas import AskResponse, MessageRead
from app.models.tables import ChatSession, Message
from app.services.embedding import HuggingFaceEmbeddingClient
from app.services.gemini import GeminiClient, GeminiRateLimitError, GeminiServiceError

QUERY_REWRITE_SYSTEM_INSTRUCTION = (
    "You are an AI utility tasked with query expansion. Rewrite the user's latest message "
    "into a highly specific, standalone search query optimized for vector matching based "
    "on the conversation history. Do not answer the question; output only the rewritten query."
)

ANSWER_SYSTEM_INSTRUCTION = (
    "You are a careful Document Q&A assistant. Answer strictly from the provided source "
    "blocks. If the answer is not present in the source blocks, say that the uploaded "
    "documents do not contain enough information. Cite factual claims with source labels "
    "like [Source 1]. Do not invent citations or use outside knowledge."
)

HYBRID_SEARCH_SQL = text(
    """
    WITH query AS (
        SELECT
            CAST(:query_vector AS vector) AS embedding,
            plainto_tsquery('english', :query_text) AS ts_query
    )
    SELECT
        dc.id,
        dc.document_name,
        dc.page_number,
        dc.child_content,
        dc.parent_content,
        1 - (dc.embedding <=> query.embedding) AS vector_score,
        COALESCE(ts_rank_cd(dc.text_search_vector, query.ts_query), 0) AS text_score,
        (
            (0.72 * (1 - (dc.embedding <=> query.embedding)))
            + (0.28 * COALESCE(ts_rank_cd(dc.text_search_vector, query.ts_query), 0))
        ) AS hybrid_score
    FROM document_chunks dc, query
    WHERE dc.user_id = :user_id
      AND dc.embedding IS NOT NULL
    ORDER BY hybrid_score DESC
    LIMIT :limit
    """
)


@dataclass(frozen=True)
class SearchHit:
    chunk_id: UUID
    document_name: str
    page_number: int
    child_content: str
    parent_content: str
    vector_score: float
    text_score: float
    hybrid_score: float


async def answer_question(
    *,
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    question: str,
    gemini_client: GeminiClient | None = None,
    embedding_client: HuggingFaceEmbeddingClient | None = None,
) -> AskResponse:
    await ensure_session_owner(db=db, user_id=user_id, session_id=session_id)

    gemini = gemini_client or GeminiClient()
    embeddings = embedding_client or HuggingFaceEmbeddingClient()

    history = await fetch_recent_messages(db=db, user_id=user_id, session_id=session_id, limit=3)
    rewritten_query = await rewrite_query(gemini=gemini, history=history, question=question)
    query_embedding = await embeddings.embed_text(rewritten_query)
    hits = await hybrid_search(
        db=db,
        user_id=user_id,
        query_text=rewritten_query,
        query_embedding=query_embedding,
    )

    user_message = Message(session_id=session_id, role="user", content=question, citations=[])
    db.add(user_message)
    await db.flush()

    answer_text, citations, rate_limited = await synthesize_answer(
        gemini=gemini,
        question=question,
        rewritten_query=rewritten_query,
        hits=hits,
    )
    assistant_message = Message(
        session_id=session_id,
        role="assistant",
        content=answer_text,
        citations=citations,
    )
    db.add(assistant_message)
    await db.commit()
    await db.refresh(user_message)
    await db.refresh(assistant_message)

    return AskResponse(
        user_message=MessageRead.model_validate(user_message),
        assistant_message=MessageRead.model_validate(assistant_message),
        rewritten_query=rewritten_query,
        rate_limited=rate_limited,
    )


async def ensure_session_owner(*, db: AsyncSession, user_id: UUID, session_id: UUID) -> ChatSession:
    session = await db.scalar(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    if session is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found.")
    return session


async def fetch_recent_messages(
    *,
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    limit: int,
) -> list[Message]:
    await ensure_session_owner(db=db, user_id=user_id, session_id=session_id)
    result = await db.scalars(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    return list(reversed(result.all()))


async def rewrite_query(*, gemini: GeminiClient, history: list[Message], question: str) -> str:
    history_lines = "\n".join(
        f"{message.role}: {message.content}" for message in history
    ) or "No prior conversation."
    prompt = f"Conversation history:\n{history_lines}\n\nLatest user message:\n{question}"

    try:
        rewritten = await gemini.generate_text(
            system_instruction=QUERY_REWRITE_SYSTEM_INSTRUCTION,
            prompt=prompt,
            temperature=0.0,
            max_output_tokens=256,
        )
    except (GeminiRateLimitError, GeminiServiceError):
        return question

    return rewritten.strip().strip('"') or question


async def hybrid_search(
    *,
    db: AsyncSession,
    user_id: UUID,
    query_text: str,
    query_embedding: list[float],
) -> list[SearchHit]:
    settings = get_settings()
    rows = (
        await db.execute(
            HYBRID_SEARCH_SQL,
            {
                "user_id": user_id,
                "query_text": query_text,
                "query_vector": _to_pgvector_literal(query_embedding),
                "limit": settings.rag_candidate_limit,
            },
        )
    ).mappings()

    seen_parent_blocks: set[tuple[str, int, str]] = set()
    hits: list[SearchHit] = []
    for row in rows:
        key = (row["document_name"], row["page_number"], row["parent_content"])
        if key in seen_parent_blocks:
            continue
        seen_parent_blocks.add(key)
        hits.append(
            SearchHit(
                chunk_id=row["id"],
                document_name=row["document_name"],
                page_number=row["page_number"],
                child_content=row["child_content"],
                parent_content=row["parent_content"],
                vector_score=float(row["vector_score"] or 0),
                text_score=float(row["text_score"] or 0),
                hybrid_score=float(row["hybrid_score"] or 0),
            )
        )
        if len(hits) >= settings.rag_context_limit:
            break
    return hits


async def synthesize_answer(
    *,
    gemini: GeminiClient,
    question: str,
    rewritten_query: str,
    hits: list[SearchHit],
) -> tuple[str, list[dict[str, Any]], bool]:
    citations = [
        {
            "source": index + 1,
            "chunk_id": str(hit.chunk_id),
            "document_name": hit.document_name,
            "page_number": hit.page_number,
            "score": round(hit.hybrid_score, 4),
        }
        for index, hit in enumerate(hits)
    ]

    if not hits:
        return (
            "I could not find relevant context in your uploaded documents for that question.",
            [],
            False,
        )

    source_blocks = "\n\n".join(
        (
            f"[Source {index + 1}: {hit.document_name}, page {hit.page_number}]\n"
            f"{hit.parent_content}"
        )
        for index, hit in enumerate(hits)
    )
    prompt = (
        f"Original question:\n{question}\n\n"
        f"Standalone retrieval query:\n{rewritten_query}\n\n"
        f"Source blocks:\n{source_blocks}\n\n"
        "Write a concise, grounded answer with citations."
    )

    try:
        answer = await gemini.generate_text(
            system_instruction=ANSWER_SYSTEM_INSTRUCTION,
            prompt=prompt,
            temperature=0.2,
            max_output_tokens=1400,
        )
        return answer, citations, False
    except GeminiRateLimitError:
        return (
            "Gemini is temporarily rate limited, so I retrieved the relevant document context "
            "but could not safely synthesize an answer yet. Please try again in a moment.",
            citations,
            True,
        )
    except GeminiServiceError:
        return (
            "Gemini is temporarily unavailable, so I retrieved the relevant document context "
            "but could not safely synthesize an answer yet. Please try again in a moment.",
            citations,
            False,
        )


def _to_pgvector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"
