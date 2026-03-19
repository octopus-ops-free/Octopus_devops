from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import UserCreate, UserOut
from app.core.deps import get_current_user, require_admin
from app.db.models import User
from app.db.session import get_db
from app.security.password import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)


@router.get("", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), _admin: User = Depends(require_admin)) -> list[UserOut]:
    res = await db.scalars(select(User).order_by(User.id))
    return [UserOut.model_validate(u, from_attributes=True) for u in list(res)]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserOut:
    existing = await db.scalar(select(User).where(User.username == body.username))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

    u = User(username=body.username, password_hash=hash_password(body.password), is_admin=body.is_admin, is_active=True)
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return UserOut.model_validate(u, from_attributes=True)

