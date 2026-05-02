import { useEffect, useState } from 'react'

import type { OverviewDataState, OverviewFilters } from '../types'
import { fetchOverviewSnapshot } from '../services/overviewApi'
import { createOverviewRealtimeClient } from '../services/overviewRealtime'

const DEFAULT_FILTERS: OverviewFilters = { host: '1', timeWindow: '24h', resourceType: 'all' }
const INITIAL_FETCH_RETRY_DELAYS_MS = [300, 900] as const

function applySnapshotDelta(state: OverviewDataState, delta: Partial<NonNullable<OverviewDataState['snapshot']>>): OverviewDataState {
  if (!state.snapshot) return state
  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      ...delta,
      topology: delta.topology
        ? {
            ...state.snapshot.topology,
            ...delta.topology,
          }
        : state.snapshot.topology,
    },
  }
}

export function useOverviewData(): OverviewDataState {
  const [state, setState] = useState<OverviewDataState>({
    snapshot: null,
    loading: true,
    error: null,
    connectionStatus: 'idle',
  })

  useEffect(() => {
    let cancelled = false
    const realtime = createOverviewRealtimeClient()

    const unsubscribe = realtime.subscribe((event) => {
      if (cancelled) return
      if (event.type === 'snapshot') {
        setState((prev) => ({
          ...prev,
          snapshot: event.payload,
          loading: false,
          error: null,
          connectionStatus: 'connected',
        }))
        return
      }
      if (event.type === 'delta') {
        setState((prev) => ({
          ...applySnapshotDelta(prev, event.payload),
          loading: false,
          error: null,
          connectionStatus: 'connected',
        }))
        return
      }
      if (event.type === 'heartbeat') {
        setState((prev) => ({
          ...prev,
          connectionStatus: prev.snapshot ? 'connected' : prev.connectionStatus,
        }))
        return
      }
      if (event.type === 'error') {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: event.payload.message,
          connectionStatus: prev.snapshot ? 'reconnecting' : 'disconnected',
        }))
      }
    })

    const loadInitialSnapshot = async () => {
      let attempt = 0
      while (true) {
        try {
          return await fetchOverviewSnapshot(DEFAULT_FILTERS)
        } catch (error) {
          if (attempt >= INITIAL_FETCH_RETRY_DELAYS_MS.length) {
            throw error
          }
          const delay = INITIAL_FETCH_RETRY_DELAYS_MS[attempt]
          attempt += 1
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    loadInitialSnapshot()
      .then((snapshot) => {
        if (cancelled) return
        setState({
          snapshot,
          loading: false,
          error: null,
          connectionStatus: 'snapshot-only',
        })
        realtime.connect()
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState((prev) => ({
          snapshot: prev.snapshot,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load overview data',
          connectionStatus: prev.snapshot ? 'reconnecting' : 'disconnected',
        }))
      })

    return () => {
      cancelled = true
      unsubscribe()
      realtime.disconnect()
    }
  }, [])

  return state
}
