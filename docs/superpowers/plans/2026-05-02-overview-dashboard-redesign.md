# Overview Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 React 概览首页布局对齐设计 Spec（`docs/superpowers/specs/2026-05-02-overview-dashboard-redesign-design.md`），新增告警趋势与告警概览合并、资源健康主机文案、基于 SSH 的定时任务统计 API 与前端环形图、作业占位与主导航一致的快速入口。

**Architecture:** 后端新增 **只读** 告警时间序列聚合（单接口避免大 payload）与按 `Host` SSH 的 cron 摘要；前端 `OverviewPage` 提升 **共享时间窗 state**（24h/7d/30d）驱动告警趋势与告警概览；`Host.name` / `Host.ip` / `Host.id` 在 `overviewApi` 内统一解析以修复 metrics 查询与展示。

**Tech stack:** FastAPI + SQLAlchemy/async SQLite；现有 `ssh_exec`；React 19 + ECharts 6 + Vitest。

**Context:** Spec 已通过 §9 技术审查；若使用独立 git worktree，在克隆仓库根目录执行下列路径。

---

## File map（创建 / 修改）

| 路径 | 职责 |
|------|------|
| `requirements.txt` | 增加 `pytest` 供后端纯函数测试 |
| `tests/test_alert_trend.py` | 告警时间桶与归一化级别单元测试 |
| `tests/test_cron_summary_parse.py` | cron 日志行解析单元测试 |
| `app/services/alert_trend.py` | `window_start_utc`、`bucket_starts`、`aggregate_alert_events` |
| `app/services/cron_summary.py` | `fetch_cron_summary_for_host`（SSH `crontab -l` + 日志命令组合） |
| `app/api/schemas.py` | `AlertTrendOut`、`CronSummaryOut` 等 Pydantic 模型 |
| `app/api/alerts.py` | 注册 `GET /api/alerts/trend` |
| `app/api/hosts.py` | 注册 `GET /api/hosts/{host_id}/cron/summary` |
| `frontend/src/features/overview/types.ts` | `OverviewTimeWindow` 扩展；`OverviewSnapshot` 增加 `monitoredHostIp` 等 |
| `frontend/src/features/overview/services/overviewApi.ts` | 解析 Host、metrics 用 name、拉 trend/cron、合并告警排序 |
| `frontend/src/features/overview/hooks/useOverviewAlertWindow.ts` | **新建**：`window` + `setWindow` 默认值 `24h` |
| `frontend/src/features/overview/components/AlertTrendChart.tsx` | **新建** |
| `frontend/src/features/overview/components/AlertOverviewPanel.tsx` | **新建**（分布 + 列表） |
| `frontend/src/features/overview/components/CronTaskSummaryPanel.tsx` | **新建** |
| `frontend/src/features/overview/components/JobExecutionPlaceholder.tsx` | **新建** |
| `frontend/src/features/overview/components/TrendLineChart.tsx` | 标题/副标题/时间窗 24h/7d/30d |
| `frontend/src/features/overview/OverviewPage.tsx` | 三列布局重组 |
| `frontend/src/features/overview/OverviewPage.css` | 栅格与响应式 |
| `frontend/src/features/shell/Layout.tsx` | 底栏 `navItems.map` → `NavLink` |
| `frontend/src/features/overview/OverviewPage.test.tsx` | 更新 mock 与断言 |

---

### Task 1: 后端 — `alert_trend` 纯逻辑 + pytest

**Files:**

- Create: `app/services/alert_trend.py`
- Create: `tests/test_alert_trend.py`
- Modify: `requirements.txt`

- [ ] **Step 1: 在 `requirements.txt` 末尾追加一行**

```text
pytest>=8.0.0
```

- [ ] **Step 2: 写入 `app/services/alert_trend.py`（全文）**

