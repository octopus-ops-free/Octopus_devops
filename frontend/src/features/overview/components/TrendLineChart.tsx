import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'

import type { OverviewSnapshot, OverviewTimeWindow, OverviewTrendPoint } from '../types'
import { PanelFrame } from './PanelFrame'
import { useEChart } from './useEChart'

const TIME_WINDOWS: OverviewTimeWindow[] = ['24h', '7d', '30d']

interface TrendLineChartProps {
  snapshot: OverviewSnapshot
  /** 与全局概览时间窗同步；不传则组件内自选 */
  timeWindow?: OverviewTimeWindow
  onTimeWindowChange?: (w: OverviewTimeWindow) => void
  /** 为 true 时不渲染右上角时间按钮（由页面统一工具条切换） */
  hideTabs?: boolean
}

export function TrendLineChart({
  snapshot,
  timeWindow: controlledWindow,
  onTimeWindowChange,
  hideTabs = false,
}: TrendLineChartProps) {
  const [internalWindow, setInternalWindow] = useState<OverviewTimeWindow>('24h')
  const windowSize = controlledWindow ?? internalWindow
  const setWindowSize = onTimeWindowChange ?? setInternalWindow

  const { containerRef, setChartOption } = useEChart()

  const data = useMemo(() => filterByWindow(snapshot.trend, windowSize), [snapshot.trend, windowSize])

  useEffect(() => {
    const option = buildTrendOption(data)
    setChartOption(option, { notMerge: true })
  }, [data, setChartOption])

  const ipSubtitle = snapshot.monitoredHostIp?.trim()
    ? `当前检测主机：${snapshot.monitoredHostIp}`
    : '当前检测主机：未知'

  return (
    <PanelFrame
      title="资源健康状态"
      subtitle={ipSubtitle}
      extra={
        hideTabs ? null : (
          <div style={tabWrapStyle}>
            {TIME_WINDOWS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={item === windowSize}
                style={item === windowSize ? activeTabStyle : tabStyle}
                onClick={() => setWindowSize(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )
      }
    >
      <div ref={containerRef} style={chartContainerStyle} />
    </PanelFrame>
  )
}

function filterByWindow(points: OverviewTrendPoint[], windowSize: OverviewTimeWindow): OverviewTrendPoint[] {
  if (points.length === 0) {
    return []
  }

  const durationMsMap: Record<OverviewTimeWindow, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }

  const latest = points.reduce((maxTimestamp, point) => {
    const timestamp = new Date(point.timestamp).getTime()
    return Number.isNaN(timestamp) ? maxTimestamp : Math.max(maxTimestamp, timestamp)
  }, Number.NEGATIVE_INFINITY)
  if (!Number.isFinite(latest)) {
    return []
  }
  const duration = durationMsMap[windowSize]

  return points
    .filter((point) => latest - new Date(point.timestamp).getTime() <= duration)
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
}

function buildTrendOption(points: OverviewTrendPoint[]): EChartsOption {
  const labels = points.map((point) => point.timestamp.slice(11, 16))

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
    grid: {
      left: 10,
      right: 12,
      top: 32,
      bottom: 8,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLine: { lineStyle: { color: '#28415f' } },
      axisLabel: { color: '#94a9c8' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#94a9c8' },
      splitLine: { lineStyle: { color: 'rgba(56, 76, 103, 0.3)' } },
    },
    series: [
      {
        name: 'CPU',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: points.map((point) => point.cpuPercent),
        lineStyle: { width: 2, color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.15)' },
      },
      {
        name: '内存',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: points.map((point) => point.memPercent),
        lineStyle: { width: 2, color: '#a78bfa' },
      },
      {
        name: '磁盘',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: points.map((point) => point.diskPercent),
        lineStyle: { width: 2, color: '#34d399' },
      },
    ],
  }
}

const chartContainerStyle: CSSProperties = {
  width: '100%',
  height: 260,
}

const tabWrapStyle: CSSProperties = {
  display: 'inline-flex',
  borderRadius: 8,
  border: '1px solid rgba(71, 85, 105, 0.48)',
  overflow: 'hidden',
}

const tabStyle: CSSProperties = {
  border: 0,
  padding: '4px 10px',
  background: 'rgba(14, 24, 45, 0.92)',
  color: '#9fb4d4',
  cursor: 'pointer',
  fontSize: 12,
}

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: '#1f3f72',
  color: '#dbeafe',
}
