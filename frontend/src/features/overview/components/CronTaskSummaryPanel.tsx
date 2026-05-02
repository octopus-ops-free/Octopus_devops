import { useEffect, type CSSProperties } from 'react'
import type { EChartsOption } from 'echarts'

import type { CronSummaryResponse } from '../services/overviewApi'
import { PanelFrame } from './PanelFrame'
import { useEChart } from './useEChart'

interface CronTaskSummaryPanelProps {
  summary: CronSummaryResponse | null
  hostIp?: string
}

export function CronTaskSummaryPanel({ summary, hostIp }: CronTaskSummaryPanelProps) {
  const { containerRef, setChartOption } = useEChart()

  useEffect(() => {
    setChartOption(buildCronRing(summary), { notMerge: true })
  }, [summary, setChartOption])

  const subtitle = hostIp?.trim() ? `主机：${hostIp}` : '主机：未知'
  const foot = summary?.degraded ? summary.detail ?? '日志解析降级，仅展示 crontab 配置等可用数据' : null

  return (
    <PanelFrame title="定时任务执行概况" subtitle={subtitle}>
      <div ref={containerRef} style={chartWrap} />
      {foot ? <p style={footStyle}>{foot}</p> : null}
      {summary ? (
        <dl style={dlStyle}>
          <div style={row}>
            <dt>已配置行</dt>
            <dd>{summary.configured_lines}</dd>
          </div>
          <div style={row}>
            <dt>成功 / 失败 / 运行中 / 跳过</dt>
            <dd>
              {summary.success} / {summary.failure} / {summary.running} / {summary.skipped}
            </dd>
          </div>
        </dl>
      ) : null}
    </PanelFrame>
  )
}

function buildCronRing(s: CronSummaryResponse | null): EChartsOption {
  if (!s) {
    return {
      backgroundColor: 'transparent',
      title: {
        text: '加载中…',
        left: 'center',
        top: 'center',
        textStyle: { color: '#94a3b8', fontSize: 13 },
      },
    }
  }

  const data = [
    { name: '成功', value: s.success, itemStyle: { color: '#22c55e' } },
    { name: '失败', value: s.failure, itemStyle: { color: '#f43f5e' } },
    { name: '运行中', value: s.running, itemStyle: { color: '#38bdf8' } },
    { name: '跳过', value: s.skipped, itemStyle: { color: '#94a3b8' } },
  ].filter((d) => d.value > 0)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#f8fafc' },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        label: { color: '#cbd5e1', fontSize: 11 },
        data: data.length ? data : [{ name: '无执行记录', value: 1, itemStyle: { color: '#334155' } }],
      },
    ],
  }
}

const chartWrap: CSSProperties = { width: '100%', height: 220 }

const footStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 11,
  color: '#fbbf24',
}

const dlStyle: CSSProperties = { margin: '10px 0 0', display: 'grid', gap: 6 }

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#9db2d3' }
