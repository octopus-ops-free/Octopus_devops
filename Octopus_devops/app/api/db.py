from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import DbBackupInfo, HealthOut
from app.core.deps import require_admin
from app.db.models import User
from app.db.session import get_db
from app.services.db_admin import (
    backup_sqlite_named,
    list_backups,
    restore_sqlite_from_backup,
    rollback_to_latest_backup,
    sqlite_healthcheck,
)

router = APIRouter(prefix="/api/db", tags=["db"])


@router.get("/health", response_model=HealthOut)
async def health(db: AsyncSession = Depends(get_db)) -> HealthOut:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        return HealthOut(status="degraded", db="error", detail=str(e))
    ok, detail = sqlite_healthcheck()
    return HealthOut(status="ok" if ok else "degraded", db="ok" if ok else "error", detail=detail)


@router.post("/backup")
async def backup(
    name: str | None = Query(default=None, description="备份名，可为空，默认按时间生成"),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    dst = backup_sqlite_named(name)
    return {"status": "ok", "path": str(dst), "name": dst.name}


@router.post("/restore")
async def restore(
    name: str = Query(description="备份文件名，如 backup-20250101-120000.db"),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    try:
        dst = restore_sqlite_from_backup(name)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="备份文件不存在")
    return {"status": "ok", "path": str(dst), "name": name}


@router.post("/rollback")
async def rollback(
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    try:
        dst = rollback_to_latest_backup()
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="没有可用的备份")
    return {"status": "ok", "path": str(dst)}


@router.get("/backups", response_model=list[DbBackupInfo])
async def list_db_backups(
    _admin: User = Depends(require_admin),
) -> list[DbBackupInfo]:
    return [
        DbBackupInfo(
            name=item.name,
            path=item.path,
            size_bytes=item.size_bytes,
            mtime=item.mtime,
        )
        for item in list_backups(limit=100)
    ]

