"""Apply idempotent schema migrations against the configured database."""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import engine  # noqa: E402


MIGRATIONS: list[tuple[str, str, str]] = [
    (
        'watched_episodes.status',
        """
        SELECT COUNT(*) AS cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'watched_episodes'
          AND COLUMN_NAME = 'status'
        """,
        """
        ALTER TABLE watched_episodes
        ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'watched' AFTER source
        """,
    ),
]


async def run_migrations() -> None:
    try:
        async with engine.begin() as conn:
            for label, check_sql, apply_sql in MIGRATIONS:
                result = await conn.execute(text(check_sql))
                exists = int(result.scalar_one()) > 0
                if exists:
                    print(f'OK  {label} already exists — skipped')
                    continue

                await conn.execute(text(apply_sql))
                print(f'OK  {label} applied')
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(run_migrations())


if __name__ == '__main__':
    main()
