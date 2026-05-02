const TOKEN_STORAGE_KEY = "octopus_tokens_v1"

export type StoredTokens = { accessToken: string; refreshToken?: string; ts?: number }

export function getStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredTokens
  } catch {
    return null
  }
}

export function setStoredTokens(tokens: StoredTokens): void {
  localStorage.setItem(
    TOKEN_STORAGE_KEY,
    JSON.stringify({ ...tokens, ts: tokens.ts ?? Date.now() }),
  )
}

export function clearStoredTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function redirectToLogin(): void {
  try {
    window.location.href = "/ui-login"
  } catch {
    // ignore (e.g. during tests / non-browser environments)
  }
}

type ApiRequestInit = RequestInit & { __retried?: boolean }

async function readJsonOrText(resp: Response): Promise<unknown> {
  const raw = await resp.text()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens | null> {
  try {
    const resp = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const data = (await readJsonOrText(resp)) as any
    if (!resp.ok) return null
    if (data && data.access_token && data.refresh_token) {
      return {
        accessToken: String(data.access_token),
        refreshToken: String(data.refresh_token),
        ts: Date.now(),
      }
    }
    return null
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    const tokens = getStoredTokens()
    if (tokens?.accessToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => {})
    }
  } catch {
    // ignore
  }
  clearStoredTokens()
  redirectToLogin()
}

export async function api<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const tokens = getStoredTokens()
  const headers = new Headers(init.headers)

  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`)
  }

  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json")
  }

  const resp = await fetch(path, { ...init, headers })
  const data = (await readJsonOrText(resp)) as T

  if (!resp.ok && resp.status === 401) {
    if (tokens?.refreshToken && !init.__retried) {
      const refreshed = await refreshAccessToken(tokens.refreshToken)
      if (refreshed) {
        setStoredTokens(refreshed)
        return await api<T>(path, { ...init, __retried: true })
      }
    }
    clearStoredTokens()
    redirectToLogin()
  }

  if (!resp.ok) {
    const detail = (data as any)?.detail ?? resp.statusText
    throw new Error(String(detail))
  }

  return data
}