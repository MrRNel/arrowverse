import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()


def _env_files() -> tuple[str, ...]:
    files: list[Path] = [BACKEND_ROOT / ".env"]
    env_specific = BACKEND_ROOT / f".env.{ENVIRONMENT}"
    if env_specific.exists():
        files.append(env_specific)
    return tuple(str(path) for path in files)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = ENVIRONMENT
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "arrowverse"
    db_user: str = "arrowverse"
    db_password: str = "arrowverse"
    database_url: str | None = None
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 30
    auth_code_minutes: int = 5
    cors_origins: str = "http://localhost:4200,http://localhost:8000"
    spa_client_id: str = "arrowverse-web"
    extension_client_id: str = "arrowverse-extension"
    public_registration: bool = True
    frontend_dist: str = "../dist/arrowverse/browser"
    watch_order_path: str = "../public/assets/data/watch-order.json"

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        if not self.database_url:
            self.database_url = (
                f"mysql+aiomysql://{quote_plus(self.db_user)}:{quote_plus(self.db_password)}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
