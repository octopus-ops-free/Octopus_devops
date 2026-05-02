from __future__ import annotations

import datetime as dt
import re
from typing import Any, Literal

from app.db.models import Host
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path

Window = Literal["24h", "7d", "30d"]

# journalctl / syslog 中常见 CRON 行（尽量宽松，避免误判其他服务）
_CMDEND_EXIT = re.compile(r"CMDEND.*exit status\s+(\d+)", re.IGNORECASE)
_SKIP = re.compile(r"skipping|skipped|SKIP", re.IGNORECASE)


def window_delta(window: Window) -> dt.timedelta:
    if window == "24h":
        return dt.timedelta(hours=24)
    if window == "7d":
        return dt.timedelta(days=7)
    return dt.timedelta(days=30)


def count_crontab_lines(stdout: str) -> int:
    n = 0
    for line in stdout.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        n += 1
    return n


def parse_cron_journal_text(text: str) -> dict[str, int]:
    """
    从 journalctl / syslog 片段中粗粒度统计。
    - success: CMDEND 且 exit status 0
    - failure: CMDEND 且 exit status != 0
    - skipped: 行命中 skip 关键词
    - running: 本实现无法从静态日志可靠得到，恒为 0
    """
    success = failure = skipped = 0
    for line in text.splitlines():
        if _SKIP.search(line):
            skipped += 1
            continue
        m = _CMDEND_EXIT.search(line)
        if m:
            code = int(m.group(1))
            if code == 0:
                success += 1
            else:
                failure += 1
    return {"success": success, "failure": failure, "running": 0, "skipped": skipped}


def _since_until_iso(now: dt.datetime, window: Window) -> tuple[str, str]:
    now = now.astimezone(dt.timezone.utc)
    start = now - window_delta(window)
    fmt = "%Y-%m-%d %H:%M:%S"
    return start.strftime(fmt) + " UTC", now.strftime(fmt) + " UTC"


async def fetch_cron_summary_for_host(host: Host, window: Window, *, now: dt.datetime | None = None) -> dict[str, Any]:
    """
    SSH 到目标主机：读取用户 crontab 行数 + 尝试读取 cron 相关日志。
    日志解析失败时 degraded=True，仍返回 configured_lines。
    """
    now = now or dt.datetime.now(dt.timezone.utc)
    since_s, until_s = _since_until_iso(now, window)

    crontab_cmd = r"sh -lc '(crontab -l || true) 2>/dev/null'"
    log_cmd = (
        "sh -lc '"
        f'journalctl --no-pager -u cron.service --since "{since_s}" --until "{until_s}" 2>/dev/null '
        f'|| journalctl --no-pager -u crond.service --since "{since_s}" --until "{until_s}" 2>/dev/null '
        "|| (test -r /var/log/syslog && grep CRON /var/log/syslog 2>/dev/null | tail -n 3000) "
        "|| (test -r /var/log/cron && tail -n 3000 /var/log/cron 2>/dev/null) "
        "|| true'"
    )

    detail_parts: list[str] = []
    degraded = False

    if host.ssh_key_path:
        cr = await ssh_run_with_key_path(
            host=host.ip,
            port=host.port,
            username=host.username,
            key_path=host.ssh_key_path,
            command=crontab_cmd,
            timeout_s=15,
        )
    else:
        cr = await ssh_run(
            host=host.ip,
            port=host.port,
            username=host.username,
            private_key_text=host.ssh_private_key or "",
            command=crontab_cmd,
            timeout_s=15,
        )

    if cr.code != 0:
        degraded = True
        detail_parts.append(f"crontab_remote_code={cr.code}")

    configured = count_crontab_lines(cr.stdout)

    if host.ssh_key_path:
        lr = await ssh_run_with_key_path(
            host=host.ip,
            port=host.port,
            username=host.username,
            key_path=host.ssh_key_path,
            command=log_cmd,
            timeout_s=25,
        )
    else:
        lr = await ssh_run(
            host=host.ip,
            port=host.port,
            username=host.username,
            private_key_text=host.ssh_private_key or "",
            command=log_cmd,
            timeout_s=25,
        )

    if lr.code != 0 or not (lr.stdout or "").strip():
        degraded = True
        detail_parts.append("cron_log_unavailable_or_empty")
        counts = {"success": 0, "failure": 0, "running": 0, "skipped": 0}
    else:
        counts = parse_cron_journal_text(lr.stdout)

    detail = ";".join(detail_parts) if detail_parts else None
    return {
        "configured_lines": configured,
        "success": counts["success"],
        "failure": counts["failure"],
        "running": counts["running"],
        "skipped": counts["skipped"],
        "degraded": degraded,
        "detail": detail,
    }
