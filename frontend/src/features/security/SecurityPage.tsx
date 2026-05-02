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

type LoginRecord = {
  time: string
  user: string
  ip: string
  line: string
}

function normalizeLoginRecord(raw: any): LoginRecord {
  return {
    time: String(raw?.time ?? raw?.created_at ?? ''),
    user: String(raw?.user ?? raw?.username ?? ''),
    ip: String(raw?.ip ?? raw?.remote_ip ?? ''),
    line: String(raw?.line ?? raw?.raw ?? ''),
  }
}

export function SecurityPage() {
  const [status, setStatus] = useState<string>('加载中...')
  const [hosts, setHosts] = useState<Host[]>([])
  const [selectedHostId, setSelectedHostId] = useState<string>('')

  const [limit, setLimit] = useState<string>('50')
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<LoginRecord[]>([])

  const limitNum = useMemo(() => {
    const n = Number(limit)
    if (!Number.isFinite(n) || n <= 0) return 50
    return Math.floor(n)
  }, [limit])

  async function loadHosts() {
    api<Host[]>('/api/hosts')
      .then((data) => {
        setHosts(data)
        setStatus(`共 ${data.length} 台主机`)
        setSelectedHostId((prev) => {
          if (prev) return prev
          if (data.length === 0) return ''
          return String(data[0].id)
        })
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        setStatus('加载失败：' + message)
      })
  }

  useEffect(() => {
    loadHosts()
  }, [])

  async function loadLoginHistory() {
    if (loading) return
    if (!selectedHostId) {
      setStatus('请先选择主机')
      return
    }

    setLoading(true)
    setStatus('加载中...')
    try {
      const qs = new URLSearchParams({
        host_id: selectedHostId,
        limit: String(limitNum),
      })
      const data = await api<any[]>(`/api/security/logins?${qs.toString()}`)
      const normalized = Array.isArray(data) ? data.map(normalizeLoginRecord) : []
      setRecords(normalized)
      setStatus(`共 ${normalized.length} 条登录记录`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>安全</h1>
      <div style={{ color: '#6b7280', marginBottom: 12 }}>{status}</div>

      <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>登录历史</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <label style={label}>
            主机
            <select value={selectedHostId} onChange={(e) => setSelectedHostId(e.target.value)} style={input}>
              {hosts.length === 0 && <option value="">暂无主机</option>}
              {hosts.map((h) => (
                <option key={h.id} value={String(h.id)}>
                  {h.name} ({h.ip})
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            limit
            <input value={limit} onChange={(e) => setLimit(e.target.value)} style={input} />
          </label>

          <div style={{ display: 'grid', alignContent: 'end' }}>
            <button onClick={loadLoginHistory} disabled={loading} style={button}>
              {loading ? '加载中...' : '加载'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>时间</th>
              <th style={th}>用户</th>
              <th style={th}>IP</th>
              <th style={th}>记录</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => (
              <tr key={`${r.time}-${r.user}-${r.ip}-${idx}`}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.time}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.user}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.ip}</td>
                <td style={{ ...td, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                  {r.line}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>
                  暂无登录记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: '#374151',
}

const input: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
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

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 12,
  color: '#6b7280',
}

const td: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: 13,
}

