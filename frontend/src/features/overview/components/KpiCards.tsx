import type { CSSProperties } from 'react'
import type { OverviewKpi, OverviewSnapshot } from '../types'

interface KpiCardsProps {
  snapshot: OverviewSnapshot
}

export function KpiCards({ snapshot }: KpiCardsProps) {
  const cols = Math.min(Math.max(snapshot.kpis.length, 1), 6)
  const gridStyleResolved: CSSProperties = {
    ...gridStyle,
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  }
  return (
    <div style={gridStyleResolved}>
      {snapshot.kpis.map((kpi) => {
        const trendText = formatTrendText(kpi)
        return (
          <article key={kpi.key} style={cardStyle}>
            <div style={labelStyle}>{kpi.label}</div>
            <div style={valueStyle}>
              {kpi.value}
              {kpi.unit ? <span style={unitStyle}>{kpi.unit}</span> : null}
            </div>
            <div style={{ ...trendStyle, color: pickTrendColor(kpi) }}>{trendText}</div>
          </article>
        )
      })}
    </div>
  )
}

function formatTrendText(kpi: OverviewKpi): string {
  const comparisonLabel = kpi.comparison === 'mom' ? '环比' : kpi.comparison === 'yoy' ? '同比' : '对比口径未设置'
  if (typeof kpi.delta !== 'number') {
    return `${comparisonLabel}数据待接入`
  }

  const abs = Math.abs(kpi.delta)
  const formattedDelta = formatDeltaValue(kpi, abs)
  if (kpi.delta === 0) {
    return `${comparisonLabel}持平 (${formattedDelta})`
  }
  if (kpi.delta > 0) {
    return `${comparisonLabel} +${formattedDelta}`
  }
  return `${comparisonLabel} -${formattedDelta}`
}

function formatDeltaValue(kpi: OverviewKpi, value: number): string {
  if (kpi.unit === '%') {
    return `${value.toFixed(1)}%`
  }
  return `${Math.round(value)}`
}

function pickTrendColor(kpi: OverviewKpi): string {
  if (kpi.status === 'critical') {
    return '#f87171'
  }
  if (kpi.status === 'warning') {
    return '#fbbf24'
  }
  if (kpi.delta && kpi.delta > 0 && kpi.comparison === 'mom') {
    return '#fb7185'
  }
  if (kpi.trend === 'down') {
    return '#60a5fa'
  }
  return '#34d399'
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const cardStyle: CSSProperties = {
  minHeight: 96,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface)',
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.2), inset 0 1px 0 var(--shell-inset)',
  display: 'grid',
  gap: 8,
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: '#94a9c8',
}

const valueStyle: CSSProperties = {
  fontSize: 30,
  fontWeight: 700,
  color: '#f1f5ff',
  lineHeight: 1,
}

const unitStyle: CSSProperties = {
  marginLeft: 6,
  fontSize: 14,
  color: '#9db2d3',
}

const trendStyle: CSSProperties = {
  fontSize: 12,
}
