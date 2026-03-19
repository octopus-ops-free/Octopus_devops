from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import LoginRecordOut
from app.core.deps import get_current_user
from app.db.models import Host, User
from app.db.session import get_db
from app.services.security import list_login_records


router = APIRouter(prefix="/api/security", tags=["security"])
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


@router.get("/logins", response_model=list[LoginRecordOut])
async def get_logins(
    host_id: int = Query(..., ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[LoginRecordOut]:
    host = await _get_host(db, host_id, user)
    try:
        rows = await list_login_records(host, limit=limit)
    except Exception as e:
        logger.exception("list logins failed host_id=%s name=%s ip=%s", host_id, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        msg = (str(e) or "").strip() or repr(e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return [LoginRecordOut(**r) for r in rows]

