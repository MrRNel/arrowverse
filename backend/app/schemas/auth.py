from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=128)


class PkceLoginRequest(BaseModel):
    email: EmailStr
    password: str
    client_id: str
    code_challenge: str = Field(min_length=43, max_length=128)
    code_challenge_method: str = "S256"
    redirect_uri: str | None = None


class AuthorizationCodeResponse(BaseModel):
    authorization_code: str
    expires_in: int


class TokenRequest(BaseModel):
    grant_type: str
    client_id: str
    code: str | None = None
    code_verifier: str | None = None
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str | None = None
    user: "UserPublic"


class UserPublic(BaseModel):
    public_id: str
    email: EmailStr
    username: str
    display_name: str


class ExtensionLinkRequest(BaseModel):
    device_name: str = Field(default="Chrome Extension", max_length=128)


class ExtensionLinkResponse(BaseModel):
    refresh_token: str
    device_id: str
    expires_in: int


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str
    user: UserPublic


TokenResponse.model_rebuild()
