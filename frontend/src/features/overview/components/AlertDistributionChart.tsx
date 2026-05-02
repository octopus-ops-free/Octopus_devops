import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'
import { PanelFrame } from './PanelFrame'
import { useEChart } from './useEChart'
import type { OverviewAlertLevel, OverviewSnapshot } from '../types'

type AlertViewMode = 'donut' | 'bar'

interface AlertDistributionChartProps {
  snapshot: OverviewSnapshot
}

const LEVEL_ORDER: OverviewAlertLevel[] = ['critical', 'high', 'warning', 'medium', 'info', 'low']

export function AlertDistributionChart({ snapshot }: AlertDistributionChartProps) {
  const [mode, setMode] = useState<AlertViewMode>('donut')
  const { containerRef, setChartOption, resizeChart } = useEChart()

  const chartOption = useMemo(() => {
    if (mode === 'donut') {
      return buildDonutOption(snapshot)
    }
    return buildBarOption(snapshot)
  }, [mode, snapshot])

  useEffect(() => {
    setChartOption(chartOption, { notMerge: true })
    resizeChart()
  }, [chartOption, resizeChart, setChartOption])

  return (
    <PanelFrame
      title="告警分布"
      extra={
        <div style={switchWrapStyle}>
          <button type="button" style={mode === 'donut' ? activeButtonStyle : switchButtonStyle} onClick={() => setMode('donut')}>
            环形
          </button>
          <button type="button" style={mode === 'bar' ? activeButtonStyle : switchButtonStyle} onClick={() => setMode('bar')}>
            柱状
          </button>
        </div>
      }
    >
      <div ref={containerRef} style={chartContainerStyle} />
    </PanelFrame>
  )
}

function buildDonutOption(snapshot: OverviewSnapshot): EChartsOption {
  const countMap = countByLevel(snapshot)
  const data = LEVEL_ORDER.map((level) => ({
    name: level,
    value: countMap.get(level) ?? 0,
    itemStyle: { color: levelColorMap[level] },
  }))

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 17, 34, 0.95)',
      borderColor: 'rgba(71, 85, 105, 0.45)',
      textStyle: { color: '#dbeafe' },
    },
    legend: {
      orient: 'vertical',
      right: 6,
      top: 'middle',
      textStyle: { color: '#9db2d3' },
    },
    series: [
      {
        name: 'Alerts',
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        data,
      },
    ],
  }
}

function buildBarOption(snapshot: OverviewSnapshot): EChartsOption {
  const bars = aggregateAlertTimeline(snapshot)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(10, 17, 34, 0.95)',
      borderColor: 'rgba(71, 85, 105, 0.45)',
      textStyle: { color: '#dbeafe' },
    },
    grid: { left: 10, right: 10, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: bars.map((item) => item.label),
      axisLine: { lineStyle: { color: '#28415f' } },
      axisLabel: { color: '#94a9c8' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a9c8' },
      splitLine: { lineStyle: { color: 'rgba(56, 76, 103, 0.3)' } },
    },
    series: [
      {
        type: 'bar',
        data: bars.map((item) => item.value),
        itemStyle: { color: '#60a5fa' },
        barMaxWidth: 20,
      },
    ],
  }
}

function countByLevel(snapshot: OverviewSnapshot): Map<OverviewAlertLevel, number> {
  const map = new Map<OverviewAlertLevel, number>()
  for (const alert of snapshot.alerts) {
    map.set(alert.level, (map.get(alert.level) ?? 0) + 1)
  }
  return map
}

function aggregateAlertTimeline(snapshot: OverviewSnapshot): Array<{ label: string; value: number }> {
  const bucketMap = new Map<string, number>()
  for (const alert of snapshot.alerts) {
    const key = alert.createdAt.slice(11, 13)
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1)
  }

  return Array.from(bucketMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([hour, value]) => ({ label: `${hour}:00`, value }))
}

const levelColorMap: Record<OverviewAlertLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  warning: '#f59e0b',
  medium: '#eab308',
  info: '#3b82f6',
  low: '#22c55e',
}

const chartContainerStyle: CSSProperties = {
  width: '100%',
  height: 260,
}

const switchWrapStyle: CSSProperties = {
  display: 'inline-flex',
  borderRadius: 8,
  border: '1px solid rgba(71, 85, 105, 0.48)',
  overflow: 'hidden',
}

const switchButtonStyle: CSSProperties = {
  border: 0,
  padding: '4px 10px',
  background: 'rgba(14, 24, 45, 0.85)',
  color: '#9fb4d4',
  cursor: 'pointer',
  fontSize: 12,
}

const activeButtonStyle: CSSProperties = {
  ...switchButtonStyle,
  background: 'rgba(96, 165, 250, 0.22)',
  color: '#dbeafe',
}
