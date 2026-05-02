import type { OverviewSnapshot } from '../types'

export type OverviewRealtimeEvent =
  | { type: 'snapshot'; payload: OverviewSnapshot }
  | { type: 'delta'; payload: Partial<OverviewSnapshot> }
  | { type: 'heartbeat' }
  | { type: 'error'; payload: { message: string } }

export interface OverviewRealtimeClientOptions {
  wsUrl?: string
  sseUrl?: string
  maxRetryDelayMs?: number
}

export interface OverviewRealtimeClient {
  connect: () => void
  disconnect: () => void
  subscribe: (listener: (event: OverviewRealtimeEvent) => void) => () => void
}

const BASE_RETRY_DELAY_MS = 1000
const DEFAULT_MAX_RETRY_DELAY_MS = 30000

function getDefaultWsUrl(): string {
  return '/api/overview/ws'
}

function getDefaultSseUrl(): string {
  return '/api/overview/events'
}

function computeRetryDelay(attempt: number, maxRetryDelayMs: number): number {
  const baseDelay = Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempt), maxRetryDelayMs)
  const jitter = Math.floor(Math.random() * Math.min(1000, Math.floor(baseDelay / 2)))
  return Math.min(baseDelay + jitter, maxRetryDelayMs)
}

function parseRealtimeEvent(rawData: unknown): OverviewRealtimeEvent | null {
  if (typeof rawData !== 'string') return null

  try {
    const parsed = JSON.parse(rawData) as { type?: string; payload?: unknown }
    if (parsed.type === 'snapshot' && parsed.payload && typeof parsed.payload === 'object') {
      return { type: 'snapshot', payload: parsed.payload as OverviewSnapshot }
    }
    if (parsed.type === 'delta' && parsed.payload && typeof parsed.payload === 'object') {
      return { type: 'delta', payload: parsed.payload as Partial<OverviewSnapshot> }
    }
    if (parsed.type === 'heartbeat') {
      return { type: 'heartbeat' }
    }
    if (parsed.type === 'error') {
      const message =
        parsed.payload &&
        typeof parsed.payload === 'object' &&
        'message' in parsed.payload &&
        typeof (parsed.payload as { message?: unknown }).message === 'string'
          ? (parsed.payload as { message: string }).message
          : 'unknown_realtime_error'
      return { type: 'error', payload: { message } }
    }
    return null
  } catch {
    return null
  }
}

export function createOverviewRealtimeClient(
  options: OverviewRealtimeClientOptions = {},
): OverviewRealtimeClient {
  const wsUrl = options.wsUrl ?? getDefaultWsUrl()
  const sseUrl = options.sseUrl ?? getDefaultSseUrl()
  const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS

  let socket: WebSocket | null = null
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0
  let manuallyClosed = false
  const listeners = new Set<(event: OverviewRealtimeEvent) => void>()

  const emit = (event: OverviewRealtimeEvent): void => {
    listeners.forEach((listener) => listener(event))
  }

  const clearReconnectTimer = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const cleanupTransports = (): void => {
    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      socket.close()
      socket = null
    }
    if (eventSource) {
      eventSource.onopen = null
      eventSource.onmessage = null
      eventSource.onerror = null
      eventSource.close()
      eventSource = null
    }
  }

  const scheduleReconnect = (): void => {
    if (manuallyClosed || reconnectTimer) return
    emit({ type: 'error', payload: { message: 'reconnecting' } })
    const delay = computeRetryDelay(reconnectAttempt, maxRetryDelayMs)
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      startWithWebSocket()
    }, delay)
  }

  const handleIncomingMessage = (messageData: unknown): void => {
    const event = parseRealtimeEvent(messageData)
    if (event) {
      emit(event)
      return
    }
    emit({ type: 'error', payload: { message: 'invalid_event_payload' } })
  }

  const startWithSse = (): void => {
    if (manuallyClosed || typeof EventSource === 'undefined') {
      scheduleReconnect()
      return
    }

    if (eventSource) {
      eventSource.close()
    }
    eventSource = new EventSource(sseUrl)
    eventSource.onopen = () => {
      reconnectAttempt = 0
      emit({ type: 'heartbeat' })
    }
    eventSource.onmessage = (event) => {
      handleIncomingMessage(event.data)
    }
    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      scheduleReconnect()
    }
  }

  const startWithWebSocket = (): void => {
    if (manuallyClosed) return
    clearReconnectTimer()
    cleanupTransports()

    if (typeof WebSocket === 'undefined') {
      startWithSse()
      return
    }

    try {
      socket = new WebSocket(wsUrl)
    } catch {
      startWithSse()
      return
    }

    let failedOver = false
    const failoverToSse = (): void => {
      if (failedOver || manuallyClosed) return
      failedOver = true
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        socket.close()
        socket = null
      }
      startWithSse()
    }

    let hasOpened = false

    socket.onopen = () => {
      hasOpened = true
      reconnectAttempt = 0
      emit({ type: 'heartbeat' })
    }
    socket.onmessage = (event) => {
      handleIncomingMessage(event.data)
    }
    socket.onerror = () => {
      failoverToSse()
    }
    socket.onclose = (event) => {
      if (failedOver || manuallyClosed) {
        return
      }

      const earlyFailure = !hasOpened
      const abnormalClose = !event.wasClean || event.code !== 1000
      if (earlyFailure || abnormalClose) {
        failoverToSse()
        return
      }

      if (!failedOver) {
        scheduleReconnect()
      }
    }
  }

  return {
    connect: () => {
      manuallyClosed = false
      reconnectAttempt = 0
      startWithWebSocket()
    },
    disconnect: () => {
      manuallyClosed = true
      clearReconnectTimer()
      cleanupTransports()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
