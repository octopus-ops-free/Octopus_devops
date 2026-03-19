from __future__ import annotations

import logging
import os

import psutil
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Host, HostMetric
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path

logger = logging.getLogger(__name__)


def _disk_percent() -> float:
    """
    跨平台获取根分区磁盘使用率：
    - Linux: '/'
    - Windows: 当前盘符根路径（例如 'C:\\'）
    """
    root = os.path.abspath(os.sep)
    usage = psutil.disk_usage(root)
    return float(usage.percent)


def collect_local_metrics() -> dict[str, float]:
    cpu = float(psutil.cpu_percent(interval=0.2))
    mem = float(psutil.virtual_memory().percent)
    disk = _disk_percent()
    return {"cpu_percent": cpu, "mem_percent": mem, "disk_percent": disk}


async def save_local_metrics(db: AsyncSession, host: str = "local") -> HostMetric:
    m = collect_local_metrics()
    row = HostMetric(host=host, **m)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    logger.info("metrics collected host=%s cpu=%.1f mem=%.1f disk=%.1f", host, row.cpu_percent, row.mem_percent, row.disk_percent)
    return row


async def list_metrics(db: AsyncSession, host: str = "local", limit: int = 100) -> list[HostMetric]:
    q = select(HostMetric).where(HostMetric.host == host).order_by(desc(HostMetric.created_at)).limit(limit)
    res = await db.scalars(q)
    return list(res)


def _parse_remote_metrics(output: str) -> dict[str, float] | None:
    # 期望三行：CPU=xx.xx / MEM=xx.xx / DISK=xx.xx
    m: dict[str, float] = {}
    for line in output.splitlines():
        s = line.strip()
        if s.startswith("CPU="):
            m["cpu_percent"] = float(s.split("=", 1)[1])
        elif s.startswith("MEM="):
            m["mem_percent"] = float(s.split("=", 1)[1])
        elif s.startswith("DISK="):
            m["disk_percent"] = float(s.split("=", 1)[1])
    if {"cpu_percent", "mem_percent", "disk_percent"} <= set(m.keys()):
        return m
    return None


async def collect_linux_metrics_over_ssh(host: Host) -> dict[str, float]:
    """
    远程 Linux 主机采集 CPU/内存/磁盘（/）使用率。使用系统 ssh，无需额外依赖。
    """
    cmd = r"""
sh -lc '
cpu1=$(awk "NR==1{print \$2+\$4,\$2+\$4+\$5}" /proc/stat); sleep 0.2; cpu2=$(awk "NR==1{print \$2+\$4,\$2+\$4+\$5}" /proc/stat);
u1=$(echo $cpu1 | awk "{print \$1}"); t1=$(echo $cpu1 | awk "{print \$2}");
u2=$(echo $cpu2 | awk "{print \$1}"); t2=$(echo $cpu2 | awk "{print \$2}");
cpu=$(awk -v u1=$u1 -v u2=$u2 -v t1=$t1 -v t2=$t2 "BEGIN{du=u2-u1; dt=t2-t1; if(dt<=0) print 0; else printf \"%.2f\", (du/dt)*100 }");
mem=$(awk "/MemTotal/ {t=\$2} /MemAvailable/ {a=\$2} END{ if(t<=0) print 0; else printf \"%.2f\", (t-a)/t*100 }" /proc/meminfo);
disk=$(df -P / | awk "NR==2{gsub(/%/,\"\",\$5); print \$5}");
echo CPU=$cpu; echo MEM=$mem; echo DISK=$disk;
'
"""
    if host.ssh_key_path:
        res = await ssh_run_with_key_path(host=host.ip, port=host.port, username=host.username, key_path=host.ssh_key_path, command=cmd, timeout_s=15)
    else:
        res = await ssh_run(
            host=host.ip,
            port=host.port,
            username=host.username,
            private_key_text=host.ssh_private_key or "",
            command=cmd,
            timeout_s=15,
        )
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = res.stdout.strip()
        raise RuntimeError(f"ssh metrics failed (code={res.code}): {err[:300]}")
    parsed = _parse_remote_metrics(res.stdout)
    if parsed is None:
        raise RuntimeError("ssh metrics output parse failed")
    return parsed


async def save_remote_linux_metrics(db: AsyncSession, host: Host) -> HostMetric:
    m = await collect_linux_metrics_over_ssh(host)
    row = HostMetric(host=host.name, **m)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    logger.info("metrics collected host=%s cpu=%.1f mem=%.1f disk=%.1f", host.name, row.cpu_percent, row.mem_percent, row.disk_percent)
    return row

