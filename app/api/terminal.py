from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import threading
from dataclasses import dataclass
from typing import Optional

import paramiko
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.db.models import Host, TokenDenylist, User
from app.db.session import SessionLocal
from app.security.jwt import decode_token

router = APIRouter(prefix="/api/terminal", tags=["terminal"])
logger = logging.getLogger(__name__)


@dataclass
class TerminalAuth:
    host: str
    port: int
    username: str
    password: Optional[str] = None
    private_key: Optional[str] = None
    key_path: Optional[str] = None
    passphrase: Optional[str] = None


class SshTerminalSession:
    def __init__(self, websocket: WebSocket, auth: TerminalAuth):
        self.websocket = websocket
        self.auth = auth
        self.client: Optional[paramiko.SSHClient] = None
        self.channel: Optional[paramiko.Channel] = None
        self._closed = threading.Event()
        self._resize: Optional[tuple[int, int]] = None

    def connect(self) -> None:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        pkey = None
        if self.auth.private_key:
            key_text = self.auth.private_key.strip()
            key_stream = io.StringIO(key_text)
            last_err: Exception | None = None
            for loader in (
                paramiko.RSAKey.from_private_key,
                paramiko.ECDSAKey.from_private_key,
                paramiko.Ed25519Key.from_private_key,
                paramiko.DSSKey.from_private_key,
            ):
                try:
                    key_stream.seek(0)
                    pkey = loader(key_stream, password=self.auth.passphrase)
                    break
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
            if pkey is None and last_err is not None:
                raise RuntimeError(f"私钥解析失败：{last_err}")
        elif self.auth.key_path:
            key_path = self.auth.key_path.strip()
            if key_path:
                last_err: Exception | None = None
                for loader in (
                    paramiko.RSAKey.from_private_key_file,
                    paramiko.ECDSAKey.from_private_key_file,
                    paramiko.Ed25519Key.from_private_key_file,
                    paramiko.DSSKey.from_private_key_file,
                ):
                    try:
                        pkey = loader(key_path, password=self.auth.passphrase)
                        break
                    except Exception as exc:  # noqa: BLE001
                        last_err = exc
                if pkey is None and last_err is not None:
                    raise RuntimeError(f"私钥文件读取失败：{last_err}")

        client.connect(
            hostname=self.auth.host,
            port=self.auth.port,
            username=self.auth.username,
            password=self.auth.password,
            pkey=pkey,
            timeout=12,
            banner_timeout=12,
            auth_timeout=12,
            allow_agent=False,
            look_for_keys=False,
        )
        chan = client.invoke_shell(term="xterm")
        chan.settimeout(0.2)
        self.client = client
        self.channel = chan
        logger.info("terminal connected host=%s port=%s user=%s", self.auth.host, self.auth.port, self.auth.username)

    def close(self) -> None:
        self._closed.set()
        try:
            if self.channel is not None:
                self.channel.close()
        except Exception:
            pass
        try:
            if self.client is not None:
                self.client.close()
        except Exception:
            pass

    def resize(self, cols: int, rows: int) -> None:
        self._resize = (cols, rows)
        if self.channel is not None:
            try:
                self.channel.resize_pty(width=cols, height=rows)
            except Exception:
                pass

    def send(self, data: str) -> None:
        if self.channel is None or self.channel.closed:
            return
        try:
            # Do not gate on send_ready(); otherwise user keystrokes can be dropped
            # under short-lived backpressure and terminal appears "connected but no output".
            logger.info("terminal send input bytes=%s", len(data.encode("utf-8", "ignore")))
            self.channel.send(data)
        except Exception:
            pass

    def pump(self, loop: asyncio.AbstractEventLoop) -> None:
        try:
            while not self._closed.is_set() and self.channel is not None and not self.channel.closed:
                if self.channel.recv_ready():
                    data = self.channel.recv(4096)
                    if data:
                        logger.info("terminal recv stdout bytes=%s", len(data))
                        text = data.decode("utf-8", "ignore")
                        asyncio.run_coroutine_threadsafe(self.websocket.send_text(json.dumps({"type": "output", "data": text})), loop)
                        continue
                if self.channel.recv_stderr_ready():
                    data = self.channel.recv_stderr(4096)
                    if data:
                        logger.info("terminal recv stderr bytes=%s", len(data))
                        text = data.decode("utf-8", "ignore")
                        asyncio.run_coroutine_threadsafe(self.websocket.send_text(json.dumps({"type": "output", "data": text})), loop)
                        continue
                if self.channel.exit_status_ready():
                    break
                self._closed.wait(0.05)
        except Exception as exc:  # noqa: BLE001
            asyncio.run_coroutine_threadsafe(
                self.websocket.send_text(json.dumps({"type": "error", "message": str(exc)})),
                loop,
            )
        finally:
            self.close()


