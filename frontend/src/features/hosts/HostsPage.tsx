import { useEffect, useMemo, useState } from 'react'
import { AppButton } from '../shared/AppButton'
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

export function HostsPage() {
  const [status, setStatus] = useState<string>('加载中...')
  const [hosts, setHosts] = useState<Host[]>([])

  const [form, setForm] = useState<{
    name: string
    ip: string
    port: string
    username: string
    cloud_provider: string
    ssh_private_key: string
  }>({
    name: '',
    ip: '',
    port: '22',
    username: 'root',
    cloud_provider: '',
    ssh_private_key: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false
    if (!form.ip.trim()) return false
    if (!form.username.trim()) return false
    const portNum = Number(form.port)
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return false
    if (form.ssh_private_key.trim().length < 64) return false
    return true
  }, [form])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function loadHosts() {
    api<Host[]>('/api/hosts')
      .then((data) => {
        setHosts(data)
        setStatus(`共 ${data.length} 台主机`)
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        setStatus('加载失败：' + message)
      })
  }

  useEffect(() => {
    loadHosts()
  }, [])

  async function addHost() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setStatus('添加中...')
    try {
      const body = {
        name: form.name.trim(),
        ip: form.ip.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        cloud_provider: form.cloud_provider.trim() ? form.cloud_provider.trim() : null,
        ssh_private_key: form.ssh_private_key,
      }
      await api<Host>('/api/hosts', { method: 'POST', body: JSON.stringify(body) })
      setStatus('添加成功：SSH 校验通过，已采集一次监控数据')
      setForm((prev) => ({ ...prev, ssh_private_key: '' }))
      await loadHosts()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('添加失败：' + message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleHost(id: number) {
    setStatus('操作中...')
    try {
      await api<{ enabled: boolean }>(`/api/hosts/${encodeURIComponent(String(id))}/toggle`, { method: 'POST' })
      await loadHosts()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('操作失败：' + message)
    }
  }

  async function deleteHost(id: number) {
    const ok = window.confirm(`确认删除主机 #${id} 吗？`)
    if (!ok) return
    setStatus('删除中...')
    try {
      await api<unknown>(`/api/hosts/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
      await loadHosts()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('删除失败：' + message)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>主机管理</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>{status}</div>

      <div
        style={{
          padding: 12,
          border: '1px solid var(--shell-border-medium)',
          borderRadius: 10,
          marginBottom: 16,
          background: 'var(--shell-surface)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>新增主机</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <label style={label}>
            名称
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} style={input} />
          </label>
          <label style={label}>
            IP
            <input value={form.ip} onChange={(e) => setField('ip', e.target.value)} style={input} />
          </label>
          <label style={label}>
            端口
            <input value={form.port} onChange={(e) => setField('port', e.target.value)} style={input} />
          </label>
          <label style={label}>
            用户
            <input value={form.username} onChange={(e) => setField('username', e.target.value)} style={input} />
          </label>
          <label style={label}>
            云厂商（可选）
            <input
              value={form.cloud_provider}
              onChange={(e) => setField('cloud_provider', e.target.value)}
              style={input}
            />
          </label>
          <div />
          <label style={{ ...label, gridColumn: '1 / -1' }}>
            SSH 私钥（粘贴全文）
            <textarea
              value={form.ssh_private_key}
              onChange={(e) => setField('ssh_private_key', e.target.value)}
              style={textarea}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </label>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AppButton onClick={addHost} disabled={!canSubmit || submitting} variant="primary">
            {submitting ? '提交中...' : '添加主机'}
          </AppButton>
          {!canSubmit && (
            <span style={{ color: 'var(--text-soft)', fontSize: 12 }}>请填写名称/IP/用户/端口，并粘贴完整私钥</span>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>名称</th>
              <th style={th}>IP</th>
              <th style={th}>端口</th>
              <th style={th}>用户</th>
              <th style={th}>云厂商</th>
              <th style={th}>启用</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id}>
                <td style={td}>{h.id}</td>
                <td style={td}>{h.name}</td>
                <td style={td}>{h.ip}</td>
                <td style={td}>{h.port}</td>
                <td style={td}>{h.username}</td>
                <td style={td}>{h.cloud_provider ?? ''}</td>
                <td style={td}>{h.enabled ? '是' : '否'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <AppButton onClick={() => toggleHost(h.id)} variant="secondary">
                      {h.enabled ? '停用' : '启用'}
                    </AppButton>
                    <AppButton onClick={() => deleteHost(h.id)} variant="danger">
                      删除
                    </AppButton>
                  </div>
                </td>
              </tr>
            ))}
            {hosts.length === 0 && (
              <tr>
                <td style={td} colSpan={8}>
                  暂无主机数据
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
  color: 'var(--text-soft)',
}

const input: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  fontSize: 13,
}

const textarea: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  fontSize: 12,
  minHeight: 120,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
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
}

