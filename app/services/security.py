from __future__ import annotations

import re

from app.db.models import Host
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path


async def _run(host: Host, command: str):
    if host.ssh_key_path:
        return await ssh_run_with_key_path(host=host.ip, port=host.port, username=host.username, key_path=host.ssh_key_path, command=command, timeout_s=20)
    return await ssh_run(host=host.ip, port=host.port, username=host.username, private_key_text=host.ssh_private_key or "", command=command, timeout_s=20)


_IP_RE = re.compile(r"(\d{1,3}(?:\.\d{1,3}){3})")


async def list_login_records(host: Host, limit: int = 50) -> list[dict[str, str | None]]:
    """
    读取登录记录（MVP）：优先 `last -i`，失败则返回空列表并抛异常。
    输出为 list[{time,user,ip,line}]
    """
    cmd = "sh -lc 'last -i -n " + str(int(limit)) + " 2>/dev/null || last -n " + str(int(limit)) + " 2>/dev/null'"
    res = await _run(host, cmd)
    if res.code != 0:
        raise RuntimeError(res.stderr.strip() or "last command failed")
    out: list[dict[str, str | None]] = []
    for raw in res.stdout.splitlines():
        line = raw.strip()
        if not line or line.startswith("wtmp begins") or line.startswith("reboot") or line.startswith("shutdown"):
            continue
        # last 输出格式较多，这里 best-effort：取首列为 user，并尝试提取 IP
        parts = line.split()
        user = parts[0] if parts else "-"
        ip = None
        m = _IP_RE.search(line)
        if m:
            ip = m.group(1)
        # time：尽量截取包含月份的片段（粗略）
        time = " ".join(parts[3:8]) if len(parts) >= 8 else ""
        out.append({"time": time, "user": user, "ip": ip, "line": line})
    return out

