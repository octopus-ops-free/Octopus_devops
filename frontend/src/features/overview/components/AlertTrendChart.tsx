import { useEffect, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'

import type { AlertTrendResponse } from '../services/overviewApi'
import { PanelFrame } from './PanelFrame'
import { useEChart } from './useEChart'

interface AlertTrendChartProps {
  trend: AlertTrendResponse | null
  hostIp?: string
}

export function AlertTrendChart({ trend, hostIp }: AlertTrendChartProps) {
  const { containerRef, setChartOption } = useEChart()

  useEffect(() => {
    const option = buildAlertTrendOption(trend?.buckets ?? [])
    setChartOption(option, { notMerge: true })
  }, [trend, setChartOption])

  const subtitle = hostIp?.trim() ? `主机：${hostIp}` : '主机：未知'

  return (
    <PanelFrame title="告警趋势" subtitle={subtitle}>
      <div ref={containerRef} style={chartWrap} />
    </PanelFrame>
  )
}

function buildAlertTrendOption(buckets: AlertTrendResponse['buckets']): EChartsOption {
  const labels = buckets.map((b) => {
    const d = new Date(b.start)
    return Number.isNaN(d.getTime()) ? b.start.slice(5, 16) : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`
  })

  const seriesNames = ['critical', 'warning', 'info', 'other'] as const
  const colors: Record<(typeof seriesNames)[number], string> = {
    critical: '#f43f5e',
    warning: '#f59e0b',
    info: '#38bdf8',
    other: '#94a3b8',
  }

  return {
    backgroundColor: '#0b1324',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(10, 17, 34, 0.95)',
      borderColor: 'rgba(71, 85, 105, 0.45)',
      textStyle: { color: '#dbeafe' },
    },
    legend: {
      top: 0,
      textStyle: { color: '#9db2d3' },
      itemWidth: 10,
      itemHeight: 6,
    },
    grid: { left: 10, right: 12, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: '#28415f' } },
      axisLabel: { color: '#94a9c8', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#94a9c8' },
      splitLine: { lineStyle: { color: 'rgba(56, 76, 103, 0.3)' } },
    },
    series: seriesNames.map((name) => ({
      name,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: colors[name] },
      itemStyle: { color: colors[name] },
      data: buckets.map((b) => Number(b.counts[name] ?? 0)),
    })),
  }
}

const chartWrap: CSSProperties = {
  width: '100%',
  height: 260,
}
