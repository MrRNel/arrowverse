from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.progress import (
    BulkProgressRequest,
    GamificationMetaResponse,
    GamificationMetaUpdateRequest,
    ProgressResponse,
    ProgressStatsResponse,
    ProgressUpdateRequest,
)
from app.services.auth_service import load_watch_order
from app.services.progress_service import (
    bulk_set_progress,
    get_gamification_meta,
    get_progress,
    get_progress_stats,
    set_progress,
    update_gamification_meta,
)
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["progress"])


@router.get("/episodes")
async def list_episodes() -> list[dict]:
    return load_watch_order()


@router.get("/progress", response_model=ProgressResponse)
async def progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> ProgressResponse:
    return await get_progress(db, user)


@router.get("/progress/stats", response_model=ProgressStatsResponse)
async def progress_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProgressStatsResponse:
    return await get_progress_stats(db, user)


@router.put("/progress/{row_number}", response_model=ProgressResponse)
async def update_progress(
    row_number: int,
    payload: ProgressUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProgressResponse:
    return await set_progress(db, user, row_number, payload)


@router.post("/progress/bulk", response_model=ProgressResponse)
async def bulk_progress(
    payload: BulkProgressRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProgressResponse:
    return await bulk_set_progress(db, user, payload)


@router.get("/users/me/meta", response_model=GamificationMetaResponse)
async def gamification_meta(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GamificationMetaResponse:
    return await get_gamification_meta(db, user)


@router.patch("/users/me/meta", response_model=GamificationMetaResponse)
async def patch_gamification_meta(
    payload: GamificationMetaUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GamificationMetaResponse:
    return await update_gamification_meta(db, user, payload)
