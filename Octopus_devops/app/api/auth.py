from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import LoginRequest, RefreshRequest, TokenResponse
from app.core.deps import get_current_user, oauth2_scheme
from app.db.models import TokenDenylist, User
from app.db.session import get_db
from app.security.jwt import create_token_pair, decode_token
from app.security.password import verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    OAuth2 Password Flow: Swagger 的 Authorize 会 POST 表单到此接口获取 token。
    """
    user = await db.scalar(select(User).where(User.username == form.username))
    if user is None or not user.is_active or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    pair, _meta = create_token_pair(user.username)
    return TokenResponse(access_token=pair.access_token, refresh_token=pair.refresh_token, token_type=pair.token_type)


@router.post("/login-json", response_model=TokenResponse, include_in_schema=False)
async def login_json(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    兼容 JSON 登录（给脚本/旧客户端用），不在 Swagger 展示。
    """
    user = await db.scalar(select(User).where(User.username == body.username))
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    pair, _meta = create_token_pair(user.username)
    return TokenResponse(access_token=pair.access_token, refresh_token=pair.refresh_token, token_type=pair.token_type)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效或过期的 refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 类型错误")

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token 缺少 jti")

    denied = await db.scalar(select(TokenDenylist).where(TokenDenylist.jti == jti))
    if denied is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="refresh token 已注销")

    username = payload.get("sub")
    user = await db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")

    pair, _meta = create_token_pair(user.username)
    return TokenResponse(access_token=pair.access_token, refresh_token=pair.refresh_token, token_type=pair.token_type)


@router.post("/logout")
async def logout(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
    _user: User = Depends(get_current_user),
) -> dict[str, str]:
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效 token")

    jti = payload.get("jti")
    exp = payload.get("exp")
    ttype = payload.get("type")
    if not jti or not exp or not ttype:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="token 字段缺失")

    expires_at = dt.datetime.fromtimestamp(int(exp), tz=dt.timezone.utc)
    row = TokenDenylist(jti=jti, token_type=str(ttype), expires_at=expires_at)
    db.add(row)
    await db.commit()
    return {"status": "ok"}

