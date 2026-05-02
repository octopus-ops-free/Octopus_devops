from __future__ import annotations

import datetime as dt
from collections import defaultdict
from typing import Any, Literal

Window = Literal["24h", "7d", "30d"]

# 与前端 OverviewAlertLevel 排序一致；聚合键用归一化后小写
NORMAL_LEVEL_ORDER = ("critical", "high", "warning", "medium", "info", "low", "other")

# 归一化后的级别在输出 series 时归入 "other" 桶
_LEVELS_TO_OTHER_SERIES = frozenset({"high", "medium", "low", "other"})


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


def _counts_for_series(c: dict[str, int]) -> dict[str, int]:
    """Map per-bucket normalized levels to API series keys (critical, warning, info, other)."""
    other_sum = sum(int(c.get(k, 0)) for k in _LEVELS_TO_OTHER_SERIES)
    return {
        "critical": int(c.get("critical", 0)),
        "warning": int(c.get("warning", 0)),
        "info": int(c.get("info", 0)),
        "other": other_sum,
    }


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
        mapped = _counts_for_series(c)
        buckets_out.append(
            {
                "start": b.isoformat().replace("+00:00", "Z"),
                "counts": {k: mapped[k] for k in series_keys},
            }
        )
    return {"window": window, "buckets": buckets_out}
