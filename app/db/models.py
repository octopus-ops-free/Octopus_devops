from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    operation_logs: Mapped[list["OperationLog"]] = relationship(back_populates="user")


class TokenDenylist(Base):
    __tablename__ = "token_denylist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    token_type: Mapped[str] = mapped_column(String(16), nullable=False)  # access/refresh
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    method: Mapped[str] = mapped_column(String(8), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    client_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[Optional[User]] = relationship(back_populates="operation_logs")


class HostMetric(Base):
    __tablename__ = "host_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    host: Mapped[str] = mapped_column(String(128), nullable=False, index=True)  # MVP: "local"

    cpu_percent: Mapped[float] = mapped_column(Float, nullable=False)
    mem_percent: Mapped[float] = mapped_column(Float, nullable=False)
    disk_percent: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class Host(Base):
    __tablename__ = "hosts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    ip: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=22)
    username: Mapped[str] = mapped_column(String(64), nullable=False, default="root")
    cloud_provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 两种方式二选一：
    # 1) ssh_key_path：推荐（Windows 本地文件路径，不依赖粘贴文本）
    # 2) ssh_private_key：兼容（粘贴私钥全文）
    ssh_key_path: Mapped[Optional[str]] = mapped_column(String(260), nullable=True)
    ssh_private_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # 哪个平台用户创建/拥有这台主机，用于数据隔离
    owner_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    hostname: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    os_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AlertThreshold(Base):
    __tablename__ = "alert_thresholds"
    __table_args__ = (UniqueConstraint("host", "metric", name="uq_host_metric"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    host: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(32), nullable=False)  # cpu/mem/disk

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    warn: Mapped[float] = mapped_column(Float, nullable=False, default=80.0)
    crit: Mapped[float] = mapped_column(Float, nullable=False, default=90.0)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    host: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(32), nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)  # low/medium/high/warn/crit
    value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    resolved_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class AlertTrigger(Base):
    """
    手动配置的触发器：metric + 比较符 + 阈值 + 级别。
    """

    __tablename__ = "alert_triggers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    host: Mapped[str] = mapped_column(String(128), nullable=False, index=True, default="local")
    metric: Mapped[str] = mapped_column(String(32), nullable=False)  # cpu/mem/disk
    op: Mapped[str] = mapped_column(String(4), nullable=False)  # >=, >, <=, <
    value: Mapped[float] = mapped_column(Float, nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False)  # low/medium/high
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_to: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)  # 逗号分隔收件人
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class NotificationSetting(Base):
    """
    通知配置（MVP：仅 SMTP）。通过 Web 界面填写并保存到 SQLite。
    注意：密码以明文存储在本地 SQLite（适合 MVP/本地环境），生产环境建议改为加密或外部密钥管理。
    """

    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    smtp_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_from: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    use_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class LogSource(Base):
    """
    日志采集源：登记“主机 + 目录”，用于列文件与 tail 查看（MVP）。
    后续可扩展：保存 inode/offset 做增量同步。
    """

    __tablename__ = "log_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("hosts.id"), nullable=False, index=True)
    dir_path: Mapped[str] = mapped_column(String(512), nullable=False)
    remark: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

