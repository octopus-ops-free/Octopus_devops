from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Host
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path

logger = logging.getLogger(__name__)


async def probe_host_info(db: AsyncSession, host: Host) -> Host:
    """
    通过 ssh 获取基本信息。假设远端为 Linux（常见运维场景）。
    若失败，只记录日志，不抛出致命异常。
    """
    cmd = r"echo '__HOST__'; hostname; echo '__OS__'; (uname -a || true)"
    if host.ssh_key_path:
        res = await ssh_run_with_key_path(host=host.ip, port=host.port, username=host.username, key_path=host.ssh_key_path, command=cmd, timeout_s=12)
    else:
        res = await ssh_run(
            host=host.ip,
            port=host.port,
            username=host.username,
            private_key_text=host.ssh_private_key or "",
            command=cmd,
            timeout_s=12,
        )
    if res.code != 0:
        logger.warning("probe_host_info failed name=%s ip=%s code=%s err=%s", host.name, host.ip, res.code, res.stderr.strip())
        return host

    lines = [x.strip() for x in res.stdout.splitlines() if x.strip()]
    try:
        i_host = lines.index("__HOST__")
        i_os = lines.index("__OS__")
        hostname = lines[i_host + 1] if i_host + 1 < len(lines) else None
        os_info = " ".join(lines[i_os + 1 :]) if i_os + 1 < len(lines) else None
        host.hostname = hostname
        host.os_info = os_info[:255] if os_info else None
        await db.commit()
        await db.refresh(host)
    except Exception:
        logger.exception("probe_host_info parse failed")
    return host


async def list_hosts(db: AsyncSession) -> list[Host]:
    res = await db.scalars(select(Host).order_by(Host.id))
    return list(res)

