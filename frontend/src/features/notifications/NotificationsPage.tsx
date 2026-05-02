import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

type SmtpSettings = {
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password?: string
  smtp_from: string
  use_tls: boolean
}

const DEFAULT_SETTINGS: SmtpSettings = {
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_from: '',
  use_tls: true,
}

export function NotificationsPage() {
  const [status, setStatus] = useState<string>('加载中...')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<SmtpSettings>(DEFAULT_SETTINGS)

  const [testTo, setTestTo] = useState('')
  const [testStatus, setTestStatus] = useState<string>('')
  const [testing, setTesting] = useState(false)

  async function loadSmtp() {
    setLoading(true)
    setStatus('加载中...')
    try {
      const data = (await api<Partial<SmtpSettings> | null>('/api/notifications/smtp')) ?? {}
      setForm({
        smtp_host: String(data.smtp_host ?? ''),
        smtp_port: Number(data.smtp_port ?? 587),
        smtp_username: String(data.smtp_username ?? ''),
        // 不回显已有密码；仅当用户输入时才提交更新
        smtp_password: '',
        smtp_from: String(data.smtp_from ?? ''),
        use_tls: Boolean(data.use_tls ?? true),
      })
      setStatus('已加载 SMTP 配置')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSmtp()
  }, [])

  const canSave = useMemo(() => {
    if (!form.smtp_host.trim()) return false
    if (!Number.isFinite(form.smtp_port) || form.smtp_port <= 0) return false
    if (!form.smtp_from.trim()) return false
    return true
  }, [form.smtp_from, form.smtp_host, form.smtp_port])

  async function saveSmtp() {
    if (saving) return
    if (!canSave) return
    setSaving(true)
    setStatus('保存中...')
    try {
      const body: Record<string, unknown> = {
        smtp_host: form.smtp_host.trim(),
        smtp_port: Number(form.smtp_port),
        smtp_username: form.smtp_username,
        smtp_from: form.smtp_from.trim(),
        use_tls: Boolean(form.use_tls),
      }
      if (form.smtp_password) {
        body.smtp_password = form.smtp_password
      }

      await api<unknown>('/api/notifications/smtp', { method: 'PUT', body: JSON.stringify(body) })
      setStatus('保存成功')
      setForm((p) => ({ ...p, smtp_password: '' }))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('保存失败：' + message)
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    const to = testTo.trim()
    if (!to) return
    if (testing) return
    setTesting(true)
    setTestStatus('发送中...')
    try {
      const qs = new URLSearchParams({ to })
      const res = await api<any>(`/api/notifications/smtp/test?${qs.toString()}`, { method: 'POST' })
      const msg = res?.message ?? res?.detail ?? res?.ok ?? ''
      setTestStatus(msg ? `发送结果：${String(msg)}` : '发送完成')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setTestStatus('发送失败：' + message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>通知</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>{status}</div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>SMTP 配置</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <label style={label}>
            smtp_host
            <input
              aria-label="smtp_host"
              value={form.smtp_host}
              onChange={(e) => setForm((p) => ({ ...p, smtp_host: e.target.value }))}
              style={input}
              placeholder="smtp.example.com"
            />
          </label>

          <label style={label}>
            smtp_port
            <input
              aria-label="smtp_port"
              value={String(form.smtp_port)}
              onChange={(e) => {
                const n = Number(e.target.value)
                setForm((p) => ({ ...p, smtp_port: Number.isFinite(n) ? n : p.smtp_port }))
              }}
              style={input}
              inputMode="numeric"
              placeholder="587"
            />
          </label>

          <label style={label}>
            smtp_username
            <input
              aria-label="smtp_username"
              value={form.smtp_username}
              onChange={(e) => setForm((p) => ({ ...p, smtp_username: e.target.value }))}
              style={input}
              placeholder="username"
            />
          </label>

          <label style={label}>
            smtp_password（留空则不更新）
            <input
              aria-label="smtp_password"
              type="password"
              value={form.smtp_password ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, smtp_password: e.target.value }))}
              style={input}
              placeholder="••••••••"
            />
          </label>

          <label style={label}>
            smtp_from
            <input
              aria-label="smtp_from"
              value={form.smtp_from}
              onChange={(e) => setForm((p) => ({ ...p, smtp_from: e.target.value }))}
              style={input}
              placeholder="noreply@example.com"
            />
          </label>

          <label style={labelInline}>
            use_tls
            <input
              aria-label="use_tls"
              type="checkbox"
              checked={Boolean(form.use_tls)}
              onChange={(e) => setForm((p) => ({ ...p, use_tls: e.target.checked }))}
              style={{ width: 18, height: 18 }}
            />
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={saveSmtp} disabled={!canSave || saving} style={button}>
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={loadSmtp} disabled={loading} style={buttonSecondary}>
            {loading ? '刷新中...' : '重新加载'}
          </button>
          {!canSave && <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>至少需要 smtp_host、smtp_port、smtp_from</span>}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>测试发送</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ ...label, minWidth: 320 }}>
            to
            <input
              aria-label="test_to"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              style={input}
              placeholder="to@example.com"
            />
          </label>
          <button onClick={sendTest} disabled={!testTo.trim() || testing} style={buttonSecondary}>
            {testing ? '发送中...' : '发送测试邮件'}
          </button>
        </div>
        {testStatus && <div style={{ marginTop: 10, color: 'var(--text-soft)', fontSize: 12 }}>{testStatus}</div>}
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: 'var(--text-soft)',
}

const labelInline: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  fontSize: 12,
  color: 'var(--text-soft)',
}

const input: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  fontSize: 13,
}

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'var(--shell-surface-raised)',
  color: 'var(--heading)',
  fontWeight: 800,
  cursor: 'pointer',
}

const buttonSecondary: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  cursor: 'pointer',
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--shell-border-medium)',
  borderRadius: 12,
  marginBottom: 16,
  background: 'var(--shell-surface)',
}

