import type { CSSProperties } from 'react'
import type { OverviewKpi, OverviewSnapshot } from '../types'

interface KpiCardsProps {
  snapshot: OverviewSnapshot
}

export function KpiCards({ snapshot }: KpiCardsProps) {
  return (
    <div style={gridStyle}>
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
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 10,
}

const cardStyle: CSSProperties = {
  minHeight: 94,
  padding: 12,
  borderRadius: 12,
  border: '1px solid rgba(71, 85, 105, 0.48)',
  background: '#0f1a2e',
  display: 'grid',
  gap: 8,
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
