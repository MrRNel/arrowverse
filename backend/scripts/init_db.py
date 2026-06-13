"""Create MariaDB tables for the Arrowverse tracker."""

import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings
from app.database import Base, engine
from app.models import AuthorizationCode, RefreshToken, User, UserGamificationMeta, WatchedEpisode  # noqa: F401


async def init_db() -> None:
    settings = get_settings()
    print(f"Environment: {settings.environment}")
    print(f"Database: {settings.db_host}:{settings.db_port}/{settings.db_name}")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Database schema is ready.")


if __name__ == "__main__":
    asyncio.run(init_db())
