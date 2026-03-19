from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import User
from app.security.password import hash_password

logger = logging.getLogger(__name__)


async def ensure_bootstrap_admin(db: AsyncSession) -> None:
    any_user = await db.scalar(select(User.id).limit(1))
    if any_user is not None:
        return

    admin = User(
        username=settings.bootstrap_admin_username,
        password_hash=hash_password(settings.bootstrap_admin_password),
        is_admin=True,
        is_active=True,
    )
    db.add(admin)
    await db.commit()
    logger.warning("Bootstrap admin created: username=%s", admin.username)

