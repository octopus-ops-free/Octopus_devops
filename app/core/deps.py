from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TokenDenylist, User
from app.db.session import get_db
from app.security.jwt import decode_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效或过期的 token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 类型错误")

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 缺少 jti")

    denied = await db.scalar(select(TokenDenylist).where(TokenDenylist.jti == jti))
    if denied is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 已注销")

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 缺少 sub")

    user = await db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user

