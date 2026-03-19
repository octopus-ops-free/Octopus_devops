from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import NotificationSetting


async def get_smtp_setting(db: AsyncSession) -> NotificationSetting | None:
    return await db.scalar(select(NotificationSetting).order_by(NotificationSetting.id.desc()).limit(1))


def _send_email_blocking(
    *,
    host: str,
    port: int,
    username: str | None,
    password: str | None,
    use_tls: bool,
    mail_from: str,
    rcpt_to: list[str],
    subject: str,
    body: str,
) -> None:
    msg = EmailMessage()
    msg["From"] = mail_from
    msg["To"] = ", ".join(rcpt_to)
    msg["Subject"] = subject
    msg.set_content(body)

    if use_tls:
        server = smtplib.SMTP(host, port, timeout=12)
        try:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(msg)
        finally:
            try:
                server.quit()
            except Exception:
                pass
    else:
        server = smtplib.SMTP(host, port, timeout=12)
        try:
            if username and password:
                server.login(username, password)
            server.send_message(msg)
        finally:
            try:
                server.quit()
            except Exception:
                pass


async def send_email(db: AsyncSession, *, to_list: list[str], subject: str, body: str) -> None:
    cfg = await get_smtp_setting(db)
    if cfg is None or not cfg.smtp_host or not cfg.smtp_port or not cfg.smtp_from:
        raise RuntimeError("SMTP 未配置（请在大屏/告警页配置 SMTP 后再启用邮件通知）")
    await asyncio.to_thread(
        _send_email_blocking,
        host=cfg.smtp_host,
        port=int(cfg.smtp_port),
        username=cfg.smtp_username,
        password=cfg.smtp_password,
        use_tls=bool(cfg.use_tls),
        mail_from=cfg.smtp_from,
        rcpt_to=to_list,
        subject=subject,
        body=body,
    )

