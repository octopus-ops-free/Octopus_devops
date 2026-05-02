import { useState } from 'react'

const TOKEN_STORAGE_KEY = 'octopus_tokens_v1'
const USERNAME_STORAGE_KEY = 'octopus_username_v1'

type LoginResponse = {
  access_token: string
  refresh_token?: string
}

function saveTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(
    TOKEN_STORAGE_KEY,
    JSON.stringify({ accessToken, refreshToken, ts: Date.now() }),
  )
}

function clearTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function saveUsername(u: string) {
  localStorage.setItem(USERNAME_STORAGE_KEY, u)
}

export function LoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

 async function doLogin() {
    const u = username.trim()
    const p = password
    if (!u || !p) {
      setStatus('请输入用户名和密码')
      return
    }

    setLoading(true)
    setStatus('登录中...')

    try {
      const form = new URLSearchParams()
      form.append('username', u)
      form.append('password', p)

      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      })

      const data = (await resp.json()) as LoginResponse & { detail?: unknown }
      if (!resp.ok) {
        const detail = (data as { detail?: unknown }).detail
        throw new Error(
          typeof detail === 'string' && detail.length > 0
            ? detail
            : resp.statusText,
        )
      }

      saveTokens(data.access_token, data.refresh_token)
      saveUsername(u)
      setStatus('登录成功，正在跳转...')
      window.location.href = '/ui'
    } catch (e: unknown) {
      clearTokens()
      const message = e instanceof Error ? e.message : String(e)
      setStatus('登录失败：' + message)
    } finally {
      setLoading(false)
    }
 }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={header}>
          <div style={logo} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Octopus Ops</h1>
            <div style={{ color: '#9cadc7', fontSize: 13 }}>DevOps Platform Login</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={label}>
            用户名
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={input}
            />
          </label>

          <label style={label}>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doLogin()
              }}
              style={input}
            />
          </label>

          <button onClick={doLogin} disabled={loading} style={button}>
            {loading ? '登录中...' : '登录'}
          </button>

          <div style={{ color: '#9cadc7', fontSize: 13, minHeight: 20 }}>{status}</div>
        </div>
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
}

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 460,
  borderRadius: 16,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  padding: 18,
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
}

const logo: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: 'var(--shell-brand-mark)',
  boxShadow: 'inset 0 1px 0 var(--shell-inset)',
  border: '1px solid var(--shell-border-medium)',
}

const label: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: '#9cadc7',
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
}

const button: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'var(--shell-surface-raised)',
  color: 'var(--heading)',
  fontWeight: 800,
  cursor: 'pointer',
}