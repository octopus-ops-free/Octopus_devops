from __future__ import annotations

from dataclasses import dataclass

from app.db.models import Host
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path


@dataclass
class RemoteUser:
    username: str
    uid: int
    gid: int
    home: str
    shell: str


async def _run(host: Host, command: str):
    if host.ssh_key_path:
        return await ssh_run_with_key_path(host=host.ip, port=host.port, username=host.username, key_path=host.ssh_key_path, command=command, timeout_s=20)
    return await ssh_run(host=host.ip, port=host.port, username=host.username, private_key_text=host.ssh_private_key or "", command=command, timeout_s=20)


async def list_remote_users(host: Host) -> list[RemoteUser]:
    # 读取 /etc/passwd（只取 username/uid/gid/home/shell）
    # 避免复杂引号嵌套，使用 while/read + printf 输出 TAB 分隔
    cmd = (
        "sh -lc '"
        "while IFS=: read -r u _ uid gid _ home shell; do "
        "printf \"%s\\t%s\\t%s\\t%s\\t%s\\n\" \"$u\" \"$uid\" \"$gid\" \"$home\" \"$shell\"; "
        "done < /etc/passwd"
        "'"
    )
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh list users failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)
    users: list[RemoteUser] = []
    for line in res.stdout.splitlines():
        parts = line.strip().split("\t")
        if len(parts) != 5:
            continue
        users.append(RemoteUser(username=parts[0], uid=int(parts[1]), gid=int(parts[2]), home=parts[3], shell=parts[4]))
    return users


async def create_remote_user(host: Host, username: str, password: str, make_sudo: bool = False) -> None:
    # 需要 root 或免密 sudo
    sudo = "sudo -n " if host.username != "root" else ""
    cmd = (
        r"sh -lc "
        + "\""
        + f"{sudo}id -u {username} >/dev/null 2>&1 && echo exists || true; "
        + f"{sudo}useradd -m -s /bin/bash {username}; "
        + f"printf '%s' '{username}:{password}' | {sudo}chpasswd; "
        + (f"{sudo}usermod -aG sudo {username}; " if make_sudo else "")
        + "\""
    )
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh create user failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def delete_remote_user(host: Host, username: str) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    cmd = r"sh -lc " + "\"" + f"{sudo}userdel -r {username}" + "\""
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh delete user failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def set_remote_user_sudo(host: Host, username: str, make_sudo: bool) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    if make_sudo:
        cmd = r"sh -lc " + "\"" + f"{sudo}usermod -aG sudo {username}" + "\""
    else:
        cmd = r"sh -lc " + "\"" + f"{sudo}gpasswd -d {username} sudo || true" + "\""
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh update sudo failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def get_remote_user_groups(host: Host, username: str) -> tuple[str, list[str]]:
    sudo = "sudo -n " if host.username != "root" else ""
    # primary group: id -gn; supplementary: id -Gn
    cmd = r"sh -lc " + "\"" + f"{sudo}id -gn {username} && {sudo}id -Gn {username}" + "\""
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh get groups failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)
    lines = [x.strip() for x in res.stdout.splitlines() if x.strip()]
    if len(lines) < 2:
        raise RuntimeError("get user groups failed: unexpected output")
    primary = lines[0]
    supplementary = [g for g in lines[1].split() if g]
    return primary, supplementary


async def set_remote_user_password(host: Host, username: str, password: str) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    cmd = r"sh -lc " + "\"" + f"printf '%s' '{username}:{password}' | {sudo}chpasswd" + "\""
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh set password failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def set_remote_user_primary_group(host: Host, username: str, group: str) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    # 若组不存在则创建（MVP 友好）
    cmd = (
        r"sh -lc "
        + "\""
        + f"{sudo}getent group {group} >/dev/null 2>&1 || {sudo}groupadd {group}; "
        + f"{sudo}usermod -g {group} {username}"
        + "\""
    )
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh set primary group failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def add_remote_user_group(host: Host, username: str, group: str) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    cmd = (
        r"sh -lc "
        + "\""
        + f"{sudo}getent group {group} >/dev/null 2>&1 || {sudo}groupadd {group}; "
        + f"{sudo}usermod -aG {group} {username}"
        + "\""
    )
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh add group failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def remove_remote_user_group(host: Host, username: str, group: str) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    cmd = r"sh -lc " + "\"" + f"{sudo}gpasswd -d {username} {group}" + "\""
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh remove group failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)

