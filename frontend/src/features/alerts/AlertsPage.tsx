import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

type AlertEvent = {
  id: number | string
  host: string
  metric: string
  level: string
  value: number | string
  message?: string | null
  created_at: string
  resolved?: boolean | null
}

type AlertTrigger = {
  id: number | string
  host: string
  metric: string
  op: string
  value: number
  level: string
  description?: string | null
  email_to?: string | null
}

type Host = { id: number; name: string }

type TabKey = 'events' | 'history' | 'triggers'

const METRICS = ['cpu', 'mem', 'disk'] as const
const OPS = ['>', '>=', '<', '<=', '==', '!='] as const
const LEVELS = ['info', 'warning', 'critical'] as const

export function AlertsPage() {
  const [tab, setTab] = useState<TabKey>('events')

  const [status, setStatus] = useState<string>('')

  const [events, setEvents] = useState<AlertEvent[]>([])
  const [history, setHistory] = useState<AlertEvent[]>([])
  const [triggers, setTriggers] = useState<AlertTrigger[]>([])
  const [hosts, setHosts] = useState<Host[]>([])

  const hostOptions = useMemo(() => {
    const names = hosts.map((h) => h.name).filter(Boolean)
    return ['local', ...names]
  }, [hosts])

  const [triggerForm, setTriggerForm] = useState<{
    host: string
    metric: (typeof METRICS)[number]
    op: (typeof OPS)[number]
    value: string
    level: (typeof LEVELS)[number]
    description: string
    email_to: string
  }>({
    host: 'local',
    metric: 'cpu',
    op: '>',
    value: '80',
    level: 'warning',
    description: '',
    email_to: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<string>('')

  function setTriggerField<K extends keyof typeof triggerForm>(key: K, value: (typeof triggerForm)[K]) {
    setTriggerForm((prev) => ({ ...prev, [key]: value }))
  }

  function formatResolved(ev: AlertEvent): string {
    if (ev.resolved === true) return '是'
    if (ev.resolved === false) return '否'
    return ''
  }

  async function loadEvents() {
    setStatus('加载中...')
    try {
      const data = await api<AlertEvent[]>('/api/alerts/events?limit=50')
      setEvents(Array.isArray(data) ? data : [])
      setStatus(`活动告警：${Array.isArray(data) ? data.length : 0}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
    }
  }

  async function loadHistory() {
    setStatus('加载中...')
    try {
      const data = await api<AlertEvent[]>('/api/alerts/events/history?limit=200')
      setHistory(Array.isArray(data) ? data : [])
      setStatus(`历史告警：${Array.isArray(data) ? data.length : 0}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
    }
  }

  async function loadTriggers() {
    setStatus('加载中...')
    try {
      const data = await api<AlertTrigger[]>('/api/alerts/triggers')
      setTriggers(Array.isArray(data) ? data : [])
      setStatus(`告警规则：${Array.isArray(data) ? data.length : 0}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
    }
  }

  async function loadHosts() {
    try {
      const data = await api<Host[]>('/api/hosts')
      setHosts(Array.isArray(data) ? data : [])
    } catch {
      // ignore: host 下拉不影响其他功能
      setHosts([])
    }
  }

  useEffect(() => {
    if (tab === 'events') void loadEvents()
    if (tab === 'history') void loadHistory()
    if (tab === 'triggers') {
      void loadTriggers()
      void loadHosts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function completeEvent(id: AlertEvent['id']) {
    setStatus('操作中...')
    try {
      await api<unknown>(`/api/alerts/events/${encodeURIComponent(String(id))}/complete`, { method: 'POST' })
      await loadEvents()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('操作失败：' + message)
    }
  }

  const canCreateTrigger = useMemo(() => {
    const v = Number(triggerForm.value)
    if (!Number.isFinite(v)) return false
    if (!triggerForm.host.trim()) return false
    if (!triggerForm.op.trim()) return false
    if (!triggerForm.metric.trim()) return false
    if (!triggerForm.level.trim()) return false
    return true
  }, [triggerForm])

  function buildTriggerPayload() {
    return {
      host: triggerForm.host.trim(),
      metric: triggerForm.metric,
      op: triggerForm.op,
      value: Number(triggerForm.value),
      level: triggerForm.level,
      description: triggerForm.description.trim(),
      email_to: triggerForm.email_to.trim(),
    }
  }

  async function createTrigger() {
    if (!canCreateTrigger || submitting) return
    setSubmitting(true)
    setStatus('创建中...')
    try {
      await api<AlertTrigger>('/api/alerts/triggers', { method: 'POST', body: JSON.stringify(buildTriggerPayload()) })
      setStatus('创建成功')
      setTestResult('')
      await loadTriggers()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('创建失败：' + message)
    } finally {
      setSubmitting(false)
    }
  }

  async function testTrigger() {
    if (!canCreateTrigger || submitting) return
    setSubmitting(true)
    setTestResult('测试中...')
    try {
      const res = await api<unknown>('/api/alerts/triggers/test', {
        method: 'POST',
        body: JSON.stringify(buildTriggerPayload()),
      })
      const msg =
        typeof res === 'string'
          ? res
          : (res as any)?.message
            ? String((res as any).message)
            : JSON.stringify(res)
      setTestResult(msg)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setTestResult('测试失败：' + message)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTrigger(id: AlertTrigger['id']) {
    const ok = window.confirm(`确认删除规则 #${id} 吗？`)
    if (!ok) return
    setStatus('删除中...')
    try {
      await api<unknown>(`/api/alerts/triggers/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
      await loadTriggers()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('删除失败：' + message)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>告警</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>{status}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('events')} style={tabButton(tab === 'events')}>
          活动告警
        </button>
        <button onClick={() => setTab('history')} style={tabButton(tab === 'history')}>
          历史
        </button>
        <button onClick={() => setTab('triggers')} style={tabButton(tab === 'triggers')}>
          规则
        </button>
      </div>

      {tab === 'events' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Host</th>
                <th style={th}>Metric</th>
                <th style={th}>Level</th>
                <th style={th}>Value</th>
                <th style={th}>Message</th>
                <th style={th}>Created</th>
                <th style={th}>Resolved</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={String(ev.id)}>
                  <td style={td}>{String(ev.id)}</td>
                  <td style={td}>{ev.host}</td>
                  <td style={td}>{ev.metric}</td>
                  <td style={td}>{ev.level}</td>
                  <td style={td}>{String(ev.value)}</td>
                  <td style={td}>{ev.message ?? ''}</td>
                  <td style={td}>{ev.created_at}</td>
                  <td style={td}>{formatResolved(ev)}</td>
                  <td style={td}>
                    {ev.resolved ? (
                      <span style={{ color: '#6b7280', fontSize: 12 }}>已完成</span>
                    ) : (
                      <button onClick={() => completeEvent(ev.id)} style={buttonSecondary}>
                        complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td style={td} colSpan={9}>
                    暂无活动告警
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Host</th>
                <th style={th}>Metric</th>
                <th style={th}>Level</th>
                <th style={th}>Value</th>
                <th style={th}>Message</th>
                <th style={th}>Created</th>
                <th style={th}>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {history.map((ev) => (
                <tr key={String(ev.id)}>
                  <td style={td}>{String(ev.id)}</td>
                  <td style={td}>{ev.host}</td>
                  <td style={td}>{ev.metric}</td>
                  <td style={td}>{ev.level}</td>
                  <td style={td}>{String(ev.value)}</td>
                  <td style={td}>{ev.message ?? ''}</td>
                  <td style={td}>{ev.created_at}</td>
                  <td style={td}>{formatResolved(ev)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
                    暂无历史告警
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'triggers' && (
        <div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>新增规则</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={label}>
                Host
                <select value={triggerForm.host} onChange={(e) => setTriggerField('host', e.target.value)} style={input}>
                  {hostOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Metric
                <select
                  value={triggerForm.metric}
                  onChange={(e) => setTriggerField('metric', e.target.value as any)}
                  style={input}
                >
                  {METRICS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Op
                <select value={triggerForm.op} onChange={(e) => setTriggerField('op', e.target.value as any)} style={input}>
                  {OPS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Value
                <input value={triggerForm.value} onChange={(e) => setTriggerField('value', e.target.value)} style={input} />
              </label>
              <label style={label}>
                Level
                <select
                  value={triggerForm.level}
                  onChange={(e) => setTriggerField('level', e.target.value as any)}
                  style={input}
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </label>
              <label style={label}>
                Email to
                <input
                  value={triggerForm.email_to}
                  onChange={(e) => setTriggerField('email_to', e.target.value)}
                  style={input}
                  placeholder="a@b.com"
                />
              </label>
              <label style={{ ...label, gridColumn: '1 / -1' }}>
                Description
                <input
                  value={triggerForm.description}
                  onChange={(e) => setTriggerField('description', e.target.value)}
                  style={input}
                  placeholder="规则描述"
                />
              </label>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={createTrigger} disabled={!canCreateTrigger || submitting} style={button}>
                {submitting ? '提交中...' : '创建规则'}
              </button>
              <button onClick={testTrigger} disabled={!canCreateTrigger || submitting} style={buttonSecondary}>
                test trigger
              </button>
              {!canCreateTrigger && <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>请填写 host/op/value/level</span>}
              {testResult && <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>结果：{testResult}</span>}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>ID</th>
                  <th style={th}>Host</th>
                  <th style={th}>Metric</th>
                  <th style={th}>Op</th>
                  <th style={th}>Value</th>
                  <th style={th}>Level</th>
                  <th style={th}>Description</th>
                  <th style={th}>Email</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((t) => (
                  <tr key={String(t.id)}>
                    <td style={td}>{String(t.id)}</td>
                    <td style={td}>{t.host}</td>
                    <td style={td}>{t.metric}</td>
                    <td style={td}>{t.op}</td>
                    <td style={td}>{String(t.value)}</td>
                    <td style={td}>{t.level}</td>
                    <td style={td}>{t.description ?? ''}</td>
                    <td style={td}>{t.email_to ?? ''}</td>
                    <td style={td}>
                      <button onClick={() => deleteTrigger(t.id)} style={buttonDanger}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {triggers.length === 0 && (
                  <tr>
                    <td style={td} colSpan={9}>
                      暂无规则
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: 'var(--text-soft)',
}

const input: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'rgba(15, 23, 42, 0.84)',
  color: 'var(--text)',
  fontSize: 13,
}

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #111827',
  background: '#111827',
  color: 'white',
  fontWeight: 800,
  cursor: 'pointer',
}

const buttonSecondary: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'rgba(15, 23, 42, 0.72)',
  color: 'var(--text)',
  cursor: 'pointer',
}

const buttonDanger: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #fecaca',
  background: '#fee2e2',
  color: '#991b1b',
  cursor: 'pointer',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid var(--shell-border-medium)',
  fontSize: 12,
  color: 'var(--text-soft)',
}

const td: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid var(--shell-border)',
  fontSize: 13,
  color: 'var(--text)',
}

function tabButton(active: boolean): React.CSSProperties {
  if (active)
    return {
      ...buttonSecondary,
      border: '1px solid rgba(59, 130, 246, 0.68)',
      background: 'rgba(37, 99, 235, 0.2)',
      fontWeight: 800,
    }
  return buttonSecondary
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--shell-border-medium)',
  borderRadius: 12,
  marginBottom: 16,
  background: 'var(--shell-surface)',
}

