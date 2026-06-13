import json
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import (
    create_access_token,
    generate_authorization_code,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
    verify_pkce,
)
from app.config import Settings, get_settings
from app.models.auth import AuthorizationCode, RefreshToken
from app.models.progress import UserGamificationMeta
from app.models.user import User
from app.schemas.auth import UserPublic
from app.utils.time import as_utc, utc_now
from fastapi import HTTPException, status


def user_public(user: User) -> UserPublic:
    return UserPublic(
        public_id=user.public_id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
    )


async def ensure_gamification_meta(db: AsyncSession, user_id: int) -> UserGamificationMeta:
    result = await db.execute(select(UserGamificationMeta).where(UserGamificationMeta.user_id == user_id))
    meta = result.scalar_one_or_none()
    if meta is None:
        meta = UserGamificationMeta(user_id=user_id, best_streak=0, seen_achievement_ids=[])
        db.add(meta)
        await db.flush()
    return meta


async def register_user(db: AsyncSession, settings: Settings, email: str, username: str, password: str, display_name: str) -> User:
    if not settings.public_registration:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is disabled")

    existing = await db.execute(
        select(User).where((User.email == email) | (User.username == username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already registered")

    user = User(
        email=email.lower(),
        username=username.lower(),
        password_hash=hash_password(password),
        display_name=display_name,
    )
    db.add(user)
    await db.flush()
    await ensure_gamification_meta(db, user.id)
    await db.commit()
    await db.refresh(user)
    return user


async def create_pkce_authorization_code(
    db: AsyncSession,
    settings: Settings,
    email: str,
    password: str,
    client_id: str,
    code_challenge: str,
    code_challenge_method: str,
    redirect_uri: str | None,
) -> tuple[str, int]:
    if client_id not in {settings.spa_client_id, settings.extension_client_id}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown client_id")

    result = await db.execute(select(User).where(User.email == email.lower(), User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    code = generate_authorization_code()
    expires_at = utc_now() + timedelta(minutes=settings.auth_code_minutes)
    db.add(
        AuthorizationCode(
            code_hash=hash_token(code),
            user_id=user.id,
            client_id=client_id,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            redirect_uri=redirect_uri,
            expires_at=expires_at,
        )
    )
    await db.commit()
    return code, settings.auth_code_minutes * 60


async def issue_tokens_for_user(
    db: AsyncSession,
    settings: Settings,
    user: User,
    client_id: str,
    client_type: str,
    device_id: str | None = None,
    device_name: str | None = None,
) -> tuple[str, str, int, datetime]:
    access_token, access_expires = create_access_token(user.id, user.public_id, settings)
    refresh_token = generate_refresh_token(client_type)
    refresh_expires = utc_now() + timedelta(days=settings.jwt_refresh_days)

    db.add(
        RefreshToken(
            token_hash=hash_token(refresh_token),
            user_id=user.id,
            client_id=client_id,
            client_type=client_type,
            device_id=device_id,
            device_name=device_name,
            expires_at=refresh_expires,
        )
    )
    await db.commit()

    expires_in = int((access_expires - utc_now()).total_seconds())
    return access_token, refresh_token, expires_in, access_expires


async def exchange_authorization_code(
    db: AsyncSession,
    settings: Settings,
    client_id: str,
    code: str,
    code_verifier: str,
) -> tuple[str, str, int, User]:
    result = await db.execute(
        select(AuthorizationCode).where(
            AuthorizationCode.code_hash == hash_token(code),
            AuthorizationCode.client_id == client_id,
            AuthorizationCode.used_at.is_(None),
        )
    )
    auth_code = result.scalar_one_or_none()
    if auth_code is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authorization code")

    if as_utc(auth_code.expires_at) < utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authorization code expired")

    if not verify_pkce(code_verifier, auth_code.code_challenge, auth_code.code_challenge_method):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid PKCE verifier")

    user_result = await db.execute(select(User).where(User.id == auth_code.user_id, User.is_active.is_(True)))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    auth_code.used_at = utc_now()
    client_type = "extension" if client_id == settings.extension_client_id else "web"
    access_token, refresh_token, expires_in, _ = await issue_tokens_for_user(
        db, settings, user, client_id, client_type
    )
    await db.commit()
    return access_token, refresh_token, expires_in, user


async def refresh_access_token(
    db: AsyncSession,
    settings: Settings,
    client_id: str,
    refresh_token: str,
) -> tuple[str, str, int, User]:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(refresh_token),
            RefreshToken.client_id == client_id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored = result.scalar_one_or_none()
    if stored is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if as_utc(stored.expires_at) < utc_now():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_result = await db.execute(select(User).where(User.id == stored.user_id, User.is_active.is_(True)))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    stored.last_used_at = utc_now()
    stored.revoked_at = utc_now()

    access_token, new_refresh_token, expires_in, _ = await issue_tokens_for_user(
        db,
        settings,
        user,
        client_id,
        stored.client_type,
        device_id=stored.device_id,
        device_name=stored.device_name,
    )
    await db.commit()
    return access_token, new_refresh_token, expires_in, user


async def link_extension_device(
    db: AsyncSession,
    settings: Settings,
    user: User,
    device_name: str,
) -> tuple[str, str, int]:
    import uuid

    device_id = str(uuid.uuid4())
    _, refresh_token, expires_in, _ = await issue_tokens_for_user(
        db,
        settings,
        user,
        settings.extension_client_id,
        "extension",
        device_id=device_id,
        device_name=device_name,
    )
    return refresh_token, device_id, expires_in


@lru_cache
def load_watch_order() -> list[dict]:
    settings = get_settings()
    repo_root = Path(__file__).resolve().parents[3]
    path = repo_root / "public" / "assets" / "data" / "watch-order.json"
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)
