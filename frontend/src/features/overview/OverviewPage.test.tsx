import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewPage } from './OverviewPage'
import type { OverviewDataState, OverviewSnapshot } from './types'

const useOverviewDataMock = vi.fn<() => OverviewDataState>()

vi.mock('./hooks/useOverviewData', () => ({
  useOverviewData: () => useOverviewDataMock(),
}))

vi.mock('./services/overviewApi', () => ({
  fetchAlertTrend: vi.fn().mockResolvedValue({ window: '24h', buckets: [] }),
  fetchCronSummary: vi.fn().mockResolvedValue({
    configured_lines: 0,
    success: 0,
    failure: 0,
    running: 0,
    skipped: 0,
    degraded: false,
  }),
}))

vi.mock('./components/KpiCards', () => ({
  KpiCards: () => <div>kpi-cards</div>,
}))

vi.mock('./components/TrendLineChart', () => ({
  TrendLineChart: () => <div>trend-line-chart</div>,
}))

vi.mock('./components/AlertTrendChart', () => ({
  AlertTrendChart: () => <div>alert-trend-chart</div>,
}))

vi.mock('./components/AlertOverviewPanel', () => ({
  AlertOverviewPanel: ({ snapshot }: { snapshot: OverviewSnapshot }) => (
    <div data-testid="alert-overview-panel">
      {snapshot.alerts[0] ? `${snapshot.alerts[0].metric} / ${snapshot.alerts[0].host}` : 'empty-alerts'}
    </div>
  ),
}))

vi.mock('./components/CronTaskSummaryPanel', () => ({
  CronTaskSummaryPanel: () => <div>cron-task-summary</div>,
}))

vi.mock('./components/JobExecutionPlaceholder', () => ({
  JobExecutionPlaceholder: () => <div>job-execution-placeholder</div>,
}))

vi.mock('./components/ResourceTopologyGraph', () => ({
  ResourceTopologyGraph: () => <div>resource-topology-graph</div>,
}))

function createSnapshot(): OverviewSnapshot {
  return {
    updatedAt: '2026-04-25T10:00:00Z',
    monitoredHostId: '1',
    monitoredHostName: 'local',
    monitoredHostIp: '127.0.0.1',
    kpis: [],
    trend: [],
    alerts: [
      {
        id: 'a-1',
        host: 'host-01',
        metric: 'CPU',
        level: 'critical',
        value: 95,
        threshold: 90,
        message: 'CPU 使用率超过阈值',
        createdAt: '2026-04-25T09:59:00Z',
        resolved: false,
      },
    ],
    topology: {
      nodes: [{ id: 'n-1', name: 'db-prod', type: 'database', status: 'warning' }],
      links: [],
    },
    logSources: 5,
    degradedSources: ['logs'],
  }
}

