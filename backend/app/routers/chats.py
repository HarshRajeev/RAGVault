from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models.schemas import AskRequest, AskResponse, ChatSessionCreate, ChatSessionRead, MessageRead
from app.models.tables import ChatSession, Message
from app.services.rag import answer_question, ensure_session_owner

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatSessionRead])
async def list_chat_sessions(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatSessionRead]:
    sessions = await db.scalars(
        select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.created_at.desc())
    )
    return [ChatSessionRead.model_validate(session) for session in sessions.all()]


@router.post("", response_model=ChatSessionRead, status_code=201)
async def create_chat_session(
    payload: ChatSessionCreate,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionRead:
    session = ChatSession(user_id=user.id, title=payload.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionRead.model_validate(session)


@router.get("/{session_id}/messages", response_model=list[MessageRead])
async def list_messages(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageRead]:
    await ensure_session_owner(db=db, user_id=user.id, session_id=session_id)
    messages = await db.scalars(
        select(Message).where(Message.session_id == session_id).order_by(Message.created_at.asc())
    )
    return [MessageRead.model_validate(message) for message in messages.all()]


@router.post("/{session_id}/ask", response_model=AskResponse)
async def ask_question(
    session_id: UUID,
    payload: AskRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AskResponse:
    return await answer_question(
        db=db,
        user_id=user.id,
        session_id=session_id,
        question=payload.question,
    )


@router.delete("/{session_id}", status_code=204)
async def delete_chat_session(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(delete(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id))
    await db.commit()
