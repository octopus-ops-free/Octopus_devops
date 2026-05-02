import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { TrendLineChart } from './TrendLineChart'
import type { OverviewSnapshot } from '../types'

const setOptionMock = vi.fn()
const resizeMock = vi.fn()
const disposeMock = vi.fn()

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: setOptionMock,
    resize: resizeMock,
    dispose: disposeMock,
  })),
}))

const buildSnapshot = (): OverviewSnapshot => ({
  updatedAt: '2026-04-25T10:00:00Z',
  monitoredHostId: '1',
  monitoredHostName: 'local',
  monitoredHostIp: '203.0.113.10',
  kpis: [],
  trend: [
    { timestamp: '2026-04-25T09:46:00Z', cpuPercent: 12, memPercent: 36, diskPercent: 44, alertCount: 1 },
    { timestamp: '2026-04-25T09:58:00Z', cpuPercent: 28, memPercent: 39, diskPercent: 45, alertCount: 2 },
    { timestamp: '2026-04-25T10:00:00Z', cpuPercent: 35, memPercent: 43, diskPercent: 48, alertCount: 3 },
  ],
  alerts: [],
  topology: { nodes: [], links: [] },
  logSources: 2,
  degradedSources: [],
})

describe('TrendLineChart', () => {
  beforeEach(() => {
    setOptionMock.mockClear()
    resizeMock.mockClear()
    disposeMock.mockClear()
  })

  it('renders and switches time window with setOption updates', async () => {
    render(<TrendLineChart snapshot={buildSnapshot()} />)

    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'false')

    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: '7d' }))
    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalledTimes(2)
    })
  })

  it('disposes echart instance on unmount', async () => {
    const view = render(<TrendLineChart snapshot={buildSnapshot()} />)

    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalled()
    })

    view.unmount()
    expect(disposeMock).toHaveBeenCalledTimes(1)
  })

  it('filters by max timestamp even when trend points are out of order', async () => {
    const snapshot = buildSnapshot()
    snapshot.trend = [
      { timestamp: '2026-04-25T09:58:00Z', cpuPercent: 28, memPercent: 39, diskPercent: 45, alertCount: 2 },
      { timestamp: '2026-04-25T10:00:00Z', cpuPercent: 35, memPercent: 43, diskPercent: 48, alertCount: 3 },
      { timestamp: '2026-04-25T09:40:00Z', cpuPercent: 15, memPercent: 35, diskPercent: 40, alertCount: 1 },
      { timestamp: '2026-04-25T09:50:00Z', cpuPercent: 20, memPercent: 37, diskPercent: 42, alertCount: 1 },
    ]

    render(<TrendLineChart snapshot={snapshot} />)

    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalled()
    })

    const [option] = setOptionMock.mock.calls.at(-1) ?? []
    // 默认时间窗为 24h，包含较早桶内的点
    expect(option?.xAxis?.data).toEqual(['09:40', '09:50', '09:58', '10:00'])
  })

  it('includes the boundary timestamp point for the selected window', async () => {
    const snapshot = buildSnapshot()
    snapshot.trend = [
      { timestamp: '2026-04-25T09:45:00Z', cpuPercent: 10, memPercent: 30, diskPercent: 40, alertCount: 1 },
      { timestamp: '2026-04-25T09:44:59Z', cpuPercent: 11, memPercent: 31, diskPercent: 41, alertCount: 1 },
      { timestamp: '2026-04-25T10:00:00Z', cpuPercent: 35, memPercent: 43, diskPercent: 48, alertCount: 3 },
    ]

    render(<TrendLineChart snapshot={snapshot} />)

    await waitFor(() => {
      expect(setOptionMock).toHaveBeenCalled()
    })

    const [option] = setOptionMock.mock.calls.at(-1) ?? []
    expect(option?.xAxis?.data).toEqual(['09:44', '09:45', '10:00'])
  })
})
