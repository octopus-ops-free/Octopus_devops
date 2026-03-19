from __future__ import annotations

import asyncio
import os
import subprocess
import tempfile
from dataclasses import dataclass


@dataclass
class SshResult:
    code: int
    stdout: str
    stderr: str


def _normalize_openssh_private_key(text: str) -> str:
    """
    尽量修复粘贴导致的格式问题：
    - 统一换行
    - 去除 BOM / 零宽字符
    - 对 OPENSSH PRIVATE KEY：抽取 base64 body，去掉所有空白后重新按 70 列换行
    """
    s = text.replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\ufeff", "").replace("\u200b", "").replace("\u200c", "").replace("\u200d", "")
    s = s.strip()

    begin = "-----BEGIN OPENSSH PRIVATE KEY-----"
    end = "-----END OPENSSH PRIVATE KEY-----"
    if begin in s and end in s:
        pre, _, rest = s.partition(begin)
        body_and_after = rest
        body, _, _after = body_and_after.partition(end)
        # body 可能包含换行/空格/制表符，全部去掉
        body_compact = "".join(ch for ch in body if not ch.isspace())
        # 重新分行
        width = 70
        wrapped = "\n".join(body_compact[i : i + width] for i in range(0, len(body_compact), width))
        return f"{begin}\n{wrapped}\n{end}\n"

    # 其他私钥（如 RSA）不强行重排，只做换行与不可见字符清理
    return s + "\n"


def _write_key_to_tempfile(key_text: str) -> str:
    # 写入临时文件，供系统 ssh 使用（MVP：不做加密存储）
    fd, path = tempfile.mkstemp(prefix="octopus_key_", suffix=".pem")
    os.close(fd)
    normalized = _normalize_openssh_private_key(key_text)
    with open(path, "wb") as f:
        f.write(normalized.encode("utf-8"))
    try:
        os.chmod(path, 0o600)
    except Exception:
        # Windows 上 chmod 可能无效，忽略
        pass
    return path


def _run_ssh_blocking(args: list[str], timeout_s: int) -> SshResult:
    try:
        cp = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout_s, check=False)
    except FileNotFoundError:
        return SshResult(code=127, stdout="", stderr="ssh command not found (please install OpenSSH client)")
    except subprocess.TimeoutExpired:
        return SshResult(code=124, stdout="", stderr="ssh timeout")
    return SshResult(
        code=int(cp.returncode or 0),
        stdout=(cp.stdout or b"").decode("utf-8", "ignore"),
        stderr=(cp.stderr or b"").decode("utf-8", "ignore"),
    )


async def ssh_run(*, host: str, port: int, username: str, private_key_text: str, command: str, timeout_s: int = 12) -> SshResult:
    key_path = _write_key_to_tempfile(private_key_text)
    try:
        # -o BatchMode=yes 避免交互
        # -o StrictHostKeyChecking=no 简化首次连接（MVP）
        known_hosts = "NUL" if os.name == "nt" else "/dev/null"
        args = [
            "ssh",
            "-i",
            key_path,
            "-p",
            str(port),
            "-o",
            "LogLevel=ERROR",
            "-o",
            "BatchMode=yes",
            "-o",
            "IdentitiesOnly=yes",
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            f"UserKnownHostsFile={known_hosts}",
            f"{username}@{host}",
            command,
        ]
        # Windows 某些事件循环策略不支持 asyncio 子进程（会抛 NotImplementedError），这里统一用线程执行阻塞 subprocess
        return await asyncio.to_thread(_run_ssh_blocking, args, timeout_s)
    finally:
        try:
            os.remove(key_path)
        except Exception:
            pass


async def ssh_run_with_key_path(*, host: str, port: int, username: str, key_path: str, command: str, timeout_s: int = 12) -> SshResult:
    """
    直接使用本机私钥文件路径（更适合 Windows，不依赖粘贴文本）。
    """
    known_hosts = "NUL" if os.name == "nt" else "/dev/null"
    args = [
        "ssh",
        "-i",
        key_path,
        "-p",
        str(port),
        "-o",
        "LogLevel=ERROR",
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        f"UserKnownHostsFile={known_hosts}",
        f"{username}@{host}",
        command,
    ]
    return await asyncio.to_thread(_run_ssh_blocking, args, timeout_s)