```python
from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Any, Literal

Window = Literal["24h", "7d", "30d"]

# 与前端 OverviewAlertLevel 排序一致；聚合键用归一化后小写
NORMAL_LEVEL_ORDER = ("critical", "high", "warning", "medium", "info", "low", "other")


def normalize_alert_level(raw: str) -> str:
    s = (raw or "").strip().lower()
    if s in {"crit", "critical"}:
        return "critical"
    if s in {"warn", "warning"}:
        return "warning"
    if s == "info":
        return "info"
    if s == "high":
        return "high"
    if s == "medium":
        return "medium"
    if s == "low":
        return "low"
    return "other"


def window_duration(window: Window) -> dt.timedelta:
    if window == "24h":
        return dt.timedelta(hours=24)
    if window == "7d":
        return dt.timedelta(days=7)
    return dt.timedelta(days=30)


def window_start_utc(now: dt.datetime, window: Window) -> dt.datetime:
    if now.tzinfo is None:
        now = now.replace(tzinfo=dt.timezone.utc)
    else:
        now = now.astimezone(dt.timezone.utc)
    return now - window_duration(window)


def bucket_step(window: Window) -> dt.timedelta:
    if window == "24h":
        return dt.timedelta(hours=1)
    return dt.timedelta(days=1)


def floor_to_bucket_start(ts: dt.datetime, step: dt.timedelta) -> dt.datetime:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=dt.timezone.utc)
    else:
        ts = ts.astimezone(dt.timezone.utc)
    epoch = dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)
    seconds = (ts - epoch).total_seconds()
    step_s = step.total_seconds()
    floored = int(seconds // step_s) * step_s
    return epoch + dt.timedelta(seconds=floored)


def build_bucket_starts(start: dt.datetime, end: dt.datetime, step: dt.timedelta) -> list[dt.datetime]:
    cur = floor_to_bucket_start(start, step)
    out: list[dt.datetime] = []
    while cur <= end:
        out.append(cur)
        cur += step
    return out


def aggregate_alert_events(
    rows: list[dict[str, Any]],
    *,
    now: dt.datetime,
    window: Window,
    host_filter: str | None,
) -> dict[str, Any]:
    """
    rows: 每项含 created_at (datetime 或 ISO 字符串), host (str), level (str)
    """
    step = bucket_step(window)
    end = now.astimezone(dt.timezone.utc) if now.tzinfo else now.replace(tzinfo=dt.timezone.utc)
    start = window_start_utc(end, window)
    bucket_starts = build_bucket_starts(start, end, step)
    counts: dict[dt.datetime, dict[str, int]] = {b: defaultdict(int) for b in bucket_starts}

    for row in rows:
        host = str(row.get("host") or "")
        if host_filter and host != host_filter:
            continue
        ca = row.get("created_at")
        if isinstance(ca, str):
            ts = dt.datetime.fromisoformat(ca.replace("Z", "+00:00"))
        elif isinstance(ca, dt.datetime):
            ts = ca if ca.tzinfo else ca.replace(tzinfo=dt.timezone.utc)
        else:
            continue
        ts = ts.astimezone(dt.timezone.utc)
        if ts < start or ts > end:
            continue
        lvl = normalize_alert_level(str(row.get("level") or ""))
        bstart = floor_to_bucket_start(ts, step)
        if bstart not in counts:
            continue
        counts[bstart][lvl] += 1

    series_keys = ("critical", "warning", "info", "other")
    buckets_out = []
    for b in bucket_starts:
        c = counts[b]
        buckets_out.append(
            {
                "start": b.isoformat().replace("+00:00", "Z"),
                "counts": {k: int(c.get(k, 0)) for k in series_keys},
            }
        )
    return {"window": window, "buckets": buckets_out}
```

- [ ] **Step 3: 写入 `tests/test_alert_trend.py`（全文）**

```python
from __future__ import annotations

import datetime as dt

from app.services.alert_trend import aggregate_alert_events, normalize_alert_level


def test_normalize_maps_crit_and_warn():
    assert normalize_alert_level("crit") == "critical"
    assert normalize_alert_level("WARN") == "warning"


def test_aggregate_respects_host_filter_and_counts_critical():
    now = dt.datetime(2026, 5, 2, 15, 30, tzinfo=dt.timezone.utc)
    rows = [
        {"host": "h1", "level": "critical", "created_at": now - dt.timedelta(minutes=30)},
        {"host": "h2", "level": "critical", "created_at": now - dt.timedelta(minutes=30)},
    ]
    out = aggregate_alert_events(rows, now=now, window="24h", host_filter="h1")
    assert out["window"] == "24h"
    total_critical = sum(b["counts"]["critical"] for b in out["buckets"])
    assert total_critical == 1
```

- [ ] **Step 4: 安装依赖并运行 pytest**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops
pip install -r requirements.txt
python -m pytest tests/test_alert_trend.py -v
```

Expected: **PASS**（修正 Step 3 中断言后）。

- [ ] **Step 5: Commit**

```bash
git add requirements.txt app/services/alert_trend.py tests/test_alert_trend.py
git commit -m "feat(alerts): add alert trend aggregation helpers"
```

---

### Task 2: 后端 — `GET /api/alerts/trend`

**Files:**

- Modify: `app/api/schemas.py`（追加模型）
- Modify: `app/api/alerts.py`

- [ ] **Step 1: 在 `app/api/schemas.py` 追加**

```python
from pydantic import BaseModel, Field


