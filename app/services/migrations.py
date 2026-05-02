from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)


async def _has_column(conn, table: str, column: str) -> bool:
    rows = await conn.execute(text(f"PRAGMA table_info({table})"))
    for r in rows.fetchall():
        # PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
        if r[1] == column:
            return True
    return False


async def run_sqlite_migrations(engine: AsyncEngine) -> None:
    """
    极简迁移：仅用于 MVP 在无 Alembic 情况下对旧库补列。
    """
    async with engine.begin() as conn:
        # alert_events.resolved / resolved_at
        rows = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='alert_events'"))
        if rows.fetchone() is not None:
            if not await _has_column(conn, "alert_events", "resolved"):
                logger.warning("Migrating: add alert_events.resolved")
                await conn.execute(text("ALTER TABLE alert_events ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT 0"))
            if not await _has_column(conn, "alert_events", "resolved_at"):
                logger.warning("Migrating: add alert_events.resolved_at")
                await conn.execute(text("ALTER TABLE alert_events ADD COLUMN resolved_at DATETIME"))

        # hosts table (create if missing)
        rows = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='hosts'"))
        if rows.fetchone() is None:
            logger.warning("Migrating: create hosts table")
            await conn.execute(
                text(
                    """
CREATE TABLE hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(128) NOT NULL UNIQUE,
  ip VARCHAR(64) NOT NULL,
  port INTEGER NOT NULL DEFAULT 22,
  username VARCHAR(64) NOT NULL DEFAULT 'root',
  cloud_provider VARCHAR(64),
  ssh_key_path VARCHAR(260),
  ssh_private_key TEXT,
  enabled BOOLEAN NOT NULL DEFAULT 1,
  owner_id INTEGER REFERENCES users(id),
  hostname VARCHAR(128),
  os_info VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
                    """
                )
            )
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_hosts_name ON hosts(name)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_hosts_ip ON hosts(ip)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_hosts_owner_id ON hosts(owner_id)"))
        else:
            # add ssh_key_path column if missing
            if not await _has_column(conn, "hosts", "ssh_key_path"):
                logger.warning("Migrating: add hosts.ssh_key_path")
                await conn.execute(text("ALTER TABLE hosts ADD COLUMN ssh_key_path VARCHAR(260)"))
            # add owner_id for per-user host ownership
            if not await _has_column(conn, "hosts", "owner_id"):
                logger.warning("Migrating: add hosts.owner_id")
                await conn.execute(text("ALTER TABLE hosts ADD COLUMN owner_id INTEGER REFERENCES users(id)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_hosts_owner_id ON hosts(owner_id)"))

        # alert_triggers.email_to
        rows = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='alert_triggers'"))
        if rows.fetchone() is not None:
            if not await _has_column(conn, "alert_triggers", "email_to"):
                logger.warning("Migrating: add alert_triggers.email_to")
                await conn.execute(text("ALTER TABLE alert_triggers ADD COLUMN email_to VARCHAR(512)"))

        # notification_settings table
        rows = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_settings'"))
        if rows.fetchone() is None:
            logger.warning("Migrating: create notification_settings table")
            await conn.execute(
                text(
                    """
CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_username VARCHAR(255),
  smtp_password VARCHAR(255),
  smtp_from VARCHAR(255),
  use_tls BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
                    """
                )
            )

        # log_sources table
        rows = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='log_sources'"))
        if rows.fetchone() is None:
            logger.warning("Migrating: create log_sources table")
            await conn.execute(
                text(
                    """
CREATE TABLE log_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER NOT NULL,
  dir_path VARCHAR(512) NOT NULL,
  remark VARCHAR(255),
  enabled BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY(host_id) REFERENCES hosts(id)
);
                    """
                )
            )
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_log_sources_host_id ON log_sources(host_id)"))

