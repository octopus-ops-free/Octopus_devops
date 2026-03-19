from __future__ import annotations

import datetime as dt
import shutil
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


def sqlite_healthcheck() -> tuple[bool, str]:
    p = settings.sqlite_file_path()
    if not p.exists():
        return True, "db file not found yet (will be created on first write)"
    return True, "ok"


def _backups_dir() -> Path:
    return settings.sqlite_file_path().parent.joinpath("backups")


@dataclass
class BackupInfo:
    name: str
    path: str
    size_bytes: int
    mtime: dt.datetime


def backup_sqlite_named(name: str | None = None) -> Path:
    """
    在固定目录 data/backups 下创建备份文件，返回实际路径。
    name 为空时自动生成时间戳名称。
    """
    src = settings.sqlite_file_path()
    src.parent.mkdir(parents=True, exist_ok=True)
    if not src.exists():
        src.touch()

    backups = _backups_dir()
    backups.mkdir(parents=True, exist_ok=True)

    if not name:
        ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        name = f"backup-{ts}.db"
    if not name.endswith(".db"):
        name = f"{name}.db"

    dst = backups.joinpath(name)
    shutil.copy2(src, dst)
    return dst


def list_backups(limit: int | None = None) -> list[BackupInfo]:
    backups = _backups_dir()
    if not backups.exists():
        return []
    items: list[BackupInfo] = []
    for p in backups.glob("*.db"):
        stat = p.stat()
        mtime = dt.datetime.fromtimestamp(stat.st_mtime, tz=dt.timezone.utc)
        items.append(BackupInfo(name=p.name, path=str(p.resolve()), size_bytes=stat.st_size, mtime=mtime))
    items.sort(key=lambda x: x.mtime, reverse=True)
    if limit is not None:
        items = items[:limit]
    return items


def restore_sqlite_from_backup(name: str) -> Path:
    """
    从 data/backups 下的指定文件恢复。
    """
    backups = _backups_dir()
    src = backups.joinpath(name)
    if not src.exists():
        raise FileNotFoundError(str(src))
    dst = settings.sqlite_file_path()
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return dst


def rollback_to_latest_backup() -> Path:
    """
    回滚到最近一次备份（按修改时间排序）。
    """
    backups = list_backups(limit=1)
    if not backups:
        raise FileNotFoundError("no backups found")
    return restore_sqlite_from_backup(backups[0].name)


