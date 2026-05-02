import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../../../lib/api'
import { fetchOverviewSnapshot, fetchResourceTopology } from './overviewApi'

vi.mock('../../../lib/api', () => ({
  api: vi.fn(),
}))

const apiMock = vi.mocked(api)

const MOCK_HOSTS = [{ id: 1, name: 'local', ip: '127.0.0.1' }]

describe('overviewApi aggregation', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  it('aggregates monitoring/alerts/resources/logs into stable snapshot (alertCount time series)', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return MOCK_HOSTS
      }
      if (path.startsWith('/api/monitoring/metrics')) {
        expect(path).toContain('host=local')
        return [
          { created_at: '2026-04-25T10:00:00Z', cpu_percent: 50, mem_percent: 40, disk_percent: 60 },
          { created_at: '2026-04-25T10:01:00Z', cpu_percent: 55, mem_percent: 42, disk_percent: 61 },
        ]
      }
      if (path.startsWith('/api/alerts/events?')) {
        expect(path).toContain('include_resolved=true')
        expect(path).toContain('since=')
        return [
          {
            id: 1,
            host: 'local',
            metric: 'cpu',
            level: 'critical',
            value: 99,
            threshold: 90,
            message: 'cpu high',
            resolved: false,
            created_at: '2026-04-25T10:01:00Z',
          },
          {
            id: 2,
            host: 'local',
            metric: 'mem',
            level: 'warning',
            value: 70,
            threshold: 90,
            message: 'memory warning',
            resolved: false,
            created_at: '2026-04-25T09:59:00Z',
          },
          {
            id: 3,
            host: 'local',
            metric: 'disk',
            level: 'info',
            value: 50,
            threshold: 90,
            message: 'disk info',
            resolved: true,
            created_at: '2026-04-25T09:58:00Z',
          },
        ]
      }
      if (path === '/api/resources/processes?host_id=1') {
        return [{ pid: 123, user: 'root', cpu: 10, mem: 20, cmd: 'python app.py' }]
      }
      if (path === '/api/resources/ports?host_id=1') {
        return [{ proto: 'tcp', local: '0.0.0.0:8001', state: 'LISTEN', pid_program: '123/python' }]
      }
      if (path === '/api/logs/sources') {
        return [{ id: 1, host_id: 1, dir_path: '/var/log' }]
      }
      throw new Error(`unexpected path: ${path}`)
    })

    const snapshot = await fetchOverviewSnapshot({ host: '1', timeWindow: '24h' })
    expect(snapshot.monitoredHostName).toBe('local')
    expect(snapshot.kpis).toHaveLength(4)
    const activeAlertsKpi = snapshot.kpis.find((item) => item.key === 'activeAlerts')
    expect(activeAlertsKpi).toMatchObject({
      comparison: 'mom',
      delta: 2,
      trend: 'up',
    })
    expect(snapshot.trend).toHaveLength(2)
    expect(snapshot.trend.map((item) => item.alertCount)).toEqual([2, 1])
    expect(snapshot.alerts).toHaveLength(3)
    expect(snapshot.topology.nodes.length).toBeGreaterThan(1)
    expect(snapshot.degradedSources).toEqual([])
  })

  it('degrades gracefully when part of APIs fail', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return MOCK_HOSTS
      }
      if (path.startsWith('/api/monitoring/metrics')) {
        return [{ created_at: '2026-04-25T10:00:00Z', cpu_percent: 30, mem_percent: 20, disk_percent: 10 }]
      }
      if (path.startsWith('/api/alerts/events?')) {
        throw new Error('alerts down')
      }
      if (path === '/api/resources/processes?host_id=1') {
        return []
      }
      if (path === '/api/resources/ports?host_id=1') {
        return []
      }
      if (path === '/api/logs/sources') {
        return [{ id: 2, host_id: 1, dir_path: '/var/log/nginx' }]
      }
      throw new Error(`unexpected path: ${path}`)
    })

    const snapshot = await fetchOverviewSnapshot({ host: '1', level: 'critical', timeWindow: '24h' })
    expect(snapshot.alerts).toEqual([])
    expect(snapshot.degradedSources).toContain('alerts')
    expect(snapshot.trend).toHaveLength(1)
    expect(snapshot.topology.nodes.length).toBeGreaterThanOrEqual(1)
  })

  it('returns fallback structure with empty source data', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return []
      }
      if (
        path.startsWith('/api/monitoring/metrics') ||
        path.startsWith('/api/alerts/events?') ||
        path === '/api/logs/sources'
      ) {
        return []
      }
      throw new Error(`unexpected path: ${path}`)
    })

    const snapshot = await fetchOverviewSnapshot({ host: 'local', resourceType: 'all', timeWindow: '24h' })
    expect(snapshot.kpis).toHaveLength(4)
    expect(snapshot.trend).toEqual([])
    expect(snapshot.alerts).toEqual([])
    expect(snapshot.topology.nodes).toHaveLength(1)
    expect(snapshot.topology.links).toEqual([])
    expect(snapshot.logSources).toBe(0)

    const topology = await fetchResourceTopology({ host: 'local', resourceType: 'all', timeWindow: '24h' })
    expect(topology.nodes).toHaveLength(1)
    expect(topology.links).toEqual([])
  })

  it('throws when all core sources fail', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return MOCK_HOSTS
      }
      if (
        path.startsWith('/api/monitoring/metrics') ||
        path.startsWith('/api/alerts/events?') ||
        path === '/api/resources/processes?host_id=1' ||
        path === '/api/resources/ports?host_id=1'
      ) {
        throw new Error(`down: ${path}`)
      }
      if (path === '/api/logs/sources') {
        return []
      }
      throw new Error(`unexpected path: ${path}`)
    })

    await expect(fetchOverviewSnapshot({ host: '1', timeWindow: '24h' })).rejects.toThrow(
      'overview core sources unavailable',
    )
  })

  it('fetchResourceTopology only calls resource APIs', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return MOCK_HOSTS
      }
      if (path === '/api/resources/processes?host_id=1') {
        return [{ pid: 10, user: 'root', cpu: 1, mem: 2, cmd: 'node index.js' }]
      }
      if (path === '/api/resources/ports?host_id=1') {
        return [{ proto: 'tcp', local: '127.0.0.1:3000', state: 'LISTEN', pid_program: '10/node' }]
      }
      throw new Error(`unexpected path: ${path}`)
    })

    await fetchResourceTopology({ host: '1', resourceType: 'all', timeWindow: '24h' })

    const requestedPaths = apiMock.mock.calls.map(([p]) => p as string)
    expect(requestedPaths).toEqual(['/api/hosts', '/api/resources/processes?host_id=1', '/api/resources/ports?host_id=1'])
    expect(requestedPaths.some((p) => p.startsWith('/api/alerts/events'))).toBe(false)
    expect(requestedPaths.some((p) => p.startsWith('/api/monitoring/metrics'))).toBe(false)
    expect(requestedPaths).not.toContain('/api/logs/sources')
  })

  it('applies alert pipeline as merge -> sort -> filter -> limit', async () => {
    const warningRows = Array.from({ length: 25 }).map((_, idx) => ({
      id: `w-${idx}`,
      host: 'local',
      metric: 'cpu',
      level: 'warning',
      value: 70 + idx,
      threshold: 90,
      message: 'warning',
      resolved: false,
      created_at: `2026-04-25T10:${String(59 - idx).padStart(2, '0')}:00Z`,
    }))

    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return MOCK_HOSTS
      }
      if (path.startsWith('/api/monitoring/metrics')) {
        return [{ created_at: '2026-04-25T10:00:00Z', cpu_percent: 10, mem_percent: 20, disk_percent: 30 }]
      }
      if (path.startsWith('/api/alerts/events?')) {
        return [
          ...warningRows.slice(0, 20),
          ...warningRows.slice(20),
          {
            id: 'c-new',
            host: 'local',
            metric: 'mem',
            level: 'critical',
            value: 99,
            threshold: 90,
            message: 'critical new',
            resolved: false,
            created_at: '2026-04-25T10:58:30Z',
          },
          {
            id: 'c-old',
            host: 'local',
            metric: 'disk',
            level: 'critical',
            value: 97,
            threshold: 90,
            message: 'critical old',
            resolved: false,
            created_at: '2026-04-25T10:10:00Z',
          },
        ]
      }
      if (path === '/api/resources/processes?host_id=1') return []
      if (path === '/api/resources/ports?host_id=1') return []
      if (path === '/api/logs/sources') return []
      throw new Error(`unexpected path: ${path}`)
    })

    const snapshot = await fetchOverviewSnapshot({ host: '1', level: 'critical', timeWindow: '24h' })
    expect(snapshot.alerts.map((item) => item.id)).toEqual(['c-new', 'c-old'])
  })

  it('counts alerts per metric bucket with nearest timestamp alignment (non-cumulative) - alertCount time series', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/api/hosts') {
        return MOCK_HOSTS
      }
      if (path.startsWith('/api/monitoring/metrics')) {
        return [
          { created_at: '2026-04-25T10:00:00Z', cpu_percent: 10, mem_percent: 20, disk_percent: 30 },
          { created_at: '2026-04-25T10:05:00Z', cpu_percent: 20, mem_percent: 30, disk_percent: 40 },
          { created_at: '2026-04-25T10:10:00Z', cpu_percent: 30, mem_percent: 40, disk_percent: 50 },
        ]
      }
      if (path.startsWith('/api/alerts/events?')) {
        return [
          {
            id: 'a-1',
            host: 'local',
            metric: 'cpu',
            level: 'critical',
            value: 98,
            threshold: 90,
            message: 'a-1',
            resolved: false,
            created_at: '2026-04-25T10:01:00Z',
          },
          {
            id: 'a-2',
            host: 'local',
            metric: 'mem',
            level: 'warning',
            value: 91,
            threshold: 90,
            message: 'a-2',
            resolved: true,
            created_at: '2026-04-25T10:04:00Z',
          },
          {
            id: 'a-3',
            host: 'local',
            metric: 'disk',
            level: 'warning',
            value: 92,
            threshold: 90,
            message: 'a-3',
            resolved: true,
            created_at: '2026-04-25T10:09:00Z',
          },
          {
            id: 'a-4',
            host: 'local',
            metric: 'disk',
            level: 'warning',
            value: 93,
            threshold: 90,
            message: 'a-4',
            resolved: true,
            created_at: '2026-04-25T10:06:00Z',
          },
        ]
      }
      if (path === '/api/resources/processes?host_id=1') return []
      if (path === '/api/resources/ports?host_id=1') return []
      if (path === '/api/logs/sources') return []
      throw new Error(`unexpected path: ${path}`)
    })

    const snapshot = await fetchOverviewSnapshot({ host: '1', timeWindow: '24h' })
    expect(snapshot.trend.map((item) => item.timestamp)).toEqual([
      '2026-04-25T10:00:00Z',
      '2026-04-25T10:05:00Z',
      '2026-04-25T10:10:00Z',
    ])
    expect(snapshot.trend.map((item) => item.alertCount)).toEqual([1, 2, 1])
  })
})
