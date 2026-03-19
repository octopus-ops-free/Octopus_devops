from __future__ import annotations

import logging
from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OperationLog, User

logger = logging.getLogger(__name__)


async def write_operation_log(
    *,
    db: AsyncSession,
    request: Request,
    status_code: int,
    user: Optional[User],
    detail: Optional[str] = None,
) -> None:
    try:
        row = OperationLog(
            user_id=user.id if user else None,
            username=user.username if user else None,
            method=request.method,
            path=str(request.url.path),
            status_code=int(status_code),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            detail=detail,
        )
        db.add(row)
        await db.commit()
    except Exception:
        logger.exception("write_operation_log failed")

