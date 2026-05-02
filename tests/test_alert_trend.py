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


def test_high_level_maps_to_other_series_not_critical():
    now = dt.datetime(2026, 5, 2, 15, 30, tzinfo=dt.timezone.utc)
    rows = [
        {"host": "h1", "level": "high", "created_at": now - dt.timedelta(minutes=30)},
    ]
    out = aggregate_alert_events(rows, now=now, window="24h", host_filter=None)
    total_critical = sum(b["counts"]["critical"] for b in out["buckets"])
    total_other = sum(b["counts"]["other"] for b in out["buckets"])
    assert total_critical == 0
    assert total_other == 1
