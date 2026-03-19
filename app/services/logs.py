from __future__ import annotations

import os

from app.db.models import Host
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path


async def _run(host: Host, command: str):
    if host.ssh_key_path:
        return await ssh_run_with_key_path(host=host.ip, port=host.port, username=host.username, key_path=host.ssh_key_path, command=command, timeout_s=25)
    return await ssh_run(host=host.ip, port=host.port, username=host.username, private_key_text=host.ssh_private_key or "", command=command, timeout_s=25)


def _safe_rel_file(name: str) -> str:
    # 仅允许 basename，避免路径穿越
    return os.path.basename(name)


async def list_log_files(host: Host, dir_path: str, limit: int = 200) -> list[str]:
    cmd = (
        "sh -lc '"
        "test -d " + _sh_quote(dir_path) + " || { echo \"dir not found\" >&2; exit 2; }; "
        "ls -1t " + _sh_quote(dir_path) + " 2>/dev/null | head -n " + str(int(limit)) +
        "'"
    )
    res = await _run(host, cmd)
    if res.code != 0:
        raise RuntimeError(res.stderr.strip() or res.stdout.strip() or "list log files failed")
    return [x.strip() for x in res.stdout.splitlines() if x.strip()]


async def tail_log_file(host: Host, dir_path: str, filename: str, lines: int = 500) -> str:
    fn = _safe_rel_file(filename)
    full = dir_path.rstrip("/") + "/" + fn
    cmd = (
        "sh -lc '"
        "test -f " + _sh_quote(full) + " || { echo \"file not found\" >&2; exit 2; }; "
        "tail -n " + str(int(lines)) + " " + _sh_quote(full) + " 2>/dev/null"
        "'"
    )
    res = await _run(host, cmd)
    if res.code != 0:
        raise RuntimeError(res.stderr.strip() or res.stdout.strip() or "tail log failed")
    return res.stdout


def _sh_quote(s: str) -> str:
    return "'" + s.replace("'", "'\"'\"'") + "'"

