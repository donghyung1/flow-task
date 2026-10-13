"""FastAPI application factory."""

import logging
import time
from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from flow_tarsk.api.v1 import api_router
from flow_tarsk.core.config import get_settings
from flow_tarsk.core.errors import AppError, install_handlers
from flow_tarsk.core.logging import setup_logging
from flow_tarsk.db.session import get_engine

STATIC_DIR = Path(__file__).parent / "static"
CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; "
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
)
_DOC_PATHS = ("/docs", "/redoc", "/openapi.json")
logger = logging.getLogger("flow_tarsk.access")


def create_app(static_dir: Path | None = None) -> FastAPI:
    static_dir = static_dir or STATIC_DIR
    setup_logging(get_settings().log_level)
    app = FastAPI(title="Task Flow", version="0.1.0")
    install_handlers(app)

    @app.middleware("http")
    async def security_and_logging(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        # Swagger UI / ReDoc load assets from a CDN and inline scripts; exempt them from CSP.
        if request.url.path not in _DOC_PATHS:
            response.headers["Content-Security-Policy"] = CSP
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round((time.perf_counter() - start) * 1000, 2),
            },
        )
        return response

    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    async def health() -> JSONResponse:
        try:
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            logger.exception("health check failed")
            return JSONResponse({"status": "error", "db": "error"}, status_code=503)
        return JSONResponse({"status": "ok", "db": "ok"})

    app.mount("/static", StaticFiles(directory=static_dir, check_dir=False), name="static")

    @app.get("/", include_in_schema=False)
    async def root() -> RedirectResponse:
        return RedirectResponse("/app/today", status_code=302)

    @app.get("/app", include_in_schema=False)
    @app.get("/app/{path:path}", include_in_schema=False)
    async def spa(path: str = "") -> FileResponse:
        index = static_dir / "index.html"
        if not index.is_file():
            raise AppError("NOT_FOUND", "frontend not built", 404)
        return FileResponse(index)

    return app


app = create_app()
