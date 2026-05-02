import { useEffect, useMemo, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'

import type { AlertTrendResponse } from '../services/overviewApi'
import type { OverviewAlertItem, OverviewSnapshot } from '../types'
import { PanelFrame } from './PanelFrame'
import { useEChart } from './useEChart'

interface AlertOverviewPanelProps {
  snapshot: OverviewSnapshot
  trend: AlertTrendResponse | null
}

export function AlertOverviewPanel({ snapshot, trend }: AlertOverviewPanelProps) {
  const { containerRef, setChartOption } = useEChart()

  const distribution = useMemo(() => aggregateFromTrend(trend), [trend])

  useEffect(() => {
    const option = buildDonut(distribution)
    setChartOption(option, { notMerge: true })
  }, [distribution, setChartOption])

  return (
    <PanelFrame title="告警概览">
      <div style={grid}>
        <div ref={containerRef} style={donutWrap} />
        <ul style={listStyle} aria-label="告警列表">
          {snapshot.alerts.slice(0, 12).map((a) => (
            <li key={a.id} style={liStyle}>
              <span style={levelBadge(a.level)}>{a.level}</span>
              <div style={liMain}>
                <span style={liTitle}>
                  {a.metric} / {a.host}
                </span>
                <span style={liSub}>{a.message}</span>
              </div>
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
    alignSelf: 'flex-start',
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
  display: 'flex',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 8,
  background: 'rgba(15, 23, 42, 0.4)',
  border: '1px solid rgba(71, 85, 105, 0.34)',
}

const liMain: CSSProperties = { display: 'grid', gap: 4, minWidth: 0 }

const liTitle: CSSProperties = { color: '#dbe7ff', fontSize: 12 }

const liSub: CSSProperties = { color: '#9db2d3', fontSize: 11 }
