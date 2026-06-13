from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdateRequest
from app.services.settings_service import get_user_settings, update_user_settings
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=['settings'])


@router.get('/users/me/settings', response_model=UserSettingsResponse)
async def read_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    return await get_user_settings(db, user)


@router.patch('/users/me/settings', response_model=UserSettingsResponse)
async def patch_settings(
    payload: UserSettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    return await update_user_settings(db, user, payload)
