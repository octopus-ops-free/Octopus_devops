from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: dt.datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    is_admin: bool = False


class HostMetricOut(BaseModel):
    id: int
    host: str
    cpu_percent: float
    mem_percent: float
    disk_percent: float
    created_at: dt.datetime


class HostCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    ip: str = Field(min_length=1, max_length=64)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(default="root", min_length=1, max_length=64)
    cloud_provider: Optional[str] = Field(default=None, max_length=64)
    ssh_key_path: Optional[str] = Field(default=None, max_length=260, description="推荐：本机私钥文件路径（Windows）")
    ssh_private_key: Optional[str] = Field(default=None, min_length=64, description="兼容：粘贴私钥全文")


class HostUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    ip: Optional[str] = Field(default=None, min_length=1, max_length=64)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    username: Optional[str] = Field(default=None, min_length=1, max_length=64)
    cloud_provider: Optional[str] = Field(default=None, max_length=64)
    ssh_key_path: Optional[str] = Field(default=None, max_length=260)
    ssh_private_key: Optional[str] = Field(default=None, min_length=64)
    enabled: Optional[bool] = None


class HostOut(BaseModel):
    id: int
    name: str
    ip: str
    port: int
    username: str
    cloud_provider: Optional[str] = None
    enabled: bool
    hostname: Optional[str] = None
    os_info: Optional[str] = None
    created_at: dt.datetime


class RemoteUserOut(BaseModel):
    username: str
    uid: int
    gid: int
    home: str
    shell: str


class RemoteUserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=32, pattern=r"^[a-z_][a-z0-9_-]{0,31}$")
    # MVP：为避免远端命令注入与引号问题，限制密码字符集（可后续放宽）
    password: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9@#%+=_\-]{6,64}$")
    make_sudo: bool = False


class RemoteUserSudoUpdate(BaseModel):
    make_sudo: bool


class RemoteUserGroupsOut(BaseModel):
    username: str
    primary_group: str
    supplementary_groups: list[str]


class RemoteUserPasswordUpdate(BaseModel):
    password: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9@#%+=_\-]{6,64}$")


class RemoteUserPrimaryGroupUpdate(BaseModel):
    group: str = Field(min_length=1, max_length=64, pattern=r"^[a-z_][a-z0-9_-]{0,63}$")


class RemoteUserGroupUpdate(BaseModel):
    group: str = Field(min_length=1, max_length=64, pattern=r"^[a-z_][a-z0-9_-]{0,63}$")


class RemoteProcessOut(BaseModel):
    pid: int
    user: str
    cpu: float
    mem: float
    time: str
    cmd: str


class RemotePortOut(BaseModel):
    proto: str
    recv_q: str
    send_q: str
    local: str
    foreign: str
    state: str
    pid_program: Optional[str] = None


class ThresholdUpsert(BaseModel):
    enabled: bool = True
    warn: float = Field(default=80.0, ge=0.0, le=100.0)
    crit: float = Field(default=90.0, ge=0.0, le=100.0)


class ThresholdOut(BaseModel):
    id: int
    host: str
    metric: str
    enabled: bool
    warn: float
    crit: float
    created_at: dt.datetime
    updated_at: dt.datetime


class AlertEventOut(BaseModel):
    id: int
    host: str
    metric: str
    level: str
    value: float
    threshold: float
    message: str
    resolved: bool
    resolved_at: Optional[dt.datetime] = None
    created_at: dt.datetime


class AlertTrendBucketOut(BaseModel):
    start: str = Field(description="ISO8601 UTC")
    counts: dict[str, int] = Field(default_factory=dict)


class AlertTrendOut(BaseModel):
    window: str
    buckets: list[AlertTrendBucketOut]


class CronSummaryOut(BaseModel):
    configured_lines: int
    success: int
    failure: int
    running: int
    skipped: int
    degraded: bool
    detail: Optional[str] = Field(default=None, max_length=512)


class AlertTriggerIn(BaseModel):
    host: str = Field(default="local", min_length=1, max_length=128)
    metric: str = Field(pattern="^(cpu|mem|disk)$")
    op: str = Field(pattern=r"^(>=|>|<=|<)$")
    value: float = Field(ge=0.0, le=100.0)
    level: str = Field(pattern="^(low|medium|high)$")
    description: Optional[str] = Field(default=None, max_length=255)
    email_to: Optional[str] = Field(default=None, max_length=512, description="收件人邮箱（逗号分隔）")


class AlertTriggerOut(BaseModel):
    id: int
    host: str
    metric: str
    op: str
    value: float
    level: str
    description: Optional[str]
    email_to: Optional[str] = None
    enabled: bool
    created_at: dt.datetime


class SmtpSettingIn(BaseModel):
    smtp_host: str = Field(min_length=1, max_length=255)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: Optional[str] = Field(default=None, max_length=255)
    smtp_password: Optional[str] = Field(default=None, max_length=255)
    smtp_from: str = Field(min_length=3, max_length=255)
    use_tls: bool = True


class SmtpSettingOut(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_from: Optional[str] = None
    use_tls: bool = True


class LoginRecordOut(BaseModel):
    time: str
    user: str
    ip: Optional[str] = None
    line: str


class LogSourceCreate(BaseModel):
    host_id: int = Field(ge=1)
    dir_path: str = Field(min_length=1, max_length=512)
    remark: Optional[str] = Field(default=None, max_length=255)


class LogSourceOut(BaseModel):
    id: int
    host_id: int
    dir_path: str
    remark: Optional[str] = None
    enabled: bool
    created_at: dt.datetime


class HealthOut(BaseModel):
    status: str
    db: str
    detail: Optional[str] = None


class DbBackupInfo(BaseModel):
    name: str
    path: str
    size_bytes: int
    mtime: dt.datetime

