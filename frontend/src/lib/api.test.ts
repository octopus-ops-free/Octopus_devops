import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  api,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
  type StoredTokens,
} from './api'

function setWindowLocationHrefWritable() {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
}

describe('api auth-client', () => {
  beforeEach(() => {
    setWindowLocationHrefWritable()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('injects Authorization header from stored accessToken', async () => {
    setStoredTokens({ accessToken: 'a1', refreshToken: 'r1', ts: 123 })

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers)
      expect(h.get('Authorization')).toBe('Bearer a1')
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const res = await api<{ ok: boolean }>('/api/health')
    expect(res.ok).toBe(true)
  })

  it('on 401 refreshes once then retries original request', async () => {
    setStoredTokens({ accessToken: 'old_access', refreshToken: 'refresh_1', ts: 1 })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/protected') {
        const auth = new Headers(init?.headers).get('Authorization')
        if (auth === 'Bearer old_access') {
          return new Response(JSON.stringify({ detail: 'expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (auth === 'Bearer new_access') {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }

      if (url === '/api/auth/refresh') {
        expect(init?.method).toBe('POST')
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null
        expect(body).toEqual({ refresh_token: 'refresh_1' })
        return new Response(
          JSON.stringify({ access_token: 'new_access', refresh_token: 'refresh_2' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      throw new Error('unexpected fetch: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const res = await api<{ ok: boolean }>('/api/protected')
    expect(res.ok).toBe(true)

    const stored = getStoredTokens() as StoredTokens
    expect(stored.accessToken).toBe('new_access')
    expect(stored.refreshToken).toBe('refresh_2')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('on 401 without refreshToken clears tokens and redirects to /ui-login', async () => {
    setStoredTokens({ accessToken: 'a1' })

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    await expect(api('/api/protected')).rejects.toThrow()
    expect(getStoredTokens()).toBeNull()
    expect(window.location.href).toBe('/ui-login')
  })

  it('if refresh fails clears tokens and redirects, without retrying original', async () => {
    setStoredTokens({ accessToken: 'old_access', refreshToken: 'refresh_1' })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/protected') {
        return new Response(JSON.stringify({ detail: 'expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/auth/refresh') {
        return new Response(JSON.stringify({ detail: 'bad refresh' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error('unexpected fetch: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock as any)

    await expect(api('/api/protected')).rejects.toThrow()
    expect(getStoredTokens()).toBeNull()
    expect(window.location.href).toBe('/ui-login')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('only retries once; if still 401 after retry, clears tokens and redirects', async () => {
    setStoredTokens({ accessToken: 'old_access', refreshToken: 'refresh_1' })

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/protected') {
        return new Response(JSON.stringify({ detail: 'still unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/auth/refresh') {
        return new Response(
          JSON.stringify({ access_token: 'new_access', refresh_token: 'refresh_2' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error('unexpected fetch: ' + url)
    })
    vi.stubGlobal('fetch', fetchMock as any)

    await expect(api('/api/protected')).rejects.toThrow()
    expect(getStoredTokens()).toBeNull()
    expect(window.location.href).toBe('/ui-login')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('clearStoredTokens removes token key', () => {
    setStoredTokens({ accessToken: 'a1', refreshToken: 'r1' })
    clearStoredTokens()
    expect(getStoredTokens()).toBeNull()
  })
})

