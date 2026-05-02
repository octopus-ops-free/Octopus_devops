import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceTopologyGraph } from './ResourceTopologyGraph'
import type { OverviewSnapshot } from '../types'

const setOptionMock = vi.fn()
const onMock = vi.fn()
const offMock = vi.fn()
const resizeMock = vi.fn()
const disposeMock = vi.fn()
const zrOnMock = vi.fn()
const zrOffMock = vi.fn()

const chartEventHandlers = new Map<string, (event: any) => void>()
const zrEventHandlers = new Map<string, (event: any) => void>()

vi.mock('../assets/iconMap', () => ({
  getOverviewIcon: (name: string) => `/icons/${name}.png`,
}))

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: setOptionMock,
    on: (eventName: string, handler: (event: any) => void) => {
      chartEventHandlers.set(eventName, handler)
      onMock(eventName, handler)
    },
    off: (eventName: string, handler: (event: any) => void) => {
      chartEventHandlers.delete(eventName)
      offMock(eventName, handler)
    },
    getZr: () => ({
      on: (eventName: string, handler: (event: any) => void) => {
        zrEventHandlers.set(eventName, handler)
        zrOnMock(eventName, handler)
      },
      off: (eventName: string, handler: (event: any) => void) => {
        zrEventHandlers.delete(eventName)
        zrOffMock(eventName, handler)
      },
    }),
    resize: resizeMock,
    dispose: disposeMock,
  })),
}))

function buildSnapshot(): OverviewSnapshot {
  return {
    updatedAt: '2026-04-25T10:00:00Z',
    monitoredHostId: '1',
    monitoredHostName: 'local',
    monitoredHostIp: '127.0.0.1',
    kpis: [],
    trend: [],
    alerts: [],
    topology: {
      nodes: [
        { id: 'host:local', name: 'local', type: 'host', status: 'healthy' },
        { id: 'proc:1', name: 'mysql', type: 'database', status: 'critical' },
        { id: 'proc:2', name: 'pod-agent', type: 'container', status: 'warning' },
        { id: 'port:1', name: 'tcp/0.0.0.0:80', type: 'network', status: 'healthy' },
      ],
      links: [
        { source: 'host:local', target: 'proc:1', kind: 'contains', status: 'critical' },
        { source: 'host:local', target: 'proc:2', kind: 'contains', status: 'warning' },
        { source: 'host:local', target: 'port:1', kind: 'listens', status: 'healthy' },
      ],
    },
    logSources: 0,
    degradedSources: [],
  }
}

describe('ResourceTopologyGraph', () => {
  beforeEach(() => {
    setOptionMock.mockClear()
    onMock.mockClear()
    offMock.mockClear()
    zrOnMock.mockClear()
    zrOffMock.mockClear()
    resizeMock.mockClear()
    disposeMock.mockClear()
    chartEventHandlers.clear()
    zrEventHandlers.clear()
  })

  it('updates graph option when filter states change', async () => {
    render(<ResourceTopologyGraph snapshot={buildSnapshot()} />)

    await waitFor(() => expect(setOptionMock).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('资源类型筛选'), { target: { value: 'database' } })
    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const names = option?.series?.[0]?.data?.map((item: { name: string }) => item.name) ?? []
      expect(names).toEqual(expect.arrayContaining(['local', 'mysql']))
      expect(names).not.toContain('pod-agent')
    })

    fireEvent.change(screen.getByLabelText('资源级别筛选'), { target: { value: 'fault' } })
    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const names = option?.series?.[0]?.data?.map((item: { name: string }) => item.name) ?? []
      expect(names).toEqual(expect.arrayContaining(['local', 'mysql']))
      expect(names).not.toContain('tcp/0.0.0.0:80')
    })
  })

  it('updates highlight state when hovering node', async () => {
    render(<ResourceTopologyGraph snapshot={buildSnapshot()} />)

    await waitFor(() => expect(chartEventHandlers.get('mouseover')).toBeTypeOf('function'))

    chartEventHandlers.get('mouseover')?.({
      dataType: 'node',
      data: { id: 'proc:1' },
    })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const mysql = nodes.find((item: { id: string }) => item.id === 'proc:1')
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(mysql?.itemStyle?.opacity).toBe(1)
      expect(network?.itemStyle?.opacity).toBe(0.2)
    })
  })

  it('pins highlight on click and ignores hover changes', async () => {
    render(<ResourceTopologyGraph snapshot={buildSnapshot()} />)

    await waitFor(() => expect(chartEventHandlers.get('click')).toBeTypeOf('function'))

    chartEventHandlers.get('click')?.({
      dataType: 'node',
      data: { id: 'proc:1' },
    })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const mysql = nodes.find((item: { id: string }) => item.id === 'proc:1')
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(mysql?.itemStyle?.opacity).toBe(1)
      expect(network?.itemStyle?.opacity).toBe(0.2)
    })

    chartEventHandlers.get('mouseover')?.({
      dataType: 'node',
      data: { id: 'port:1' },
    })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const mysql = nodes.find((item: { id: string }) => item.id === 'proc:1')
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(mysql?.itemStyle?.opacity).toBe(1)
      expect(network?.itemStyle?.opacity).toBe(0.2)
    })
  })

  it('clears pinned highlight when clicking same node again or blank canvas', async () => {
    render(<ResourceTopologyGraph snapshot={buildSnapshot()} />)

    await waitFor(() => {
      expect(chartEventHandlers.get('click')).toBeTypeOf('function')
      expect(zrEventHandlers.get('click')).toBeTypeOf('function')
    })

    chartEventHandlers.get('click')?.({
      dataType: 'node',
      data: { id: 'proc:1' },
    })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(network?.itemStyle?.opacity).toBe(0.2)
    })

    chartEventHandlers.get('click')?.({
      dataType: 'node',
      data: { id: 'proc:1' },
    })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(network?.itemStyle?.opacity).toBe(1)
    })

    chartEventHandlers.get('click')?.({
      dataType: 'node',
      data: { id: 'proc:1' },
    })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(network?.itemStyle?.opacity).toBe(0.2)
    })

    zrEventHandlers.get('click')?.({ target: undefined })

    await waitFor(() => {
      const [option] = setOptionMock.mock.calls.at(-1) ?? []
      const nodes = option?.series?.[0]?.data ?? []
      const network = nodes.find((item: { id: string }) => item.id === 'port:1')
      expect(network?.itemStyle?.opacity).toBe(1)
    })
  })
})
