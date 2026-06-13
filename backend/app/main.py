from pathlib import Path

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, progress
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

_PROBE_EXTENSIONS = (
    ".php",
    ".bak",
    ".old",
    ".dist",
    ".backup",
    ".sql",
    ".yaml",
    ".yml",
    ".json",
    ".xml",
    ".env",
    ".log",
    ".inc",
    ".swp",
    ".git",
    ".credentials",
    ".pgpass",
    ".npmrc",
    ".pypirc",
)
_PROBE_SEGMENTS = (
    "wp-config",
    "wp-admin",
    "wp-login",
    "phpmyadmin",
    "/.git",
    "/.aws",
    "/.vscode",
    "/.env",
    "/.claude",
    "bootstrap/cache",
)


def _is_probe_path(path: str) -> bool:
    lower = path.lower()
    if "/." in lower or lower.startswith("/."):
        return True
    if any(lower.endswith(ext) for ext in _PROBE_EXTENSIONS):
        return True
    return any(segment in lower for segment in _PROBE_SEGMENTS)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Arrowverse Tracker API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(progress.router, prefix="/api")

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    async def startup() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    dist_path = Path(settings.frontend_dist)
    if dist_path.exists():
        assets_path = dist_path / "assets"
        if assets_path.exists():
            app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

        @app.get("/")
        async def spa_root() -> FileResponse:
            return FileResponse(dist_path / "index.html")

        @app.exception_handler(404)
        async def spa_fallback(request: Request, exc: HTTPException) -> FileResponse | JSONResponse:
            path = request.url.path
            if path.startswith("/api") or _is_probe_path(path):
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            index = dist_path / "index.html"
            if index.exists():
                return FileResponse(index)
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        app.mount("/", StaticFiles(directory=dist_path, html=True), name="spa")

    return app


app = create_app()
