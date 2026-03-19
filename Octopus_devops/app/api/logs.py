from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import LogSourceCreate, LogSourceOut
from app.core.deps import get_current_user
from app.db.models import Host, LogSource, User
from app.db.session import get_db
from app.services.logs import list_log_files, tail_log_file


router = APIRouter(prefix="/api/logs", tags=["logs"])
logger = logging.getLogger(__name__)


async def _get_host(db: AsyncSession, host_id: int, user: User) -> Host:
    host = await db.get(Host, host_id)
    if host is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主机不存在")
    if not host.enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="主机已停用")
    if (not user.is_admin) and (host.owner_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该主机")
    return host


@router.get("/sources", response_model=list[LogSourceOut])
async def list_sources(
    host_id: int | None = Query(default=None, ge=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LogSourceOut]:
    q = select(LogSource)
    if host_id:
        # 校验该 host 是否属于当前用户
        await _get_host(db, host_id, user)
        q = q.where(LogSource.host_id == host_id)
    elif not user.is_admin:
        # 非管理员：只看到自己主机下的日志源
        host_ids = await db.scalars(select(Host.id).where(Host.owner_id == user.id))
        ids = list(host_ids)
        if not ids:
            return []
        q = q.where(LogSource.host_id.in_(ids))
    q = q.order_by(desc(LogSource.created_at))
    rows = await db.scalars(q)
    return [LogSourceOut.model_validate(r, from_attributes=True) for r in list(rows)]


@router.post("/sources", response_model=LogSourceOut, status_code=status.HTTP_201_CREATED)
async def create_source(
    body: LogSourceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LogSourceOut:
    await _get_host(db, body.host_id, user)
    row = LogSource(host_id=body.host_id, dir_path=body.dir_path, remark=body.remark, enabled=True)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return LogSourceOut.model_validate(row, from_attributes=True)


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    row = await db.get(LogSource, source_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="日志源不存在")
    # 校验所属主机是否属于当前用户
    await _get_host(db, row.host_id, user)
    await db.delete(row)
    await db.commit()


@router.get("/files", response_model=list[str])
async def get_files(
    source_id: int = Query(..., ge=1),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[str]:
    src = await db.get(LogSource, source_id)
    if src is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="日志源不存在")
    host = await _get_host(db, src.host_id, user)
    try:
        return await list_log_files(host, src.dir_path, limit=limit)
    except Exception as e:
        logger.exception("list log files failed source_id=%s", source_id)
        msg = (str(e) or "").strip() or repr(e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])


@router.get("/tail", response_model=str)
async def tail_file(
    source_id: int = Query(..., ge=1),
    file: str = Query(..., min_length=1, max_length=255),
    lines: int = Query(200, ge=10, le=2000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> str:
    src = await db.get(LogSource, source_id)
    if src is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="日志源不存在")
    host = await _get_host(db, src.host_id, user)
    try:
        return await tail_log_file(host, src.dir_path, file, lines=lines)
    except Exception as e:
        logger.exception("tail log failed source_id=%s file=%s", source_id, file)
        msg = (str(e) or "").strip() or repr(e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])

