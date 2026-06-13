import hashlib
import secrets
from datetime import datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.config import Settings
from app.utils.time import utc_now


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token(prefix: str = "") -> str:
    token = secrets.token_urlsafe(48)
    return f"{prefix}{token}" if prefix else token


def generate_authorization_code() -> str:
    return generate_token("avcode_")


def generate_refresh_token(client_type: str) -> str:
    prefix = "avrt_web_" if client_type == "web" else "avrt_ext_"
    return generate_token(prefix)


def create_access_token(user_id: int, public_id: str, settings: Settings) -> tuple[str, datetime]:
    expires_at = utc_now() + timedelta(minutes=settings.jwt_access_minutes)
    payload = {
        "sub": public_id,
        "uid": user_id,
        "type": "access",
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str, settings: Settings) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid access token") from exc

    if payload.get("type") != "access":
        raise ValueError("Invalid token type")

    return payload


def verify_pkce(code_verifier: str, code_challenge: str, method: str = "S256") -> bool:
    if method != "S256":
        return False

    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    import base64

    computed = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return computed == code_challenge
