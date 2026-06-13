from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.progress import UserGamificationMeta, WatchedEpisode
from app.models.user import User
from app.schemas.progress import (
    BulkProgressRequest,
    GamificationMetaResponse,
    GamificationMetaUpdateRequest,
    ProgressResponse,
    ProgressStatsResponse,
    ProgressUpdateRequest,
    WatchedEpisodeRecord,
)
from app.services.auth_service import load_watch_order
from fastapi import HTTPException, status


def _split_progress_rows(rows: list[WatchedEpisode]) -> ProgressResponse:
    watched_records = [
        WatchedEpisodeRecord(
            row_number=row.row_number,
            watched_at=row.watched_at,
            source=row.source,
            status=row.status if row.status in ('partial', 'watched') else 'watched',
        )
        for row in rows
    ]
    watched_rows = [row.row_number for row in rows if row.status == 'watched']
    partial_rows = [row.row_number for row in rows if row.status == 'partial']
    return ProgressResponse(watched_rows=watched_rows, partial_rows=partial_rows, watched=watched_records)


async def get_progress(db: AsyncSession, user: User) -> ProgressResponse:
    result = await db.execute(
        select(WatchedEpisode).where(WatchedEpisode.user_id == user.id).order_by(WatchedEpisode.row_number)
    )
    rows = result.scalars().all()
    return _split_progress_rows(rows)


async def set_progress(
    db: AsyncSession,
    user: User,
    row_number: int,
    payload: ProgressUpdateRequest,
) -> ProgressResponse:
    episodes = load_watch_order()
    valid_rows = {episode['row_number'] for episode in episodes}
    if row_number not in valid_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Unknown episode row')

    status_value = payload.status or 'watched'

    if status_value == 'unwatched':
        await db.execute(
            delete(WatchedEpisode).where(
                WatchedEpisode.user_id == user.id,
                WatchedEpisode.row_number == row_number,
            )
        )
    else:
        existing = await db.get(WatchedEpisode, {'user_id': user.id, 'row_number': row_number})
        if existing is None:
            db.add(
                WatchedEpisode(
                    user_id=user.id,
                    row_number=row_number,
                    source=payload.source,
                    status=status_value,
                )
            )
        else:
            existing.status = status_value
            existing.source = payload.source

    await db.commit()
    return await get_progress(db, user)


async def bulk_set_progress(db: AsyncSession, user: User, payload: BulkProgressRequest) -> ProgressResponse:
    episodes = load_watch_order()
    valid_rows = {episode['row_number'] for episode in episodes}

    for row_number in payload.row_numbers:
        if row_number not in valid_rows:
            continue

        existing = await db.get(WatchedEpisode, {'user_id': user.id, 'row_number': row_number})
        if existing is None:
            db.add(
                WatchedEpisode(
                    user_id=user.id,
                    row_number=row_number,
                    source=payload.source,
                    status='watched',
                )
            )
        else:
            existing.status = 'watched'
            existing.source = payload.source

    await db.commit()
    return await get_progress(db, user)


async def get_progress_stats(db: AsyncSession, user: User) -> ProgressStatsResponse:
    progress = await get_progress(db, user)
    episodes = load_watch_order()
    watched_set = set(progress.watched_rows)
    partial_set = set(progress.partial_rows)
    total = len(episodes)
    watched_count = len(watched_set)
    partial_count = len(partial_set)
    up_next = next((episode for episode in episodes if episode['row_number'] not in watched_set), None)

    return ProgressStatsResponse(
        watched=watched_count,
        partial=partial_count,
        outstanding=max(total - watched_count, 0),
        total=total,
        progress_percent=round((watched_count / total) * 100) if total else 0,
        up_next=up_next,
    )


async def get_gamification_meta(db: AsyncSession, user: User) -> GamificationMetaResponse:
    result = await db.execute(select(UserGamificationMeta).where(UserGamificationMeta.user_id == user.id))
    meta = result.scalar_one_or_none()
    if meta is None:
        return GamificationMetaResponse(best_streak=0, seen_achievement_ids=[])

    return GamificationMetaResponse(
        best_streak=meta.best_streak,
        seen_achievement_ids=list(meta.seen_achievement_ids or []),
    )


async def update_gamification_meta(
    db: AsyncSession,
    user: User,
    payload: GamificationMetaUpdateRequest,
) -> GamificationMetaResponse:
    result = await db.execute(select(UserGamificationMeta).where(UserGamificationMeta.user_id == user.id))
    meta = result.scalar_one_or_none()
    if meta is None:
        meta = UserGamificationMeta(user_id=user.id, best_streak=0, seen_achievement_ids=[])
        db.add(meta)

    if payload.best_streak is not None:
        meta.best_streak = payload.best_streak
    if payload.seen_achievement_ids is not None:
        meta.seen_achievement_ids = payload.seen_achievement_ids

    await db.commit()
    await db.refresh(meta)
    return GamificationMetaResponse(
        best_streak=meta.best_streak,
        seen_achievement_ids=list(meta.seen_achievement_ids or []),
    )
