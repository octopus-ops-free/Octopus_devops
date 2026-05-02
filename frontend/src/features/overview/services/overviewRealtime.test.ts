import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createOverviewRealtimeClient } from './overviewRealtime'

class MockWebSocket {
  static instances: MockWebSocket[] = []

  url: string
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  emitOpen(): void {
    this.onopen?.(new Event('open'))
  }

  emitMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  emitError(): void {
    this.onerror?.(new Event('error'))
  }

  emitClose(init?: CloseEventInit): void {
    this.onclose?.(new CloseEvent('close', init))
  }

  close(): void {
    this.emitClose()
  }
}

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  emitOpen(): void {
    this.onopen?.(new Event('open'))
  }

  emitMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  emitError(): void {
    this.onerror?.(new Event('error'))
  }

  close(): void {
    return
  }
}

describe('overviewRealtime client', () => {
  const originalWebSocket = globalThis.WebSocket
  const originalEventSource = globalThis.EventSource

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    MockEventSource.instances = []
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: MockWebSocket })
    Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: MockEventSource })
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: originalWebSocket })
    Object.defineProperty(globalThis, 'EventSource', { configurable: true, value: originalEventSource })
  })

  it('prefers websocket when available', () => {
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
    })
    const listener = vi.fn()
    client.subscribe(listener)

    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockEventSource.instances).toHaveLength(0)

    MockWebSocket.instances[0].emitOpen()
    MockWebSocket.instances[0].emitMessage({ type: 'heartbeat' })
    expect(listener).toHaveBeenCalledWith({ type: 'heartbeat' })
  })

  it('uses default endpoints and falls back to sse on early websocket failure', () => {
    const client = createOverviewRealtimeClient()

    client.connect()

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('/api/overview/ws')
    expect(MockEventSource.instances).toHaveLength(0)

    MockWebSocket.instances[0].emitClose({ code: 1006, wasClean: false })

    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('/api/overview/events')
  })

  it('falls back to sse when websocket is unavailable', () => {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: undefined })
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
    })

    client.connect()
    expect(MockWebSocket.instances).toHaveLength(0)
    expect(MockEventSource.instances).toHaveLength(1)
  })

  function failCurrentWsAndSse(): void {
    const ws = MockWebSocket.instances.at(-1)
    expect(ws).toBeDefined()
    ws?.emitError()
    const sse = MockEventSource.instances.at(-1)
    expect(sse).toBeDefined()
    sse?.emitError()
  }

  it('auto reconnects with exponential backoff ladder and cap (1/2/4/8/30s)', () => {
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
      maxRetryDelayMs: 30000,
    })
    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)

    failCurrentWsAndSse()
    vi.advanceTimersByTime(999)
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(2)

    failCurrentWsAndSse()
    vi.advanceTimersByTime(1999)
    expect(MockWebSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(3)

    failCurrentWsAndSse()
    vi.advanceTimersByTime(3999)
    expect(MockWebSocket.instances).toHaveLength(3)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(4)

    failCurrentWsAndSse()
    vi.advanceTimersByTime(7999)
    expect(MockWebSocket.instances).toHaveLength(4)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(5)

    failCurrentWsAndSse()
    vi.advanceTimersByTime(16000)
    const wsCountBeforeCappedRetry = MockWebSocket.instances.length

    failCurrentWsAndSse()
    vi.advanceTimersByTime(29999)
    expect(MockWebSocket.instances).toHaveLength(wsCountBeforeCappedRetry)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(wsCountBeforeCappedRetry + 1)
  })

  it('applies deterministic jitter using Math.random', () => {
    vi.mocked(Math.random).mockReturnValue(0.5)
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
      maxRetryDelayMs: 30000,
    })

    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)

    failCurrentWsAndSse()
    vi.advanceTimersByTime(1249)
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('falls back to sse on websocket abnormal close without error', () => {
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
      maxRetryDelayMs: 30000,
    })

    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockEventSource.instances).toHaveLength(0)

    MockWebSocket.instances[0].emitClose({ code: 1006, wasClean: false })
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('does not create duplicate reconnect timers when sse errors repeatedly', () => {
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
      maxRetryDelayMs: 30000,
    })

    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)

    MockWebSocket.instances[0].emitError()
    expect(MockEventSource.instances).toHaveLength(1)

    MockEventSource.instances[0].emitError()
    MockEventSource.instances[0].emitError()

    vi.advanceTimersByTime(999)
    expect(MockWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('does not reconnect after manual disconnect', () => {
    const client = createOverviewRealtimeClient({
      wsUrl: 'ws://localhost/ws',
      sseUrl: '/events',
    })
    client.connect()
    expect(MockWebSocket.instances).toHaveLength(1)

    client.disconnect()
    MockWebSocket.instances[0].emitError()
    vi.advanceTimersByTime(30000)
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockEventSource.instances).toHaveLength(0)
  })
})
