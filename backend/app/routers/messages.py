from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models.schemas import FeedbackRequest, FeedbackResponse
from app.models.tables import ChatSession, Message

router = APIRouter(prefix="/messages", tags=["messages"])


@router.patch("/{message_id}/feedback", response_model=FeedbackResponse)
async def update_message_feedback(
    message_id: UUID,
    payload: FeedbackRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    owner_filter = select(ChatSession.id).where(
        ChatSession.id == Message.session_id,
        ChatSession.user_id == user.id,
    )
    statement = (
        update(Message)
        .where(
            Message.id == message_id,
            Message.role == "assistant",
            exists(owner_filter),
        )
        .values(user_feedback=payload.user_feedback)
        .returning(Message.id)
    )
    updated = await db.scalar(statement)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assistant message not found.",
        )

    await db.commit()
    return FeedbackResponse(message_id=message_id, user_feedback=payload.user_feedback)
