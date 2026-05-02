import { useEffect, useMemo, useState } from 'react'
import { AppButton } from '../shared/AppButton'
import { api } from '../../lib/api'

type DbHealth = { ok: boolean; detail?: string }

type DbBackup = {
  name: string
  size_bytes: number
  mtime: number | string
  path: string
}

function buildBackupQuery(name: string, note: string): string {
  const params = new URLSearchParams()
  const n = name.trim()
  const no = note.trim()
  if (n) params.set('name', n)
  if (no) params.set('note', no)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function DbPage() {
  const [healthStatus, setHealthStatus] = useState<string>('')
  const [healthData, setHealthData] = useState<DbHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  const [backupsStatus, setBackupsStatus] = useState<string>('')
  const [backups, setBackups] = useState<DbBackup[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createNote, setCreateNote] = useState('')
  const [creating, setCreating] = useState(false)

  const canCreate = useMemo(() => {
    if (creating) return false
    if (createName.trim().length > 0 && createName.trim().length < 2) return false
    if (createNote.trim().length > 0 && createNote.trim().length < 2) return false
    return true
  }, [createName, createNote, creating])

  async function loadHealth() {
    if (healthLoading) return
    setHealthLoading(true)
    setHealthStatus('加载中...')
    setHealthData(null)
    api<DbHealth>('/api/db/health')
      .then((d) => {
        setHealthData(d)
        setHealthStatus(d.ok ? 'OK' : 'NOT OK' + (d.detail ? `: ${d.detail}` : ''))
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        setHealthStatus('加载失败：' + message)
      })
      .finally(() => setHealthLoading(false))
  }

  async function loadBackups() {
    if (backupsLoading) return
    setBackupsLoading(true)
    setBackupsStatus('加载中...')
    api<DbBackup[]>('/api/db/backups')
      .then((data) => {
        setBackups(data)
        setBackupsStatus(`共 ${data.length} 个备份`)
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        setBackupsStatus('加载失败：' + message)
      })
      .finally(() => setBackupsLoading(false))
  }

  useEffect(() => {
    loadBackups()
  }, [])

  async function createBackup() {
    if (!canCreate) return
    setCreating(true)
    setBackupsStatus('创建备份中...')
    try {
      const qs = buildBackupQuery(createName, createNote)
      await api<unknown>(`/api/db/backup${qs}`, { method: 'POST' })
      setBackupsStatus('备份创建成功')
      setCreateName('')
      setCreateNote('')
      await loadBackups()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setBackupsStatus('创建失败：' + message)
    } finally {
      setCreating(false)
    }
  }

  async function restoreBackup(name: string) {
    const ok = window.confirm(`确认恢复备份 "${name}" 吗？\n\n恢复会覆盖当前数据库。`)
    if (!ok) return
    setBackupsStatus('恢复中...')
    try {
      await api<unknown>(`/api/db/restore?name=${encodeURIComponent(name)}`, { method: 'POST' })
      setBackupsStatus('恢复完成')
      await loadBackups()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setBackupsStatus('恢复失败：' + message)
    }
  }

  async function rollback() {
    const ok = window.confirm('确认回滚数据库吗？\n\n该操作具有风险，请确保你知道自己在做什么。')
    if (!ok) return
    setBackupsStatus('回滚中...')
    try {
      await api<unknown>('/api/db/rollback', { method: 'POST' })
      setBackupsStatus('回滚完成')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setBackupsStatus('回滚失败：' + message)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>数据库</h1>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontWeight: 800 }}>健康检查</div>
          <AppButton onClick={loadHealth} disabled={healthLoading} variant="secondary">
            {healthLoading ? '加载中...' : '加载'}
          </AppButton>
        </div>
        <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>
          {healthStatus ? healthStatus : '点击“加载”调用 /api/db/health'}
        </div>
        {healthData && (
          <pre style={pre} aria-label="health-json">
            {JSON.stringify(healthData, null, 2)}
          </pre>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontWeight: 800 }}>备份</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <AppButton onClick={loadBackups} disabled={backupsLoading} variant="secondary">
              {backupsLoading ? '加载中...' : '刷新'}
            </AppButton>
            <AppButton onClick={rollback} variant="danger">
              回滚
            </AppButton>
          </div>
        </div>

        <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13 }}>{backupsStatus}</div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <label style={label}>
            备份名（可选）
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} style={input} />
          </label>
          <label style={label}>
            备注（可选）
            <input value={createNote} onChange={(e) => setCreateNote(e.target.value)} style={input} />
          </label>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AppButton onClick={createBackup} disabled={!canCreate} variant="primary">
            {creating ? '创建中...' : '创建备份'}
          </AppButton>
          {!canCreate && (
            <span style={{ color: '#6b7280', fontSize: 12 }}>name/note 若填写，至少 2 个字符</span>
          )}
        </div>

        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>name</th>
                <th style={th}>size_bytes</th>
                <th style={th}>mtime</th>
                <th style={th}>path</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td style={td} title={b.name}>
                    {b.name}
                  </td>
                  <td style={td}>{b.size_bytes}</td>
                  <td style={td}>{String(b.mtime)}</td>
                  <td style={td} title={b.path}>
                    <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                      {b.path}
                    </span>
                  </td>
                  <td style={td}>
                    <AppButton onClick={() => restoreBackup(b.name)} variant="secondary">
                      恢复
                    </AppButton>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td style={td} colSpan={5}>
                    暂无备份
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  marginBottom: 16,
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
  verticalAlign: 'top',
}

const pre: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #f3f4f6',
  background: '#fafafa',
  fontSize: 12,
  overflowX: 'auto',
}

