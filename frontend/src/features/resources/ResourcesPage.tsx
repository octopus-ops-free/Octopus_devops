import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

type Host = { id: number; name: string }

type ProcRow = {
  pid: number
  user: string
  cpu: number | string
  mem: number | string
  time: string
  cmd: string
}

type PortRow = {
  proto: string
  local: string
  foreign: string
  state: string
  pid_program: string
}

type TabKey = 'processes' | 'ports'

export function ResourcesPage() {
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostId, setHostId] = useState<string>('')

  const [tab, setTab] = useState<TabKey>('processes')
  const [status, setStatus] = useState<string>('请选择主机')

  const [processes, setProcesses] = useState<ProcRow[]>([])
  const [ports, setPorts] = useState<PortRow[]>([])
  const [busy, setBusy] = useState(false)

  const hostIdNum = useMemo(() => Number(hostId), [hostId])
  const hasHost = useMemo(() => Number.isInteger(hostIdNum) && hostIdNum > 0, [hostIdNum])

  async function loadHosts() {
    try {
      const data = await api<Host[]>('/api/hosts')
      setHosts(data ?? [])
    } catch {
      // ignore: only for convenience
    }
  }

  async function loadProcesses(nextHostId: number) {
    setBusy(true)
    setStatus('加载中...')
    try {
      const data = await api<ProcRow[]>(`/api/resources/processes?host_id=${encodeURIComponent(String(nextHostId))}`)
      setProcesses(data ?? [])
      setStatus(`进程数：${(data ?? []).length}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
      setProcesses([])
    } finally {
      setBusy(false)
    }
  }

  async function loadPorts(nextHostId: number) {
    setBusy(true)
    setStatus('加载中...')
    try {
      const data = await api<PortRow[]>(`/api/resources/ports?host_id=${encodeURIComponent(String(nextHostId))}`)
      setPorts(data ?? [])
      setStatus(`端口数：${(data ?? []).length}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
      setPorts([])
    } finally {
      setBusy(false)
    }
  }

  async function refreshCurrent() {
    if (!hasHost) {
      setStatus('请选择主机')
      return
    }
    if (tab === 'processes') await loadProcesses(hostIdNum)
    if (tab === 'ports') await loadPorts(hostIdNum)
  }

  useEffect(() => {
    loadHosts()
  }, [])

  useEffect(() => {
    if (!hasHost) return
    refreshCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHost, tab])

  async function killProcess(pid: number, force: boolean) {
    if (!hasHost || busy) return
    const ok = window.confirm(`确认${force ? '强制' : ''}结束进程 PID=${pid} 吗？`)
    if (!ok) return

    setBusy(true)
    setStatus('执行中...')
    try {
      await api<unknown>(
        `/api/resources/processes/kill?host_id=${encodeURIComponent(String(hostIdNum))}&pid=${encodeURIComponent(
          String(pid),
        )}&force=${force ? 'true' : 'false'}`,
        { method: 'POST' },
      )
      setStatus('已发送 kill 请求')
      await loadProcesses(hostIdNum)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('操作失败：' + message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>资源</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>{status}</div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={label}>
            host_id（必选）
            <select
              aria-label="host_id"
              value={hostId}
              onChange={(e) => {
                setHostId(e.target.value)
                setProcesses([])
                setPorts([])
              }}
              style={select}
            >
              <option value="">请选择主机</option>
              {hosts.map((h) => (
                <option key={h.id} value={String(h.id)}>
                  {h.name} (#{h.id})
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setTab('processes')}
              style={tab === 'processes' ? tabButtonActive : tabButton}
            >
              Processes
            </button>
            <button type="button" onClick={() => setTab('ports')} style={tab === 'ports' ? tabButtonActive : tabButton}>
              Ports
            </button>
          </div>

          <button type="button" onClick={refreshCurrent} disabled={!hasHost || busy} style={buttonSecondary}>
            刷新
          </button>
        </div>
      </div>

      {!hasHost ? (
        <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>请选择主机后查看资源</div>
      ) : tab === 'processes' ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>pid</th>
                <th style={th}>user</th>
                <th style={th}>cpu</th>
                <th style={th}>mem</th>
                <th style={th}>time</th>
                <th style={th}>cmd</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.pid}>
                  <td style={td}>{p.pid}</td>
                  <td style={td}>{p.user}</td>
                  <td style={td}>{p.cpu}</td>
                  <td style={td}>{p.mem}</td>
                  <td style={td}>{p.time}</td>
                  <td style={{ ...td, maxWidth: 760, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.cmd}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        aria-label={`kill ${p.pid}`}
                        onClick={() => killProcess(p.pid, false)}
                        disabled={busy}
                        style={buttonSecondary}
                      >
                        kill
                      </button>
                      <button
                        type="button"
                        aria-label={`kill -9 ${p.pid}`}
                        onClick={() => killProcess(p.pid, true)}
                        disabled={busy}
                        style={buttonDanger}
                      >
                        kill -9
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {processes.length === 0 && (
                <tr>
                  <td style={td} colSpan={7}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>proto</th>
                <th style={th}>local</th>
                <th style={th}>foreign</th>
                <th style={th}>state</th>
                <th style={th}>pid_program</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p, idx) => (
                <tr key={`${p.local}-${p.foreign}-${idx}`}>
                  <td style={td}>{p.proto}</td>
                  <td style={td}>{p.local}</td>
                  <td style={td}>{p.foreign}</td>
                  <td style={td}>{p.state}</td>
                  <td style={td}>{p.pid_program}</td>
                </tr>
              ))}
              {ports.length === 0 && (
                <tr>
                  <td style={td} colSpan={5}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

const select: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  fontSize: 13,
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  minWidth: 240,
}

const buttonSecondary: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  cursor: 'pointer',
}

const buttonDanger: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #ef4444',
  background: '#ef4444',
  color: 'white',
  fontWeight: 800,
  cursor: 'pointer',
}

const tabButton: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontWeight: 700,
}

const tabButtonActive: React.CSSProperties = {
  ...tabButton,
  border: '1px solid var(--shell-nav-active-border)',
  background: 'var(--shell-nav-active-bg)',
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
  verticalAlign: 'top',
  color: 'var(--text)',
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--shell-border-medium)',
  borderRadius: 12,
  marginBottom: 12,
  background: 'var(--shell-surface)',
}

