from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import HostMetricOut
from app.core.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.monitoring import list_metrics, save_local_metrics
from app.services.tasks import process_metric_and_alerts

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.post("/collect", response_model=HostMetricOut)
async def collect_once(
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> HostMetricOut:
    row = await save_local_metrics(db, host="local")
    background.add_task(process_metric_and_alerts, row.id)
    return HostMetricOut.model_validate(row, from_attributes=True)


@router.get("/metrics", response_model=list[HostMetricOut])
async def get_metrics(
    limit: int = Query(default=100, ge=1, le=1000),
    host: str = Query(default="local", description="主机名：local 或已添加主机的 name"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[HostMetricOut]:
    rows = await list_metrics(db, host=host, limit=limit)
    return [HostMetricOut.model_validate(r, from_attributes=True) for r in rows]