class AlertTrendBucketOut(BaseModel):
    start: str = Field(description="ISO8601 UTC")
    counts: dict[str, int] = Field(default_factory=dict)


class AlertTrendOut(BaseModel):
    window: str
    buckets: list[AlertTrendBucketOut]
```

- [ ] **Step 2: 在 `app/api/alerts.py` 增加 import 与路由**

在文件 import 区将 `schemas` 与 `alert_trend` 合并进现有 import（**不要**重复 `import datetime as dt`），例如：

```python
from app.api.schemas import (
    AlertEventOut,
    AlertTrendBucketOut,
    AlertTrendOut,
    AlertTriggerIn,
    AlertTriggerOut,
    ThresholdOut,
    ThresholdUpsert,
)
from app.services.alert_trend import aggregate_alert_events, window_start_utc
```

在 `router = APIRouter(...)` 之后合适位置增加：

```python


@router.get("/trend", response_model=AlertTrendOut)
async def alert_trend(
    window: str = Query(default="24h", pattern="^(24h|7d|30d)$"),
    host: str | None = Query(default=None, description="与 alert_events.host 精确匹配；不传则全主机"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AlertTrendOut:
    if window not in ("24h", "7d", "30d"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid window")
    w = window  # type: ignore[assignment]
    now = dt.datetime.now(dt.timezone.utc)
    start = window_start_utc(now, w)
    stmt = select(AlertEvent).where(AlertEvent.created_at >= start)
    if host:
        stmt = stmt.where(AlertEvent.host == host)
    res = await db.scalars(stmt)
    rows = [{"host": r.host, "level": r.level, "created_at": r.created_at} for r in list(res)]
    raw = aggregate_alert_events(rows, now=now, window=w, host_filter=None)
    return AlertTrendOut(
        window=raw["window"],
        buckets=[AlertTrendBucketOut(**b) for b in raw["buckets"]],
    )
```

（将 `AlertTrendOut` 等 schema 的 import 合并进文件顶部现有 import 块，避免重复 `import datetime`。）

- [ ] **Step 3: 运行 pytest + 手动 curl（可选）**

```powershell
python -m pytest tests/test_alert_trend.py -v
```

- [ ] **Step 4: Commit**

```bash
git add app/api/schemas.py app/api/alerts.py
git commit -m "feat(api): add GET /api/alerts/trend"
```

---

### Task 3: 后端 — cron 摘要 SSH + `GET /api/hosts/{host_id}/cron/summary`

**Files:**

- Create: `app/services/cron_summary.py`
- Create: `tests/test_cron_summary_parse.py`
- Modify: `app/api/schemas.py`
- Modify: `app/api/hosts.py`

实现要点（须在 `cron_summary.py` 写清）：

1. `async def fetch_cron_summary(host: Host, window: str) -> dict`：使用 `ssh_run` / `ssh_run_with_key_path` 执行 `crontab -l 2>/dev/null`；再执行 **短超时** 的 `journalctl` 或 `tail` syslog（失败则 `degraded=True`）。
2. 返回 JSON 可序列化 dict：`configured_lines`、`success`、`failure`、`running`、`skipped`、`degraded`、`detail`（无密钥）。

`tests/test_cron_summary_parse.py` 至少测试：从样例 stdout 解析出成功/失败计数（把解析函数拆成纯函数 `parse_cron_syslog_lines(lines: list[str]) -> dict[str, int]`）。

- [ ] **Step 1–4:** 实现、pytest、`git commit -m "feat(api): host cron summary over ssh"`

---

### Task 4: 前端 — Host 解析与 API 客户端

**Files:**

- Modify: `frontend/src/features/overview/types.ts`
- Modify: `frontend/src/features/overview/services/overviewApi.ts`

- [ ] **Step 1: 扩展 `OverviewTimeWindow`**

```ts
export type OverviewTimeWindow = '24h' | '7d' | '30d'
```

- [ ] **Step 2: `OverviewSnapshot` 增加字段**

```ts
  monitoredHostId: string
  monitoredHostName: string
  monitoredHostIp: string
```

- [ ] **Step 3: 在 `fetchOverviewSnapshot` 内**

1. `api<Host[]>('/api/hosts')` 取列表；用 `filters.host` 匹配 `String(h.id) === filters.host` 或 `h.name === filters.host`。
2. `metrics` 请求使用 **`host.name`** 作为 `host` query。
3. 填充 `monitoredHostIp` / `monitoredHostName` / `monitoredHostId`。

- [ ] **Step 4: 新增函数**

```ts
export async function fetchAlertTrend(window: '24h' | '7d' | '30d', hostName: string | undefined) {
  const q = new URLSearchParams({ window })
  if (hostName) q.set('host', hostName)
  return api<{ window: string; buckets: Array<{ start: string; counts: Record<string, number> }> }>(`/api/alerts/trend?${q}`)
}

export async function fetchCronSummary(hostId: number, window: '24h' | '7d' | '30d') {
  return api<{ configured_lines: number; success: number; failure: number; running: number; skipped: number; degraded: boolean; detail?: string }>(
    `/api/hosts/${hostId}/cron/summary?window=${window}`,
  )
}
```

- [ ] **Step 5: `npm run build`（frontend 目录）**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npm run build
```

Expected: **PASS**（无 TS 错误）。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/overview/types.ts frontend/src/features/overview/services/overviewApi.ts
git commit -m "feat(overview): resolve host for metrics and add trend/cron api"
```

---

### Task 5: 前端 — 新建图表组件与 `OverviewPage` 布局

**Files:**

- Create: `frontend/src/features/overview/hooks/useOverviewAlertWindow.ts`
- Create: `frontend/src/features/overview/components/AlertTrendChart.tsx`
- Create: `frontend/src/features/overview/components/AlertOverviewPanel.tsx`
- Create: `frontend/src/features/overview/components/CronTaskSummaryPanel.tsx`
- Create: `frontend/src/features/overview/components/JobExecutionPlaceholder.tsx`
- Modify: `frontend/src/features/overview/components/TrendLineChart.tsx`
- Modify: `frontend/src/features/overview/OverviewPage.tsx`
- Modify: `frontend/src/features/overview/OverviewPage.css`
- Modify: `frontend/src/features/shell/Layout.tsx`

- [ ] **Step 1: `useOverviewAlertWindow.ts`**

```ts
import { useCallback, useState } from 'react'

export type AlertWindow = '24h' | '7d' | '30d'

export function useOverviewAlertWindow(initial: AlertWindow = '24h') {
  const [window, setWindow] = useState<AlertWindow>(initial)
  const set = useCallback((w: AlertWindow) => setWindow(w), [])
  return { window, setWindow: set }
}
```

- [ ] **Step 2: `OverviewPage.tsx`** 使用 `const { window, setWindow } = useOverviewAlertWindow()`，将 `window` 传入 `AlertTrendChart`、`AlertOverviewPanel`；`useEffect` 内 `fetchAlertTrend` / 合并告警列表过滤（或仅由 Panel 内部请求 trend + list）。

- [ ] **Step 3: `AlertOverviewPanel`** 内：`fetch('/api/alerts/trend')` 与 `snapshot.alerts` 或独立 `fetch` 列表数据；**排序**使用权重 map 与 spec 一致。

- [ ] **Step 4: `Layout.tsx` 底栏** 将 `navItems.map` 渲染为 `<NavLink to={item.to} ...>{item.label}</NavLink>`，移除硬编码中文数组。

- [ ] **Step 5: Vitest**

Run:

```powershell
cd G:\Cursor_fiie_path\Octopus_devops\frontend
npx vitest run src/features/overview/OverviewPage.test.tsx
```

Expected: **PASS**（同步更新 mock 组件名）。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/overview frontend/src/features/shell/Layout.tsx
git commit -m "feat(ui): overview dashboard layout and alert/cron panels"
```

---

## Self-review（对照 Spec）

| Spec 章节 | 对应 Task |
|-----------|-----------|
| §0 流程 | 文档已存在；本 plan 为 Step 3 产出 |
| §3 布局 | Task 5 |
| §4.1 主机 name/ip | Task 4 |
| §4.2 `/api/alerts/trend` | Task 2 |
| §4.3 cron SSH | Task 3 |
| §4.4 共享 window + 排序 | Task 5 |
| §5 快速入口 | Task 5 Layout |
| §7 验收 | Task 5 完成后人工打开 `/ui` 走查 |

**Placeholder scan:** Task 3 在正文中为步骤概要；实现时须在同一 commit 系列内补齐：`parse_cron_syslog_lines` 纯函数 + `tests/test_cron_summary_parse.py` 至少 3 条样例行、`fetch_cron_summary_for_host` 的 SSH 分支与 `degraded` 行为，不得留空函数体或 `pass` 占位合并提交。

---

Plan complete and saved to `docs/superpowers/plans/2026-05-02-overview-dashboard-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
