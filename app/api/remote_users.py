from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    RemoteUserCreate,
    RemoteUserGroupUpdate,
    RemoteUserGroupsOut,
    RemoteUserOut,
    RemoteUserPasswordUpdate,
    RemoteUserPrimaryGroupUpdate,
    RemoteUserSudoUpdate,
)
from app.core.deps import get_current_user
from app.db.models import Host, User
from app.db.session import get_db
from app.services.remote_users import (
    add_remote_user_group,
    create_remote_user,
    delete_remote_user,
    get_remote_user_groups,
    list_remote_users,
    remove_remote_user_group,
    set_remote_user_sudo,
    set_remote_user_password,
    set_remote_user_primary_group,
)

router = APIRouter(prefix="/api/remote-users", tags=["remote-users"])
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


@router.get("", response_model=list[RemoteUserOut])
async def list_users(
    host_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RemoteUserOut]:
    host = await _get_host(db, host_id, user)
    try:
        rows = await list_remote_users(host)
    except Exception as e:
        logger.exception("list remote users failed host_id=%s name=%s ip=%s", host_id, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "远程用户列表获取失败，请检查 SSH 连接与 /etc/passwd 读取权限"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return [RemoteUserOut(**r.__dict__) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: RemoteUserCreate,
    host_id: int = Query(..., ge=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await create_remote_user(host, body.username, password=body.password, make_sudo=body.make_sudo)
    except Exception as e:
        logger.exception("create remote user failed host_id=%s username=%s name=%s ip=%s", host_id, body.username, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "创建远程用户失败，请检查 SSH 权限与 useradd/chpasswd 是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    host = await _get_host(db, host_id, user)
    try:
        await delete_remote_user(host, username)
    except Exception as e:
        logger.exception("delete remote user failed host_id=%s username=%s name=%s ip=%s", host_id, username, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "删除远程用户失败，请检查 SSH 权限与 userdel 是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])


@router.post("/sudo")
async def update_sudo(
    body: RemoteUserSudoUpdate,
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await set_remote_user_sudo(host, username, make_sudo=body.make_sudo)
    except Exception as e:
        logger.exception("update sudo failed host_id=%s username=%s make=%s name=%s ip=%s", host_id, username, body.make_sudo, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "更新 sudo 权限失败，请检查 SSH 权限与 sudo 组配置"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}


@router.get("/groups", response_model=RemoteUserGroupsOut)
async def get_groups(
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32, pattern=r"^[a-z_][a-z0-9_-]{0,31}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RemoteUserGroupsOut:
    host = await _get_host(db, host_id, user)
    try:
        primary, supp = await get_remote_user_groups(host, username)
    except Exception as e:
        logger.exception("get groups failed host_id=%s username=%s name=%s ip=%s", host_id, username, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "获取用户组信息失败，请检查 SSH 权限与 id 命令是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return RemoteUserGroupsOut(username=username, primary_group=primary, supplementary_groups=supp)


@router.post("/password")
async def update_password(
    body: RemoteUserPasswordUpdate,
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32, pattern=r"^[a-z_][a-z0-9_-]{0,31}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await set_remote_user_password(host, username, body.password)
    except Exception as e:
        logger.exception("set password failed host_id=%s username=%s name=%s ip=%s", host_id, username, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "修改密码失败，请检查 SSH 权限与 chpasswd 是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}


@router.post("/groups/primary")
async def update_primary_group(
    body: RemoteUserPrimaryGroupUpdate,
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32, pattern=r"^[a-z_][a-z0-9_-]{0,31}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await set_remote_user_primary_group(host, username, body.group)
    except Exception as e:
        logger.exception("set primary group failed host_id=%s username=%s group=%s name=%s ip=%s", host_id, username, body.group, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "设置主组失败，请检查 SSH 权限与 groupadd/usermod 是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}


@router.post("/groups/supp/add")
async def add_supp_group(
    body: RemoteUserGroupUpdate,
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32, pattern=r"^[a-z_][a-z0-9_-]{0,31}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await add_remote_user_group(host, username, body.group)
    except Exception as e:
        logger.exception("add group failed host_id=%s username=%s group=%s name=%s ip=%s", host_id, username, body.group, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "添加附加组失败，请检查 SSH 权限与 groupadd/usermod 是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}


@router.post("/groups/supp/remove")
async def remove_supp_group(
    body: RemoteUserGroupUpdate,
    host_id: int = Query(..., ge=1),
    username: str = Query(..., min_length=1, max_length=32, pattern=r"^[a-z_][a-z0-9_-]{0,31}$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    host = await _get_host(db, host_id, user)
    try:
        await remove_remote_user_group(host, username, body.group)
    except Exception as e:
        logger.exception("remove group failed host_id=%s username=%s group=%s name=%s ip=%s", host_id, username, body.group, getattr(host, "name", "?"), getattr(host, "ip", "?"))
        raw = (str(e) or "").strip() or repr(e)
        msg = raw.strip() or "移除附加组失败，请检查 SSH 权限与 gpasswd 是否可用"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{type(e).__name__}: {msg}"[:300])
    return {"status": "ok"}

