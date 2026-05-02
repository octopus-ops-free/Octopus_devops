import { render, screen } from '@testing-library/react'
import { KpiCards } from './KpiCards'
import type { OverviewKpi, OverviewSnapshot } from '../types'

function buildSnapshot(kpis: OverviewKpi[]): OverviewSnapshot {
  return {
    updatedAt: '2026-04-25T10:00:00Z',
    monitoredHostId: '1',
    monitoredHostName: 'local',
    monitoredHostIp: '127.0.0.1',
    kpis,
    trend: [],
    alerts: [],
    topology: { nodes: [], links: [] },
    logSources: 0,
    degradedSources: [],
  }
}

describe('KpiCards', () => {
  it('renders comparison copy for mom, yoy and undefined', () => {
    const snapshot = buildSnapshot([
      { key: 'hosts', label: 'MOM', value: 10, comparison: 'mom', delta: 1, trend: 'up' },
      { key: 'activeAlerts', label: 'YOY', value: 20, comparison: 'yoy', delta: -2, trend: 'down' },
      { key: 'runningProcesses', label: 'NONE', value: 30, delta: 0, trend: 'flat' },
    ])

    render(<KpiCards snapshot={snapshot} />)

    expect(screen.getByText('环比 +1')).toBeInTheDocument()
    expect(screen.getByText('同比 -2')).toBeInTheDocument()
    expect(screen.getByText('对比口径未设置持平 (0)')).toBeInTheDocument()
  })

  it('uses delta as the only sign source, even when trend conflicts', () => {
    const snapshot = buildSnapshot([
      { key: 'hosts', label: 'A', value: 1, comparison: 'mom', delta: -3, trend: 'up' },
      { key: 'activeAlerts', label: 'B', value: 2, comparison: 'yoy', delta: 4, trend: 'down' },
    ])

    render(<KpiCards snapshot={snapshot} />)

    expect(screen.getByText('环比 -3')).toBeInTheDocument()
    expect(screen.getByText('同比 +4')).toBeInTheDocument()
  })

  it('shows explicit zero delta copy', () => {
    const snapshot = buildSnapshot([{ key: 'hosts', label: 'ZERO', value: 1, comparison: 'mom', delta: 0 }])

    render(<KpiCards snapshot={snapshot} />)

    expect(screen.getByText('环比持平 (0)')).toBeInTheDocument()
  })
})
