from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import RemotePortOut, RemoteProcessOut
from app.core.deps import get_current_user
from app.db.models import Host, User
from app.db.session import get_db
from app.services.resources import kill_remote_process, list_remote_ports, list_remote_processes


router = APIRouter(prefix="/api/resources", tags=["resources"])
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


@router.get("/processes", response_model=list[RemoteProcessOut])
async def get_processes(
    host_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RemoteProcessOut]:
    host = await _get_host(db, host_id, user)
    try:
        rows = await list_remote_processes(host)
    except Exception as e:
        logger.exception("list processes failed host_id=%s name=%s ip=%s", host_id, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "远程进程列表获取失败，请检查 SSH 连接与远端 ps 命令是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return [RemoteProcessOut(**r.__dict__) for r in rows]


@router.post("/processes/kill")
async def kill_process(
    host_id: int = Query(..., ge=1),
    pid: int = Query(..., ge=1),
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await kill_remote_process(host, pid, force=force)
    except Exception as e:
        logger.exception("kill process failed host_id=%s pid=%s force=%s name=%s ip=%s", host_id, pid, force, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "终止远程进程失败，请检查 SSH 权限与进程状态"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}


@router.get("/ports", response_model=list[RemotePortOut])
async def get_ports(
    host_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RemotePortOut]:
    host = await _get_host(db, host_id, user)
    try:
        rows = await list_remote_ports(host)
    except Exception as e:
        logger.exception("list ports failed host_id=%s name=%s ip=%s", host_id, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "远程端口列表获取失败，请检查 SSH 连接与 ss/netstat 命令是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return [RemotePortOut(**r.__dict__) for r in rows]

