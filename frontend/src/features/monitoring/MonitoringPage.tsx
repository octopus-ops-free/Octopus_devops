import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

type Host = {
  id: number
  name: string
  ip: string
  port: number
  username: string
  cloud_provider?: string | null
  enabled: boolean
}

type MetricRow = {
  created_at: string
  cpu_percent: number
  mem_percent: number
  disk_percent: number
}

export function MonitoringPage() {
  const [status, setStatus] = useState<string>('加载中...')
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostName, setHostName] = useState<string>('local')
  const [limit, setLimit] = useState<number>(50)
  const [metrics, setMetrics] = useState<MetricRow[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [collecting, setCollecting] = useState(false)

  const hostOptions = useMemo(() => {
    const names = hosts.map((h) => h.name).filter(Boolean)
    const unique = Array.from(new Set(['local', ...names]))
    return unique
  }, [hosts])

  async function loadHosts() {
    try {
      const data = await api<Host[]>('/api/hosts')
      setHosts(data)
      setStatus(`已加载主机列表（${data.length}）`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('主机列表加载失败：' + message)
    }
  }

  async function loadMetrics(nextHostName?: string, nextLimit?: number) {
    const h = nextHostName ?? hostName
    const l = nextLimit ?? limit
    setLoadingMetrics(true)
    setStatus('加载监控数据...')
    try {
      const qs = new URLSearchParams({ host: h, limit: String(l) })
      const data = await api<MetricRow[]>(`/api/monitoring/metrics?${qs.toString()}`)
      setMetrics(Array.isArray(data) ? data : [])
      setStatus(`已加载 ${Array.isArray(data) ? data.length : 0} 条`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
    } finally {
      setLoadingMetrics(false)
    }
  }

  async function collectOnce() {
    if (collecting) return
    setCollecting(true)
    setStatus('采集中...')
    try {
      await api<unknown>('/api/monitoring/collect', { method: 'POST' })
      await loadMetrics()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('采集失败：' + message)
    } finally {
      setCollecting(false)
    }
  }

  useEffect(() => {
    loadHosts()
    // legacy 默认展示 local 最近数据（不依赖 hosts 列表加载成功）
    loadMetrics('local', 50)
  }, [])

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>监控</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>{status}</div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={label}>
            主机
            <select
              value={hostName}
              onChange={(e) => {
                const v = e.target.value
                setHostName(v)
              }}
              style={input}
              aria-label="host"
            >
              {hostOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            条数
            <input
              value={String(limit)}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                setLimit(n)
              }}
              style={{ ...input, width: 120 }}
              inputMode="numeric"
              aria-label="limit"
            />
          </label>

          <button
            onClick={() => loadMetrics()}
            disabled={loadingMetrics || collecting}
            style={buttonSecondary}
          >
            {loadingMetrics ? '刷新中...' : '刷新'}
          </button>
          <button onClick={collectOnce} disabled={collecting} style={button}>
            {collecting ? '采集中...' : '采集一次'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>created_at</th>
              <th style={th}>cpu_percent</th>
              <th style={th}>mem_percent</th>
              <th style={th}>disk_percent</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, idx) => (
              <tr key={`${m.created_at}-${idx}`}>
                <td style={td}>{m.created_at}</td>
                <td style={td}>{formatPercent(m.cpu_percent)}</td>
                <td style={td}>{formatPercent(m.mem_percent)}</td>
                <td style={td}>{formatPercent(m.disk_percent)}</td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>
                  暂无监控数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return ''
  const v = Math.round(n * 100) / 100
  return String(v)
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
  fontSize: 13,
  background: 'rgba(15, 23, 42, 0.9)',
  color: 'var(--text)',
}

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(59, 130, 246, 0.6)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--heading)',
  fontWeight: 800,
  cursor: 'pointer',
}

const buttonSecondary: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'rgba(15, 23, 42, 0.8)',
  color: 'var(--text)',
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

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--shell-border-medium)',
  borderRadius: 12,
  marginBottom: 16,
  background: 'var(--shell-surface)',
}

