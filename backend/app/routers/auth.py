from fastapi import APIRouter, Depends

from app.core.security import AuthenticatedUser, get_current_user
from app.models.schemas import UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserProfile)
async def read_current_user(user: AuthenticatedUser = Depends(get_current_user)) -> UserProfile:
    return UserProfile(id=user.id, email=user.email, role=user.role)