describe('OverviewPage', () => {
  beforeEach(() => {
    useOverviewDataMock.mockReset()
  })

  it('renders loading state on first paint', () => {
    useOverviewDataMock.mockReturnValue({
      snapshot: null,
      loading: true,
      error: null,
      connectionStatus: 'idle',
    })

    render(<OverviewPage />)

    expect(screen.getByText('概览加载中')).toBeInTheDocument()
  })

  it('renders unavailable state when snapshot is missing after loading', () => {
    useOverviewDataMock.mockReturnValue({
      snapshot: null,
      loading: false,
      error: 'backend unreachable',
      connectionStatus: 'disconnected',
    })

    render(<OverviewPage />)

    expect(screen.getByText('概览暂不可用')).toBeInTheDocument()
    expect(screen.getByText('backend unreachable')).toBeInTheDocument()
  })

  it('renders key sections when snapshot data is ready', () => {
    useOverviewDataMock.mockReturnValue({
      snapshot: createSnapshot(),
      loading: false,
      error: null,
      connectionStatus: 'connected',
    })

    render(<OverviewPage />)

    expect(screen.getByText('kpi-cards')).toBeInTheDocument()
    expect(screen.getByText('trend-line-chart')).toBeInTheDocument()
    expect(screen.getByText('alert-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('alert-overview-panel')).toHaveTextContent('CPU / host-01')
    expect(screen.getByText('cron-task-summary')).toBeInTheDocument()
    expect(screen.getByText('job-execution-placeholder')).toBeInTheDocument()
    expect(screen.getByText('resource-topology-graph')).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: '概览时间窗' })).toBeInTheDocument()
  })

  it('shows reconnecting status tip when realtime connection is unstable', () => {
    useOverviewDataMock.mockReturnValue({
      snapshot: createSnapshot(),
      loading: false,
      error: 'ws disconnected',
      connectionStatus: 'reconnecting',
    })

    render(<OverviewPage />)

    expect(screen.getByText('实时状态：重连中（保留上次数据）')).toBeInTheDocument()
    expect(screen.queryByText('实时状态：连接中断（仅展示缓存/空态）')).not.toBeInTheDocument()
    expect(screen.getByText('部分数据更新失败')).toBeInTheDocument()
  })

  it('shows snapshot-only as offline snapshot mode instead of online', () => {
    useOverviewDataMock.mockReturnValue({
      snapshot: createSnapshot(),
      loading: false,
      error: null,
      connectionStatus: 'snapshot-only',
    })

    render(<OverviewPage />)

    expect(screen.getByText('实时状态：快照模式（离线）')).toBeInTheDocument()
    expect(screen.queryByText('实时状态：在线')).not.toBeInTheDocument()
  })

  it('shows disconnected copy and never conflicts with online/reconnecting', () => {
    useOverviewDataMock.mockReturnValue({
      snapshot: createSnapshot(),
      loading: false,
      error: null,
      connectionStatus: 'disconnected',
    })

    render(<OverviewPage />)

    expect(screen.getByText('实时状态：连接中断（仅展示缓存/空态）')).toBeInTheDocument()
    expect(screen.queryByText('实时状态：在线')).not.toBeInTheDocument()
    expect(screen.queryByText('实时状态：重连中（保留上次数据）')).not.toBeInTheDocument()
  })

  it('maps each connection status to exactly one unique copy', () => {
    const cases: Array<{ status: OverviewDataState['connectionStatus']; text: string }> = [
      { status: 'connected', text: '实时状态：在线' },
      { status: 'reconnecting', text: '实时状态：重连中（保留上次数据）' },
      { status: 'snapshot-only', text: '实时状态：快照模式（离线）' },
      { status: 'disconnected', text: '实时状态：连接中断（仅展示缓存/空态）' },
    ]

    for (const current of cases) {
      useOverviewDataMock.mockReturnValue({
        snapshot: createSnapshot(),
        loading: false,
        error: null,
        connectionStatus: current.status,
      })

      const { unmount } = render(<OverviewPage />)
      expect(screen.getByText(current.text)).toBeInTheDocument()
      for (const other of cases.filter((item) => item.text !== current.text)) {
        expect(screen.queryByText(other.text)).not.toBeInTheDocument()
      }
      unmount()
    }
  })

  it('updates UI when snapshot changes from A to B in the same lifecycle', () => {
    const snapshotA = createSnapshot()
    const snapshotB: OverviewSnapshot = {
      ...createSnapshot(),
      updatedAt: '2026-04-25T10:01:00Z',
      alerts: [
        {
          id: 'a-2',
          host: 'host-02',
          metric: 'Memory',
          level: 'warning',
          value: 82,
          threshold: 80,
          message: '内存使用率持续升高',
          createdAt: '2026-04-25T10:00:40Z',
          resolved: false,
        },
      ],
    }

    useOverviewDataMock
      .mockReturnValueOnce({
        snapshot: snapshotA,
        loading: false,
        error: null,
        connectionStatus: 'connected',
      })
      .mockReturnValueOnce({
        snapshot: snapshotB,
        loading: false,
        error: null,
        connectionStatus: 'connected',
      })

    const { rerender } = render(<OverviewPage />)

    expect(screen.getByTestId('alert-overview-panel')).toHaveTextContent('CPU / host-01')

    rerender(<OverviewPage />)

    expect(screen.getByTestId('alert-overview-panel')).toHaveTextContent('Memory / host-02')
  })
})
