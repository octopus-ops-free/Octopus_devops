from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.db.models import Host
from app.db.session import SessionLocal
from app.services.monitoring import save_remote_linux_metrics
from app.services.tasks import process_metric_and_alerts

logger = logging.getLogger(__name__)


class MetricsScheduler:
    def __init__(self, interval_seconds: int = 60):
        self.interval_seconds = interval_seconds
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except Exception:
                self._task.cancel()

    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self._collect_all_hosts_once()
            except Exception:
                logger.exception("scheduler collect failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                pass

    async def _collect_all_hosts_once(self) -> None:
        async with SessionLocal() as db:
            hosts = await db.scalars(select(Host).where(Host.enabled.is_(True)).order_by(Host.id))
            for h in list(hosts):
                try:
                    row = await save_remote_linux_metrics(db, h)
                    # 触发告警评估（独立 session 在任务内执行）
                    asyncio.create_task(process_metric_and_alerts(row.id))
                except Exception as e:
                    logger.warning("collect host failed name=%s ip=%s err=%s", h.name, h.ip, str(e)[:400])

