from __future__ import annotations

import logging

from sqlalchemy import select

from app.db.models import HostMetric
from app.db.session import SessionLocal
from app.services.alerts import evaluate_and_record_alerts, get_or_create_default_thresholds

logger = logging.getLogger(__name__)


async def process_metric_and_alerts(metric_id: int) -> None:
    async with SessionLocal() as db:
        row = await db.scalar(select(HostMetric).where(HostMetric.id == metric_id))
        if row is None:
            logger.warning("metric not found: id=%s", metric_id)
            return
        await get_or_create_default_thresholds(db, row.host)
        await evaluate_and_record_alerts(db, row)

