import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OverviewRealtimeEvent } from '../services/overviewRealtime'
import type { OverviewSnapshot } from '../types'
import { useOverviewData } from './useOverviewData'

const fetchOverviewSnapshotMock = vi.fn()
const connectMock = vi.fn()
const disconnectMock = vi.fn()
let realtimeListener: ((event: OverviewRealtimeEvent) => void) | null = null

vi.mock('../services/overviewApi', () => ({
  fetchOverviewSnapshot: (...args: unknown[]) => fetchOverviewSnapshotMock(...args),
}))

vi.mock('../services/overviewRealtime', () => ({
  createOverviewRealtimeClient: () => ({
    connect: connectMock,
    disconnect: disconnectMock,
    subscribe: (listener: (event: OverviewRealtimeEvent) => void) => {
      realtimeListener = listener
      return () => {
        realtimeListener = null
      }
    },
  }),
}))

function emitRealtime(event: OverviewRealtimeEvent): void {
  if (realtimeListener) {
    realtimeListener(event)
  }
}

function createSnapshot(): OverviewSnapshot {
  return {
    updatedAt: '2026-04-26T00:00:00Z',
    monitoredHostId: '1',
    monitoredHostName: 'local',
    monitoredHostIp: '127.0.0.1',
    kpis: [],
    trend: [],
    alerts: [],
    topology: { nodes: [], links: [] },
    logSources: 0,
    degradedSources: [],
  }
}

describe('useOverviewData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchOverviewSnapshotMock.mockReset()
    connectMock.mockReset()
    disconnectMock.mockReset()
    realtimeListener = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses host=1 by default and retries twice with 300ms/900ms backoff', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const snapshot = createSnapshot()
    fetchOverviewSnapshotMock
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce(snapshot)

    const { result } = renderHook(() => useOverviewData())
    expect(result.current.loading).toBe(true)
    expect(result.current.connectionStatus).toBe('idle')
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(fetchOverviewSnapshotMock).toHaveBeenCalledTimes(3)
    expect(fetchOverviewSnapshotMock.mock.calls[0][0]).toMatchObject({ host: '1', timeWindow: '24h' })
    expect(fetchOverviewSnapshotMock.mock.calls[1][0]).toMatchObject({ host: '1', timeWindow: '24h' })
    expect(fetchOverviewSnapshotMock.mock.calls[2][0]).toMatchObject({ host: '1', timeWindow: '24h' })
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 900)

    expect(result.current.snapshot).toEqual(snapshot)
    expect(result.current.loading).toBe(false)
    expect(result.current.connectionStatus).toBe('snapshot-only')
    expect(connectMock).toHaveBeenCalledTimes(1)
  })

  it('becomes disconnected after retry exhaustion when no snapshot exists', async () => {
    fetchOverviewSnapshotMock.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useOverviewData())
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(fetchOverviewSnapshotMock).toHaveBeenCalledTimes(3)

    expect(result.current.snapshot).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.connectionStatus).toBe('disconnected')
    expect(result.current.error).toBe('network down')
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('keeps snapshot and marks reconnecting after retry exhaustion', async () => {
    const snapshot = createSnapshot()
    fetchOverviewSnapshotMock.mockRejectedValue(new Error('initial fetch failed'))

    const { result } = renderHook(() => useOverviewData())
    act(() => {
      emitRealtime({ type: 'snapshot', payload: snapshot })
    })
    expect(result.current.connectionStatus).toBe('connected')
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(fetchOverviewSnapshotMock).toHaveBeenCalledTimes(3)

    expect(result.current.snapshot).toEqual(snapshot)
    expect(result.current.loading).toBe(false)
    expect(result.current.connectionStatus).toBe('reconnecting')
    expect(result.current.error).toBe('initial fetch failed')
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('disconnects realtime client on unmount', async () => {
    fetchOverviewSnapshotMock.mockResolvedValue(createSnapshot())

    const { unmount } = renderHook(() => useOverviewData())
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    unmount()
    expect(disconnectMock).toHaveBeenCalledTimes(1)
  })
})
