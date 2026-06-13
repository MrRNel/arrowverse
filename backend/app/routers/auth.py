from app.auth.dependencies import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthorizationCodeResponse,
    ExtensionLinkRequest,
    ExtensionLinkResponse,
    PkceLoginRequest,
    RegisterRequest,
    SessionResponse,
    TokenRequest,
    TokenResponse,
    UserPublic,
)
from app.services.auth_service import (
    create_pkce_authorization_code,
    exchange_authorization_code,
    link_extension_device,
    refresh_access_token,
    register_user,
    user_public,
)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserPublic:
    user = await register_user(
        db,
        settings,
        payload.email,
        payload.username,
        payload.password,
        payload.display_name,
    )
    return user_public(user)


@router.post("/login/pkce", response_model=AuthorizationCodeResponse)
async def login_pkce(payload: PkceLoginRequest, db: AsyncSession = Depends(get_db)) -> AuthorizationCodeResponse:
    code, expires_in = await create_pkce_authorization_code(
        db,
        settings,
        payload.email,
        payload.password,
        payload.client_id,
        payload.code_challenge,
        payload.code_challenge_method,
        payload.redirect_uri,
    )
    return AuthorizationCodeResponse(authorization_code=code, expires_in=expires_in)


@router.post("/token", response_model=TokenResponse)
async def token(payload: TokenRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if payload.grant_type == "authorization_code":
        if not payload.code or not payload.code_verifier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing code or verifier")

        access_token, refresh_token, expires_in, user = await exchange_authorization_code(
            db,
            settings,
            payload.client_id,
            payload.code,
            payload.code_verifier,
        )
    elif payload.grant_type == "refresh_token":
        if not payload.refresh_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing refresh token")

        access_token, refresh_token, expires_in, user = await refresh_access_token(
            db,
            settings,
            payload.client_id,
            payload.refresh_token,
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported grant_type")

    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        refresh_token=refresh_token,
        user=user_public(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> UserPublic:
    return user_public(user)


@router.post("/extension/link", response_model=ExtensionLinkResponse)
async def extension_link(
    payload: ExtensionLinkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExtensionLinkResponse:
    refresh_token, device_id, expires_in = await link_extension_device(db, settings, user, payload.device_name)
    return ExtensionLinkResponse(refresh_token=refresh_token, device_id=device_id, expires_in=expires_in)


@router.get("/session", response_model=SessionResponse)
async def session(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SessionResponse:
    from app.services.auth_service import issue_tokens_for_user

    access_token, refresh_token, expires_in, _ = await issue_tokens_for_user(
        db, settings, user, settings.spa_client_id, "web"
    )
    return SessionResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        user=user_public(user),
    )