async def _auth_from_managed_host(host_id: int, access_token: str) -> TerminalAuth:
    try:
        payload = decode_token(access_token)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError("无效或过期 token") from exc

    if payload.get("type") != "access":
        raise RuntimeError("token 类型错误")

    jti = payload.get("jti")
    username = payload.get("sub")
    if not jti or not username:
        raise RuntimeError("token 缺少必要字段")

    async with SessionLocal() as db:
        denied = await db.scalar(select(TokenDenylist).where(TokenDenylist.jti == jti))
        if denied is not None:
            raise RuntimeError("token 已注销")

        user = await db.scalar(select(User).where(User.username == username))
        if user is None or not user.is_active:
            raise RuntimeError("用户不存在或已禁用")

        host = await db.get(Host, host_id)
        if host is None:
            raise RuntimeError("主机不存在")
        if (not user.is_admin) and (host.owner_id != user.id):
            raise RuntimeError("无权访问该主机")
        if not host.enabled:
            raise RuntimeError("主机已禁用")

        if not host.ssh_private_key and not host.ssh_key_path:
            raise RuntimeError("主机未配置 SSH 密钥")

        return TerminalAuth(
            host=host.ip,
            port=host.port,
            username=host.username,
            private_key=(host.ssh_private_key or None),
            key_path=(host.ssh_key_path or None),
        )


@router.websocket("/ws")
async def terminal_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    session: Optional[SshTerminalSession] = None
    pump_thread: Optional[threading.Thread] = None
    try:
        init_msg = await websocket.receive_text()
        payload = json.loads(init_msg)
        if payload.get("type") != "connect":
            await websocket.send_text(json.dumps({"type": "error", "message": "expected connect payload"}))
            await websocket.close(code=1003)
            return

        host_id = int(payload.get("host_id") or 0)
        if host_id > 0:
            access_token = str(payload.get("access_token") or "").strip()
            auth = await _auth_from_managed_host(host_id, access_token)
        else:
            auth = TerminalAuth(
                host=str(payload.get("host", "")).strip(),
                port=int(payload.get("port", 22)),
                username=str(payload.get("username", "")).strip(),
                password=(payload.get("password") or None),
                private_key=(payload.get("private_key") or None),
                passphrase=(payload.get("passphrase") or None),
            )
        if not auth.host or not auth.username:
            await websocket.send_text(json.dumps({"type": "error", "message": "host and username are required"}))
            await websocket.close(code=1003)
            return

        session = SshTerminalSession(websocket, auth)
        try:
            session.connect()
        except Exception as exc:  # noqa: BLE001
            await websocket.send_text(json.dumps({"type": "error", "message": str(exc)}))
            await websocket.close(code=1011)
            return

        await websocket.send_text(json.dumps({"type": "ready", "message": "connected"}))
        logger.info("terminal ws ready sent")
        loop = asyncio.get_running_loop()
        pump_thread = threading.Thread(target=session.pump, args=(loop,), daemon=True)
        pump_thread.start()

        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            msg_type = data.get("type")
            logger.info("terminal ws msg type=%s", msg_type)
            if msg_type == "input":
                session.send(str(data.get("data", "")))
            elif msg_type == "resize":
                session.resize(int(data.get("cols", 120)), int(data.get("rows", 30)))
            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif msg_type == "close":
                await websocket.close()
                break
    except WebSocketDisconnect:
        pass
    finally:
        if session is not None:
            session.close()
