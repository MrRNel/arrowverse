from pathlib import Path

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, progress
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


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
        async def spa_fallback(request: Request, exc: HTTPException) -> FileResponse:
            if request.url.path.startswith("/api"):
                raise exc
            index = dist_path / "index.html"
            if index.exists():
                return FileResponse(index)
            raise exc

        app.mount("/", StaticFiles(directory=dist_path, html=True), name="spa")

    return app


app = create_app()
