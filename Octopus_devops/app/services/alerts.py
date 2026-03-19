from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AlertEvent, AlertThreshold, AlertTrigger, HostMetric
from app.services.email_notify import send_email

logger = logging.getLogger(__name__)


async def get_or_create_default_thresholds(db: AsyncSession, host: str = "local") -> None:
    for metric in ("cpu", "mem", "disk"):
        existing = await db.scalar(
            select(AlertThreshold).where(AlertThreshold.host == host, AlertThreshold.metric == metric)
        )
        if existing is None:
            db.add(AlertThreshold(host=host, metric=metric, enabled=True, warn=80.0, crit=90.0))
    await db.commit()


def _value_for_metric(metric: str, m: HostMetric) -> float:
    if metric == "cpu":
        return m.cpu_percent
    if metric == "mem":
        return m.mem_percent
    if metric == "disk":
        return m.disk_percent
    raise ValueError(f"unknown metric: {metric}")


async def evaluate_and_record_alerts(db: AsyncSession, metric_row: HostMetric) -> list[AlertEvent]:
    events: list[AlertEvent] = []
    thresholds = await db.scalars(select(AlertThreshold).where(AlertThreshold.host == metric_row.host))
    for th in list(thresholds):
        if not th.enabled:
            continue
        v = _value_for_metric(th.metric, metric_row)
        level = None
        t = None
        if v >= th.crit:
            level = "high"
            t = th.crit
        elif v >= th.warn:
            level = "medium"
            t = th.warn
        if level is None:
            continue

        msg = f"{metric_row.host} {th.metric} {v:.1f}% >= {t:.1f}% ({level})"
        ev = AlertEvent(host=metric_row.host, metric=th.metric, level=level, value=v, threshold=float(t), message=msg)
        db.add(ev)
        events.append(ev)
        logger.warning("ALERT %s", msg)

    # 手动触发器
    triggers = await db.scalars(select(AlertTrigger).where(AlertTrigger.host == metric_row.host, AlertTrigger.enabled.is_(True)))
    for tr in list(triggers):
        v = _value_for_metric(tr.metric, metric_row)
        cond = False
        if tr.op == ">=":
            cond = v >= tr.value
        elif tr.op == ">":
            cond = v > tr.value
        elif tr.op == "<=":
            cond = v <= tr.value
        elif tr.op == "<":
            cond = v < tr.value
        if not cond:
            continue
        msg = tr.description or f"Trigger: {tr.metric} {tr.op} {tr.value:.1f}%"
        ev = AlertEvent(
            host=metric_row.host,
            metric=tr.metric,
            level=tr.level,
            value=v,
            threshold=float(tr.value),
            message=msg,
        )
        db.add(ev)
        events.append(ev)
        logger.warning("ALERT TRIGGER %s -> %.1f%%", msg, v)

    if events:
        await db.commit()
        for ev in events:
            await db.refresh(ev)

        # 邮件通知（仅对“手动触发器”按触发器 email_to 发送；阈值告警暂不发邮件，后续可扩展）
        try:
            for tr in list(triggers):
                if not tr.enabled or not tr.email_to:
                    continue
                # 是否本轮命中该触发器
                vv = _value_for_metric(tr.metric, metric_row)
                cond = False
                if tr.op == ">=":
                    cond = vv >= tr.value
                elif tr.op == ">":
                    cond = vv > tr.value
                elif tr.op == "<=":
                    cond = vv <= tr.value
                elif tr.op == "<":
                    cond = vv < tr.value
                if not cond:
                    continue
                to_list = [x.strip() for x in tr.email_to.split(",") if x.strip()]
                if not to_list:
                    continue
                subj = f"[Octopus告警/{tr.level}] {metric_row.host} {tr.metric}{tr.op}{tr.value:.0f}%"
                body = (
                    f"主机: {metric_row.host}\n"
                    f"指标: {tr.metric}\n"
                    f"条件: {tr.op} {tr.value:.1f}%\n"
                    f"当前值: {vv:.1f}%\n"
                    f"级别: {tr.level}\n"
                    f"备注: {tr.description or '-'}\n"
                )
                await send_email(db, to_list=to_list, subject=subj, body=body)
        except Exception as e:
            logger.warning("email notify failed: %s", str(e)[:300])
    return events

