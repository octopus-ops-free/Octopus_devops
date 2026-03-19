from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import AlertEventOut, AlertTriggerIn, AlertTriggerOut, ThresholdOut, ThresholdUpsert
from app.core.deps import get_current_user, require_admin
from app.db.models import AlertEvent, AlertThreshold, AlertTrigger, User
from app.db.session import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/thresholds", response_model=list[ThresholdOut])
async def list_thresholds(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ThresholdOut]:
    res = await db.scalars(select(AlertThreshold).order_by(AlertThreshold.host, AlertThreshold.metric))
    return [ThresholdOut.model_validate(r, from_attributes=True) for r in list(res)]


@router.put("/thresholds/{metric}", response_model=ThresholdOut)
async def upsert_threshold(
    metric: str,
    body: ThresholdUpsert,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ThresholdOut:
    if metric not in {"cpu", "mem", "disk"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="metric 仅支持 cpu/mem/disk")
    if body.crit < body.warn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="crit 不能小于 warn")

    row = await db.scalar(select(AlertThreshold).where(AlertThreshold.host == "local", AlertThreshold.metric == metric))
    if row is None:
        row = AlertThreshold(host="local", metric=metric, enabled=body.enabled, warn=body.warn, crit=body.crit)
        db.add(row)
    else:
        row.enabled = body.enabled
        row.warn = body.warn
        row.crit = body.crit

    await db.commit()
    await db.refresh(row)
    return ThresholdOut.model_validate(row, from_attributes=True)


@router.get("/events", response_model=list[AlertEventOut])
async def list_events(
    limit: int = Query(default=100, ge=1, le=1000),
    include_resolved: bool = Query(default=False, description="是否包含已完成告警"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[AlertEventOut]:
    q = select(AlertEvent)
    if not include_resolved:
        q = q.where(AlertEvent.resolved.is_(False))
    q = q.order_by(desc(AlertEvent.created_at)).limit(limit)
    res = await db.scalars(q)
    return [AlertEventOut.model_validate(r, from_attributes=True) for r in list(res)]


@router.get("/events/history", response_model=list[AlertEventOut])
async def list_history_events(
    limit: int = Query(default=200, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[AlertEventOut]:
    res = await db.scalars(
        select(AlertEvent).where(AlertEvent.resolved.is_(True)).order_by(desc(AlertEvent.resolved_at), desc(AlertEvent.created_at)).limit(limit)
    )
    return [AlertEventOut.model_validate(r, from_attributes=True) for r in list(res)]


@router.post("/events/{event_id}/complete")
async def complete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict[str, object]:
    ev = await db.get(AlertEvent, event_id)
    if ev is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="告警事件不存在")
    if ev.resolved:
        return {"status": "ok", "resolved": True}
    ev.resolved = True
    ev.resolved_at = dt.datetime.now(dt.timezone.utc)
    await db.commit()
    await db.refresh(ev)
    return {"status": "ok", "resolved": True, "resolved_at": ev.resolved_at}


@router.get("/triggers", response_model=list[AlertTriggerOut])
async def list_triggers(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[AlertTriggerOut]:
    res = await db.scalars(select(AlertTrigger).order_by(AlertTrigger.metric, AlertTrigger.value))
    return [AlertTriggerOut.model_validate(r, from_attributes=True) for r in list(res)]


@router.post("/triggers", response_model=AlertTriggerOut, status_code=status.HTTP_201_CREATED)
async def create_trigger(
    body: AlertTriggerIn,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AlertTriggerOut:
    tr = AlertTrigger(
        host=body.host,
        metric=body.metric,
        op=body.op,
        value=body.value,
        level=body.level,
        description=body.description,
        email_to=body.email_to,
        enabled=True,
    )
    db.add(tr)
    await db.commit()
    await db.refresh(tr)
    return AlertTriggerOut.model_validate(tr, from_attributes=True)


@router.delete("/triggers/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(
    trigger_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    tr = await db.get(AlertTrigger, trigger_id)
    if tr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="触发器不存在")
    await db.delete(tr)
    await db.commit()


@router.post("/triggers/{trigger_id}/toggle")
async def toggle_trigger(
    trigger_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, bool]:
    tr = await db.get(AlertTrigger, trigger_id)
    if tr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="触发器不存在")
    tr.enabled = not tr.enabled
    await db.commit()
    await db.refresh(tr)
    return {"enabled": tr.enabled}


@router.post("/triggers/test")
async def test_triggers(
    body: AlertTriggerIn,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, object]:
    """
    手动输入一个 metric + 数值：
    - 返回命中哪些触发器
    - 若命中，则同时写入告警事件表，便于在 UI 的“告警事件”中验证展示效果
    """
    triggers = await db.scalars(
        select(AlertTrigger).where(
            AlertTrigger.host == body.host,
            AlertTrigger.metric == body.metric,
            AlertTrigger.enabled.is_(True),
        )
    )
    hit: list[AlertTriggerOut] = []
    v = body.value
    fired = 0
    for tr in list(triggers):
        cond = False
        if tr.op == ">=":
            cond = v >= tr.value
        elif tr.op == ">":
            cond = v > tr.value
        elif tr.op == "<=":
            cond = v <= tr.value
        elif tr.op == "<":
            cond = v < tr.value
        if cond:
            hit.append(AlertTriggerOut.model_validate(tr, from_attributes=True))

    if hit:
        for tr_out in hit:
            # 写入测试告警事件
            ev = AlertEvent(
                host=body.host,
                metric=tr_out.metric,
                level=tr_out.level,
                value=float(v),
                threshold=float(tr_out.value),
                message=f"TEST trigger hit: {tr_out.metric} {tr_out.op} {tr_out.value:.1f}% (level={tr_out.level})",
            )
            db.add(ev)
            fired += 1
        await db.commit()

    return {"host": body.host, "value": v, "metric": body.metric, "hits": hit, "fired_events": fired}

