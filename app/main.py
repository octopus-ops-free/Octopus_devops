from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import ai, alerts, auth, db as db_api, hosts, logs, monitoring, notifications, remote_users, resources, security, terminal, users
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.oplog import write_operation_log
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.security.jwt import decode_token
from app.services.bootstrap import ensure_bootstrap_admin
from app.services.migrations import run_sqlite_migrations
from app.services.scheduler import MetricsScheduler

logger = logging.getLogger(__name__)
metrics_scheduler = MetricsScheduler(interval_seconds=60)

# Windows 下某些事件循环策略不支持 asyncio 子进程（会抛 NotImplementedError）。
# Octopus 的远程采集依赖系统 ssh 子进程，因此强制启用 Proactor 策略以保证 subprocess 可用。
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())  # type: ignore[attr-defined]
    except Exception:
        # 若运行时不支持该策略（极少数环境），保持默认策略并让接口返回可读错误
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    await run_sqlite_migrations(engine)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await ensure_bootstrap_admin(db)
    metrics_scheduler.start()
    yield
    await metrics_scheduler.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# UI serving mode:
# - legacy: serve `app/ui/*.html` via FileResponse (default)
# - react:  serve `frontend/dist/index.html` + assets (when built)
UI_MODE = os.getenv("UI_MODE", "legacy").lower()
FRONTEND_DIST = Path("frontend/dist")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 提供静态工具脚本下载（例如 SSH 自检脚本）
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# When React UI has been built, serve its assets under a stable prefix.
# This keeps FastAPI routing simple and allows an easy rollback to legacy UI.
if FRONTEND_DIST.exists():
    # Mount dist root so both `/ui-assets/assets/*` and `/ui-assets/favicon.svg`
    # resolve correctly against Vite production output.
    app.mount("/ui-assets", StaticFiles(directory=str(FRONTEND_DIST)), name="ui-assets")


@app.middleware("http")
async def operation_log_middleware(request: Request, call_next):
    response: Response
    user = None
    try:
        # Best-effort parse access token (do not block request)
        authz = request.headers.get("authorization")
        if authz and authz.lower().startswith("bearer "):
            token = authz.split(" ", 1)[1]
            payload = decode_token(token)
            if payload.get("type") == "access" and payload.get("sub"):
                async with SessionLocal() as db:
                    from sqlalchemy import select
                    from app.db.models import User

                    user = await db.scalar(select(User).where(User.username == payload["sub"]))
    except Exception:
        user = None

    response = await call_next(request)

    try:
        async with SessionLocal() as db:
            await write_operation_log(db=db, request=request, status_code=response.status_code, user=user)
    except Exception:
        logger.exception("operation log middleware failed")

    return response


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(monitoring.router)
app.include_router(alerts.router)
app.include_router(db_api.router)
app.include_router(hosts.router)
app.include_router(remote_users.router)
app.include_router(resources.router)
app.include_router(notifications.router)
app.include_router(security.router)
app.include_router(logs.router)
app.include_router(ai.router)
app.include_router(terminal.router)


def _no_store_html() -> dict[str, str]:
    """避免浏览器长期缓存入口 HTML，否则 F5 仍可能用旧的 script 路径。"""
    return {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}


@app.get("/ui", response_class=HTMLResponse, include_in_schema=False)
async def ui_page() -> FileResponse:
    if UI_MODE == "react" and FRONTEND_DIST.exists():
        index_html = FRONTEND_DIST / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html), headers=_no_store_html())
    return FileResponse("app/ui/index.html", headers=_no_store_html())


@app.get("/terminal", response_class=HTMLResponse, include_in_schema=False)
async def terminal_page() -> FileResponse:
    return FileResponse("app/ui/terminal.html")


@app.get("/ui-login", response_class=HTMLResponse, include_in_schema=False)
async def ui_login_page() -> FileResponse:
    if UI_MODE == "react" and FRONTEND_DIST.exists():
        index_html = FRONTEND_DIST / "index.html"
        if index_html.exists():
            return FileResponse(str(index_html), headers=_no_store_html())
    return FileResponse("app/ui/login.html", headers=_no_store_html())



