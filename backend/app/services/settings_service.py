import json
import re
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSetting
from app.models.user import User
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdateRequest

SETTING_JELLYFIN_URL = 'jellyfin_url'
SETTING_JELLYFIN_HOSTS = 'jellyfin_hosts'
SETTING_SERIES_SOURCES = 'series_sources'

DEFAULT_JELLYFIN_URL = 'http://jellyfin:8096/web/#/video'
DEFAULT_JELLYFIN_HOSTS = ('localhost', '127.0.0.1', 'jellyfin')
VALID_SERIES_SOURCES = frozenset({'jellyfin', 'netflix'})
MAX_JELLYFIN_HOSTS = 32
_HOSTNAME_RE = re.compile(
    r'^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
    re.IGNORECASE,
)
_IPV4_RE = re.compile(
    r'^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$',
)
_IPV6_RE = re.compile(r'^\[[0-9a-f:]+\]$|^[0-9a-f:]+$', re.IGNORECASE)


def _default_settings() -> UserSettingsResponse:
    return UserSettingsResponse(
        jellyfin_url=DEFAULT_JELLYFIN_URL,
        jellyfin_hosts=list(DEFAULT_JELLYFIN_HOSTS),
        series_sources={},
    )


def _normalize_jellyfin_host(value: str) -> str | None:
    trimmed = value.strip()
    if not trimmed:
        return None

    if '://' in trimmed:
        try:
            parsed = urlparse(trimmed)
        except ValueError:
            return None
        host = parsed.hostname
        if not host:
            return None
        return host.lower()

    host = trimmed.lower()
    if host.startswith('[') and host.endswith(']'):
        host = host[1:-1]

    if _IPV4_RE.fullmatch(host) or _IPV6_RE.fullmatch(host) or _HOSTNAME_RE.fullmatch(host):
        return host

    return None


def _parse_jellyfin_hosts(raw: str | None) -> list[str]:
    if not raw:
        return list(DEFAULT_JELLYFIN_HOSTS)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return list(DEFAULT_JELLYFIN_HOSTS)

    if not isinstance(parsed, list):
        return list(DEFAULT_JELLYFIN_HOSTS)

    hosts: list[str] = []
    seen: set[str] = set()
    for entry in parsed:
        if not isinstance(entry, str):
            continue
        normalized = _normalize_jellyfin_host(entry)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        hosts.append(normalized)
        if len(hosts) >= MAX_JELLYFIN_HOSTS:
            break

    return hosts or list(DEFAULT_JELLYFIN_HOSTS)


def _sanitize_jellyfin_hosts(hosts: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for entry in hosts:
        if not isinstance(entry, str):
            continue
        normalized = _normalize_jellyfin_host(entry)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
        if len(cleaned) >= MAX_JELLYFIN_HOSTS:
            break

    return cleaned or list(DEFAULT_JELLYFIN_HOSTS)


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


def _hosts_with_jellyfin_url(hosts: list[str], jellyfin_url: str) -> list[str]:
    merged = list(hosts)
    seen = set(merged)

    try:
        host = urlparse(jellyfin_url).hostname
    except ValueError:
        host = None

    if host:
        normalized = host.lower()
        if normalized not in seen:
            merged.append(normalized)

    return merged


async def get_user_settings(db: AsyncSession, user: User) -> UserSettingsResponse:
    stored = await _load_settings_map(db, user)
    defaults = _default_settings()

    jellyfin_url = stored.get(SETTING_JELLYFIN_URL, defaults.jellyfin_url).strip() or defaults.jellyfin_url
    jellyfin_hosts = _hosts_with_jellyfin_url(
        _parse_jellyfin_hosts(stored.get(SETTING_JELLYFIN_HOSTS)),
        jellyfin_url,
    )
    series_sources = _parse_series_sources(stored.get(SETTING_SERIES_SOURCES))

    return UserSettingsResponse(
        jellyfin_url=jellyfin_url,
        jellyfin_hosts=jellyfin_hosts,
        series_sources=series_sources,
    )


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

    if payload.jellyfin_hosts is not None:
        hosts = _sanitize_jellyfin_hosts(payload.jellyfin_hosts)
        await _upsert_setting(
            db,
            user,
            SETTING_JELLYFIN_HOSTS,
            json.dumps(hosts, sort_keys=False),
        )

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
