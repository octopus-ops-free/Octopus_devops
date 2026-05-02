import { useEffect, useMemo, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'

import type { AlertTrendResponse } from '../services/overviewApi'
import type { OverviewAlertItem, OverviewAlertLevel, OverviewSnapshot } from '../types'
import { PanelFrame } from './PanelFrame'
import { useEChart } from './useEChart'

interface AlertOverviewPanelProps {
  snapshot: OverviewSnapshot
  trend: AlertTrendResponse | null
}

const LEVEL_RANK: Record<OverviewAlertLevel, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  medium: 3,
  low: 4,
  info: 5,
}

function sortAlertsForOverview(items: OverviewAlertItem[]): OverviewAlertItem[] {
  return [...items].sort((a, b) => {
    const ra = LEVEL_RANK[a.level] ?? 99
    const rb = LEVEL_RANK[b.level] ?? 99
    if (ra !== rb) return ra - rb
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
  })
}

function formatAlertTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(5, 16)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function AlertOverviewPanel({ snapshot, trend }: AlertOverviewPanelProps) {
  const { containerRef, setChartOption } = useEChart()

  const distribution = useMemo(() => aggregateFromTrend(trend), [trend])
  const orderedAlerts = useMemo(() => sortAlertsForOverview(snapshot.alerts).slice(0, 12), [snapshot.alerts])

  useEffect(() => {
    const option = buildDonut(distribution)
    setChartOption(option, { notMerge: true })
  }, [distribution, setChartOption])

  return (
    <PanelFrame title="告警概览" subtitle="分布来自趋势聚合 · 列表按等级与时间">
      <div style={grid}>
        <div ref={containerRef} style={donutWrap} />
        <ul style={listStyle} aria-label="告警列表">
          {orderedAlerts.map((a) => (
            <li key={a.id} style={liStyle}>
              <span style={levelBadge(a.level)}>{a.level}</span>
              <div style={liMain}>
                <span style={liTitle}>
                  {a.metric} / {a.host}
                </span>
                <span style={liSub}>{a.message}</span>
              </div>
              <time style={liTime} dateTime={a.createdAt}>
                {formatAlertTime(a.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </PanelFrame>
  )
}

function aggregateFromTrend(trend: AlertTrendResponse | null): Record<string, number> {
  const out: Record<string, number> = { critical: 0, warning: 0, info: 0, other: 0 }
  if (!trend?.buckets) return out
  for (const b of trend.buckets) {
    for (const k of Object.keys(out)) {
      out[k] += Number(b.counts[k] ?? 0)
    }
  }
  return out
}

function buildDonut(counts: Record<string, number>): EChartsOption {
  const data = [
    { name: 'critical', value: counts.critical ?? 0, itemStyle: { color: '#f43f5e' } },
    { name: 'warning', value: counts.warning ?? 0, itemStyle: { color: '#f59e0b' } },
    { name: 'info', value: counts.info ?? 0, itemStyle: { color: '#38bdf8' } },
    { name: 'other', value: counts.other ?? 0, itemStyle: { color: '#64748b' } },
  ].filter((d) => d.value > 0)

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', textStyle: { color: '#dbeafe' } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        avoidLabelOverlap: true,
        label: { color: '#9db2d3', fontSize: 10 },
        data: data.length ? data : [{ name: '无数据', value: 1, itemStyle: { color: '#334155' } }],
      },
    ],
  }
}

function levelBadge(level: OverviewAlertItem['level']): CSSProperties {
  const c =
    level === 'critical'
      ? '#f43f5e'
      : level === 'high' || level === 'warning'
        ? '#f59e0b'
        : level === 'info'
          ? '#38bdf8'
          : '#94a3b8'
  return {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
    background: c,
    padding: '2px 6px',
    borderRadius: 4,
    alignSelf: 'start',
    textTransform: 'uppercase',
  }
}

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
  gap: 12,
  alignItems: 'stretch',
  minHeight: 200,
}

const donutWrap: CSSProperties = { width: '100%', minHeight: 200 }

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: 8,
  overflow: 'auto',
  maxHeight: 280,
}

const liStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 10,
  alignItems: 'start',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(15, 23, 42, 0.55)',
  border: '1px solid var(--shell-border-medium)',
}

const liMain: CSSProperties = { display: 'grid', gap: 4, minWidth: 0 }

const liTitle: CSSProperties = { color: '#f1f5f9', fontSize: 12, fontWeight: 600 }

const liSub: CSSProperties = { color: '#94a3b8', fontSize: 11, lineHeight: 1.45 }

const liTime: CSSProperties = {
  fontSize: 11,
  color: '#64748b',
  whiteSpace: 'nowrap',
  justifySelf: 'end',
  marginTop: 2,
}
