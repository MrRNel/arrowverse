import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSetting
from app.models.user import User
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdateRequest

SETTING_JELLYFIN_URL = 'jellyfin_url'
SETTING_SERIES_SOURCES = 'series_sources'

DEFAULT_JELLYFIN_URL = 'http://jellyfin:8096/web/#/video'
VALID_SERIES_SOURCES = frozenset({'jellyfin', 'netflix'})


def _default_settings() -> UserSettingsResponse:
    return UserSettingsResponse(jellyfin_url=DEFAULT_JELLYFIN_URL, series_sources={})


def _parse_series_sources(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    cleaned: dict[str, str] = {}
    for show_id, source in parsed.items():
        if not isinstance(show_id, str) or not isinstance(source, str):
            continue
        normalized = source.strip().lower()
        if normalized in VALID_SERIES_SOURCES:
            cleaned[show_id.strip()] = normalized
    return cleaned


async def _load_settings_map(db: AsyncSession, user: User) -> dict[str, str]:
    result = await db.execute(select(UserSetting).where(UserSetting.user_id == user.id))
    return {row.setting_key: row.setting_value for row in result.scalars().all()}


async def get_user_settings(db: AsyncSession, user: User) -> UserSettingsResponse:
    stored = await _load_settings_map(db, user)
    defaults = _default_settings()

    jellyfin_url = stored.get(SETTING_JELLYFIN_URL, defaults.jellyfin_url).strip() or defaults.jellyfin_url
    series_sources = _parse_series_sources(stored.get(SETTING_SERIES_SOURCES))

    return UserSettingsResponse(jellyfin_url=jellyfin_url, series_sources=series_sources)


async def _upsert_setting(db: AsyncSession, user: User, key: str, value: str) -> None:
    existing = await db.get(UserSetting, {'user_id': user.id, 'setting_key': key})
    if existing is None:
        db.add(UserSetting(user_id=user.id, setting_key=key, setting_value=value))
        return

    existing.setting_value = value


async def update_user_settings(
    db: AsyncSession,
    user: User,
    payload: UserSettingsUpdateRequest,
) -> UserSettingsResponse:
    current = await get_user_settings(db, user)

    if payload.jellyfin_url is not None:
        trimmed = payload.jellyfin_url.strip()
        if trimmed:
            await _upsert_setting(db, user, SETTING_JELLYFIN_URL, trimmed)

    if payload.series_sources is not None:
        merged = dict(current.series_sources)
        merged.update(payload.series_sources)
        await _upsert_setting(
            db,
            user,
            SETTING_SERIES_SOURCES,
            json.dumps(merged, sort_keys=True),
        )

    await db.commit()
    return await get_user_settings(db, user)
