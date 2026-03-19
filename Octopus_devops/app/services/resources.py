from __future__ import annotations

from dataclasses import dataclass

from app.db.models import Host
from app.services.ssh_exec import ssh_run, ssh_run_with_key_path


@dataclass
class RemoteProcess:
    pid: int
    user: str
    cpu: float
    mem: float
    time: str
    cmd: str


@dataclass
class RemotePort:
    proto: str
    recv_q: str
    send_q: str
    local: str
    foreign: str
    state: str
    pid_program: str | None


async def _run(host: Host, command: str):
    if host.ssh_key_path:
        return await ssh_run_with_key_path(
            host=host.ip,
            port=host.port,
            username=host.username,
            key_path=host.ssh_key_path,
            command=command,
            timeout_s=20,
        )
    return await ssh_run(
        host=host.ip,
        port=host.port,
        username=host.username,
        private_key_text=host.ssh_private_key or "",
        command=command,
        timeout_s=20,
    )


async def list_remote_processes(host: Host) -> list[RemoteProcess]:
    """
    使用 ps 输出：PID USER %CPU %MEM TIME COMMAND，按 CPU 排序取前 80 条。
    """
    cmd = "sh -lc 'ps -eo pid,user,pcpu,pmem,etime,comm --sort=-pcpu --no-headers | head -n 80'"
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh processes failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)
    items: list[RemoteProcess] = []
    for line in res.stdout.splitlines():
        s = " ".join(line.strip().split())
        if not s:
            continue
        parts = s.split(" ", 5)
        if len(parts) < 6:
            continue
        try:
            items.append(RemoteProcess(pid=int(parts[0]), user=parts[1], cpu=float(parts[2]), mem=float(parts[3]), time=parts[4], cmd=parts[5]))
        except ValueError:
            continue
    return items


async def kill_remote_process(host: Host, pid: int, force: bool = False) -> None:
    sudo = "sudo -n " if host.username != "root" else ""
    sig = "-9" if force else ""
    cmd = "sh -lc " + "\"" + f"{sudo}kill {sig} {pid}" + "\""
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh kill failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)


async def list_remote_ports(host: Host) -> list[RemotePort]:
    """
    输出对齐 netstat -ntpl：
    Proto Recv-Q Send-Q Local Address Foreign Address State PID/Program name
    优先 netstat -ntpl；没有则降级 ss -ntpl（尽量转换成同字段）。
    """
    cmd = (
        "sh -lc '"
        "if command -v netstat >/dev/null 2>&1; then "
        "  netstat -ntpl 2>/dev/null | tail -n +3; "
        "elif command -v ss >/dev/null 2>&1; then "
        "  ss -ntplH; "
        "else "
        "  echo \"no ss/netstat\" >&2; exit 1; "
        "fi"
        "'"
    )
    res = await _run(host, cmd)
    if res.code != 0:
        err = res.stderr.strip()
        if not err:
            err = f"ssh ports failed (code={res.code}): {res.stdout.strip()[:200]}"
        raise RuntimeError(err)
    items: list[RemotePort] = []
    for raw in res.stdout.splitlines():
        line = " ".join(raw.strip().split())
        if not line:
            continue
        parts = line.split()
        proto = parts[0] if parts else ""
        # netstat -ntpl: proto recv-q send-q local foreign state pid/program
        if len(parts) >= 7 and "/" in parts[-1]:
            recv_q = parts[1]
            send_q = parts[2]
            local = parts[3]
            foreign = parts[4]
            state = parts[5]
            pid_program = parts[6]
            items.append(RemotePort(proto=proto, recv_q=recv_q, send_q=send_q, local=local, foreign=foreign, state=state, pid_program=pid_program))
            continue
        # ss -ntplH: State Recv-Q Send-Q Local:Port Peer:Port users:(("proc",pid=,fd=))
        if len(parts) >= 5:
            state = parts[0]
            recv_q = parts[1]
            send_q = parts[2]
            local = parts[3]
            foreign = parts[4]
            pid_program = None
            if "users:(" in line:
                # 尽量提取 "proc",pid=123
                prog = None
                pid = None
                if "((" in line and "\"" in line:
                    try:
                        prog = line.split("\"", 2)[1]
                    except Exception:
                        prog = None
                if "pid=" in line:
                    try:
                        after = line.split("pid=", 1)[1]
                        pid_str = "".join(ch for ch in after if ch.isdigit())
                        pid = pid_str or None
                    except Exception:
                        pid = None
                if pid and prog:
                    pid_program = f"{pid}/{prog}"
                elif pid:
                    pid_program = pid
            items.append(RemotePort(proto="tcp", recv_q=recv_q, send_q=send_q, local=local, foreign=foreign, state=state, pid_program=pid_program))
            continue
    return items

