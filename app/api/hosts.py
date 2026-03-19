from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import HostCreate, HostOut, HostUpdate
from app.core.deps import get_current_user, require_admin
from app.db.models import Host, User
from app.db.session import get_db
from app.services.hosts import probe_host_info
from app.services.monitoring import save_remote_linux_metrics

router = APIRouter(prefix="/api/hosts", tags=["hosts"])


@router.get("", response_model=list[HostOut])
async def get_hosts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[HostOut]:
    """
    管理员看到所有主机；普通用户只看到自己添加的主机。
    """
    stmt = select(Host).order_by(Host.id)
    if not user.is_admin:
        stmt = stmt.where(Host.owner_id == user.id)
    res = await db.scalars(stmt)
    return [HostOut.model_validate(h, from_attributes=True) for h in list(res)]


@router.post("", response_model=HostOut, status_code=status.HTTP_201_CREATED)
async def add_host(
    body: HostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostOut:
    existing = await db.scalar(select(Host).where(Host.name == body.name))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="主机名已存在")

    if not body.ssh_key_path and not body.ssh_private_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="必须提供 ssh_key_path 或 ssh_private_key")

    host = Host(
        name=body.name,
        ip=body.ip,
        port=body.port,
        username=body.username,
        cloud_provider=body.cloud_provider,
        ssh_key_path=body.ssh_key_path,
        # 兼容旧 SQLite 表结构：ssh_private_key 可能是 NOT NULL
        ssh_private_key=body.ssh_private_key if body.ssh_private_key is not None else "",
        enabled=True,
        owner_id=user.id,
    )
    db.add(host)
    await db.commit()
    await db.refresh(host)

    # 立即校验：探测 + 采集一次，失败则回滚删除，避免“页面显示添加成功但实际不可用”
    host = await probe_host_info(db, host)
    try:
        await save_remote_linux_metrics(db, host)
    except Exception as e:
        await db.delete(host)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"主机添加失败（SSH 校验/采集失败）：{str(e)[:300]}")

    return HostOut.model_validate(host, from_attributes=True)


@router.delete("/{host_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_host(
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    host = await db.get(Host, host_id)
    if host is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主机不存在")
    if (not user.is_admin) and (host.owner_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该主机")
    await db.delete(host)
    await db.commit()


@router.post("/{host_id}/toggle")
async def toggle_host(
    host_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    host = await db.get(Host, host_id)
    if host is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主机不存在")
    if (not user.is_admin) and (host.owner_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作该主机")
    host.enabled = not host.enabled
    await db.commit()
    await db.refresh(host)
    return {"enabled": host.enabled}


@router.put("/{host_id}", response_model=HostOut)
async def update_host(
    host_id: int,
    body: HostUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HostOut:
    host = await db.get(Host, host_id)
    if host is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主机不存在")
    if (not user.is_admin) and (host.owner_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权操作该主机")

    if body.name is not None and body.name != host.name:
        existing = await db.scalar(select(Host).where(Host.name == body.name))
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="主机名已存在")
        host.name = body.name
    if body.ip is not None:
        host.ip = body.ip
    if body.port is not None:
        host.port = body.port
    if body.username is not None:
        host.username = body.username
    if body.cloud_provider is not None:
        host.cloud_provider = body.cloud_provider
    if body.ssh_key_path is not None:
        host.ssh_key_path = body.ssh_key_path
    if body.ssh_private_key is not None:
        host.ssh_private_key = body.ssh_private_key
    # 兼容旧 SQLite 表结构：若选择 key_path 且未提供私钥文本，确保非空
    if host.ssh_key_path and (host.ssh_private_key is None):
        host.ssh_private_key = ""
    if body.enabled is not None:
        host.enabled = body.enabled

    await db.commit()
    await db.refresh(host)

    # 若更新了连接相关信息，做一次探测+采集校验；失败则提示（保留修改，便于继续调整）
    if body.ip or body.port or body.username or body.ssh_private_key:
        host = await probe_host_info(db, host)
        try:
            await save_remote_linux_metrics(db, host)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"已保存，但 SSH 校验/采集失败：{str(e)[:300]}")

    return HostOut.model_validate(host, from_attributes=True)

