import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertDistributionChart } from './AlertDistributionChart'
import type { OverviewSnapshot } from '../types'

const setChartOptionMock = vi.fn()
const resizeChartMock = vi.fn()

vi.mock('./useEChart', () => ({
  useEChart: () => ({
    containerRef: { current: null },
    setChartOption: setChartOptionMock,
    resizeChart: resizeChartMock,
  }),
}))

vi.mock('./PanelFrame', () => ({
  PanelFrame: ({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {extra}
      {children}
    </section>
  ),
}))

function createSnapshot(alerts: OverviewSnapshot['alerts']): OverviewSnapshot {
  return {
    updatedAt: '2026-04-26T10:00:00Z',
    monitoredHostId: '1',
    monitoredHostName: 'local',
    monitoredHostIp: '127.0.0.1',
    kpis: [],
    trend: [],
    alerts,
    topology: { nodes: [], links: [] },
    logSources: 0,
    degradedSources: [],
  }
}

describe('AlertDistributionChart', () => {
  beforeEach(() => {
    setChartOptionMock.mockReset()
    resizeChartMock.mockReset()
  })

  it('builds donut distribution for critical/warning/info alerts', async () => {
    render(
      <AlertDistributionChart
        snapshot={createSnapshot([
          {
            id: 'a1',
            host: 'host-1',
            metric: 'CPU',
            level: 'critical',
            value: 95,
            threshold: 90,
            message: 'critical',
            createdAt: '2026-04-26T09:00:00Z',
            resolved: false,
          },
          {
            id: 'a2',
            host: 'host-1',
            metric: 'CPU',
            level: 'critical',
            value: 96,
            threshold: 90,
            message: 'critical',
            createdAt: '2026-04-26T09:10:00Z',
            resolved: false,
          },
          {
            id: 'a3',
            host: 'host-2',
            metric: 'Memory',
            level: 'warning',
            value: 81,
            threshold: 80,
            message: 'warning',
            createdAt: '2026-04-26T09:20:00Z',
            resolved: false,
          },
          {
            id: 'a4',
            host: 'host-3',
            metric: 'Disk',
            level: 'info',
            value: 70,
            threshold: 90,
            message: 'info',
            createdAt: '2026-04-26T09:30:00Z',
            resolved: false,
          },
        ])}
      />,
    )

    await waitFor(() => {
      expect(setChartOptionMock).toHaveBeenCalled()
    })

    const [option, opt] = setChartOptionMock.mock.calls.at(-1) ?? []
    expect(opt).toEqual({ notMerge: true })
    expect(resizeChartMock).toHaveBeenCalled()

    const seriesData = option.series?.[0]?.data ?? []
    const valuesByLevel = new Map(seriesData.map((item: { name: string; value: number }) => [item.name, item.value]))
    expect(valuesByLevel.get('critical')).toBe(2)
    expect(valuesByLevel.get('warning')).toBe(1)
    expect(valuesByLevel.get('info')).toBe(1)
    expect(valuesByLevel.get('high')).toBe(0)
    expect(valuesByLevel.get('medium')).toBe(0)
    expect(valuesByLevel.get('low')).toBe(0)
  })

  it('falls back to zero-value distribution when alerts are empty', async () => {
    render(<AlertDistributionChart snapshot={createSnapshot([])} />)

    await waitFor(() => {
      expect(setChartOptionMock).toHaveBeenCalled()
    })

    const [option] = setChartOptionMock.mock.calls.at(-1) ?? []
    const seriesData = option.series?.[0]?.data ?? []
    expect(seriesData).toHaveLength(6)
    for (const item of seriesData as Array<{ value: number }>) {
      expect(item.value).toBe(0)
    }

    fireEvent.click(screen.getByRole('button', { name: '柱状' }))
    await waitFor(() => {
      expect(setChartOptionMock).toHaveBeenCalledTimes(2)
    })
    const [barOption] = setChartOptionMock.mock.calls.at(-1) ?? []
    expect(barOption.xAxis?.data).toEqual([])
    expect(barOption.series?.[0]?.data).toEqual([])
  })
})
