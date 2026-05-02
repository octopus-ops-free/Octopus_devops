import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

type Host = {
  id: number
  name: string
  ip: string
  port: number
  username: string
  enabled: boolean
}

type RemoteUser = {
  username: string
  uid: number
  gid: number
  home: string
  shell: string
}

type GroupsInfo = {
  primary: string
  supplementary: string[]
}

function remoteUsersUrl(hostId: number, username?: string): string {
  const params = new URLSearchParams({ host_id: String(hostId) })
  if (username) params.set('username', username)
  return `/api/remote-users?${params.toString()}`
}

function remoteUsersGroupsUrl(hostId: number, username: string): string {
  const params = new URLSearchParams({ host_id: String(hostId), username })
  return `/api/remote-users/groups?${params.toString()}`
}

function remoteUsersPasswordUrl(hostId: number, username: string): string {
  const params = new URLSearchParams({ host_id: String(hostId), username })
  return `/api/remote-users/password?${params.toString()}`
}

function remoteUsersPrimaryGroupUrl(hostId: number, username: string): string {
  const params = new URLSearchParams({ host_id: String(hostId), username })
  return `/api/remote-users/groups/primary?${params.toString()}`
}

function remoteUsersSuppAddUrl(hostId: number, username: string): string {
  const params = new URLSearchParams({ host_id: String(hostId), username })
  return `/api/remote-users/groups/supp/add?${params.toString()}`
}

function remoteUsersSuppRemoveUrl(hostId: number, username: string): string {
  const params = new URLSearchParams({ host_id: String(hostId), username })
  return `/api/remote-users/groups/supp/remove?${params.toString()}`
}

function remoteUsersSudoUrl(hostId: number, username: string): string {
  const params = new URLSearchParams({ host_id: String(hostId), username })
  return `/api/remote-users/sudo?${params.toString()}`
}

export function RemoteUsersPage() {
  const [status, setStatus] = useState<string>('加载中...')
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostId, setHostId] = useState<number | null>(null)

  const [users, setUsers] = useState<RemoteUser[]>([])
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)

  const selectedUser = useMemo(() => {
    if (!selectedUsername) return null
    return users.find((u) => u.username === selectedUsername) ?? null
  }, [selectedUsername, users])

  const [createForm, setCreateForm] = useState<{ username: string; password: string; make_sudo: boolean }>({
    username: '',
    password: '',
    make_sudo: false,
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [groupsStatus, setGroupsStatus] = useState<string>('')
  const [groups, setGroups] = useState<GroupsInfo | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [primaryGroup, setPrimaryGroup] = useState('')
  const [suppGroup, setSuppGroup] = useState('')
  const [makeSudo, setMakeSudo] = useState<boolean>(false)

  async function loadHosts() {
    api<Host[]>('/api/hosts')
      .then((data) => {
        setHosts(data)
        setStatus(`共 ${data.length} 台主机`)
        const firstEnabled = data.find((h) => h.enabled)?.id ?? data[0]?.id ?? null
        setHostId((prev) => prev ?? firstEnabled)
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        setStatus('加载失败：' + message)
      })
  }

  async function loadUsers(targetHostId: number) {
    setStatus('加载用户中...')
    setSelectedUsername(null)
    setGroups(null)
    setGroupsStatus('')
    try {
      const data = await api<RemoteUser[]>(remoteUsersUrl(targetHostId))
      setUsers(data)
      setStatus(`共 ${data.length} 个用户`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('加载失败：' + message)
      setUsers([])
    }
  }

  async function loadGroups(targetHostId: number, username: string) {
    setGroupsStatus('加载组信息中...')
    setGroups(null)
    try {
      const data = (await api<any>(remoteUsersGroupsUrl(targetHostId, username))) as any
      const primary = String(data?.primary ?? data?.primary_group ?? '')
      const supplementaryRaw = data?.supplementary ?? data?.supplementary_groups ?? data?.groups ?? []
      const supplementary = Array.isArray(supplementaryRaw) ? supplementaryRaw.map((x) => String(x)) : []
      setGroups({ primary, supplementary })
      setPrimaryGroup(primary)
      setGroupsStatus('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setGroupsStatus('加载失败：' + message)
    }
  }

  useEffect(() => {
    loadHosts()
  }, [])

  useEffect(() => {
    if (hostId == null) return
    loadUsers(hostId)
  }, [hostId])

  useEffect(() => {
    if (hostId == null) return
    if (!selectedUsername) return
    loadGroups(hostId, selectedUsername)
  }, [hostId, selectedUsername])

  const canCreate = useMemo(() => {
    if (hostId == null) return false
    if (!createForm.username.trim()) return false
    if (!createForm.password) return false
    return true
  }, [createForm.password, createForm.username, hostId])

  async function createUser() {
    if (hostId == null) return
    if (!canCreate || createSubmitting) return
    setCreateSubmitting(true)
    setStatus('创建中...')
    try {
      const body = {
        username: createForm.username.trim(),
        password: createForm.password,
        make_sudo: createForm.make_sudo,
      }
      await api<unknown>(remoteUsersUrl(hostId), { method: 'POST', body: JSON.stringify(body) })
      setStatus('创建成功')
      setCreateForm({ username: '', password: '', make_sudo: false })
      await loadUsers(hostId)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('创建失败：' + message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  async function deleteUser(username: string) {
    if (hostId == null) return
    const ok = window.confirm(`确认删除用户 ${username} 吗？`)
    if (!ok) return
    setStatus('删除中...')
    try {
      await api<unknown>(remoteUsersUrl(hostId, username), { method: 'DELETE' })
      await loadUsers(hostId)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setStatus('删除失败：' + message)
    }
  }

  async function changePassword() {
    if (hostId == null || !selectedUser) return
    if (!newPassword) return
    setGroupsStatus('修改密码中...')
    try {
      await api<unknown>(remoteUsersPasswordUrl(hostId, selectedUser.username), {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      })
      setNewPassword('')
      setGroupsStatus('密码已更新')
      setTimeout(() => setGroupsStatus(''), 800)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setGroupsStatus('失败：' + message)
    }
  }

  async function toggleSudo(next: boolean) {
    if (hostId == null || !selectedUser) return
    setGroupsStatus('更新 sudo 中...')
    try {
      await api<unknown>(remoteUsersSudoUrl(hostId, selectedUser.username), {
        method: 'PUT',
        body: JSON.stringify({ make_sudo: next }),
      })
      setMakeSudo(next)
      setGroupsStatus('')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setGroupsStatus('失败：' + message)
    }
  }

  async function updatePrimaryGroup() {
    if (hostId == null || !selectedUser) return
    if (!primaryGroup.trim()) return
    setGroupsStatus('更新主组中...')
    try {
      await api<unknown>(remoteUsersPrimaryGroupUrl(hostId, selectedUser.username), {
        method: 'PUT',
        body: JSON.stringify({ group: primaryGroup.trim() }),
      })
      await loadGroups(hostId, selectedUser.username)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setGroupsStatus('失败：' + message)
    }
  }

  async function addSupplementaryGroup() {
    if (hostId == null || !selectedUser) return
    if (!suppGroup.trim()) return
    setGroupsStatus('添加附加组中...')
    try {
      await api<unknown>(remoteUsersSuppAddUrl(hostId, selectedUser.username), {
        method: 'PUT',
        body: JSON.stringify({ group: suppGroup.trim() }),
      })
      setSuppGroup('')
      await loadGroups(hostId, selectedUser.username)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setGroupsStatus('失败：' + message)
    }
  }

  async function removeSupplementaryGroup(group: string) {
    if (hostId == null || !selectedUser) return
    const ok = window.confirm(`确认移除附加组 ${group} 吗？`)
    if (!ok) return
    setGroupsStatus('移除附加组中...')
    try {
      await api<unknown>(remoteUsersSuppRemoveUrl(hostId, selectedUser.username), {
        method: 'PUT',
        body: JSON.stringify({ group }),
      })
      await loadGroups(hostId, selectedUser.username)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setGroupsStatus('失败：' + message)
    }
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>远程用户</h1>
      <div style={{ color: 'var(--text-soft)', marginBottom: 12 }}>{status}</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={labelInline}>
          主机
          <select
            aria-label="主机"
            value={hostId ?? ''}
            onChange={(e) => setHostId(e.target.value ? Number(e.target.value) : null)}
            style={select}
          >
            <option value="" disabled>
              请选择
            </option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                #{h.id} {h.name} ({h.ip}){h.enabled ? '' : ' [停用]'}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => hostId != null && loadUsers(hostId)} disabled={hostId == null} style={buttonSecondary}>
          刷新用户
        </button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>新增用户</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <label style={label}>
            用户名
            <input
              aria-label="用户名"
              value={createForm.username}
              onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
              style={input}
            />
          </label>
          <label style={label}>
            密码
            <input
              aria-label="密码"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
              style={input}
            />
          </label>
          <label style={{ ...label, alignItems: 'start' }}>
            sudo
            <input
              aria-label="sudo"
              type="checkbox"
              checked={createForm.make_sudo}
              onChange={(e) => setCreateForm((p) => ({ ...p, make_sudo: e.target.checked }))}
              style={{ width: 18, height: 18 }}
            />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={createUser} disabled={!canCreate || createSubmitting} style={button}>
            {createSubmitting ? '提交中...' : '创建用户'}
          </button>
          {!canCreate && <span style={{ marginLeft: 10, color: 'var(--text-soft)', fontSize: 12 }}>需要选择主机并填写用户名/密码</span>}
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>用户名</th>
              <th style={th}>UID</th>
              <th style={th}>GID</th>
              <th style={th}>Home</th>
              <th style={th}>Shell</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const active = u.username === selectedUsername
              return (
                <tr key={u.username} style={active ? activeRow : undefined}>
                  <td style={td}>
                    <button
                      onClick={() => {
                        setSelectedUsername(u.username)
                        setMakeSudo(false)
                        setNewPassword('')
                        setSuppGroup('')
                      }}
                      style={linkButton}
                      aria-label={`选择用户 ${u.username}`}
                    >
                      {u.username}
                    </button>
                  </td>
                  <td style={td}>{u.uid}</td>
                  <td style={td}>{u.gid}</td>
                  <td style={td}>{u.home}</td>
                  <td style={td}>{u.shell}</td>
                  <td style={td}>
                    <button onClick={() => deleteUser(u.username)} style={buttonDanger} aria-label={`删除用户 ${u.username}`}>
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>
                  暂无用户数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>管理选中用户</div>
        {!selectedUser && <div style={{ color: 'var(--text-soft)' }}>请先在上方列表中选择一个用户</div>}
        {selectedUser && hostId != null && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ color: 'var(--text-soft)', fontSize: 12 }}>
              当前：<b>{selectedUser.username}</b> {groupsStatus ? `（${groupsStatus}）` : ''}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={label}>
                新密码
                <input
                  aria-label="新密码"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={input}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button onClick={changePassword} disabled={!newPassword} style={buttonSecondary} aria-label="修改密码">
                  修改密码
                </button>
              </div>

              <label style={labelInline}>
                sudo
                <input
                  aria-label="切换sudo"
                  type="checkbox"
                  checked={makeSudo}
                  onChange={(e) => toggleSudo(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={label}>
                主组
                <input
                  aria-label="主组"
                  value={primaryGroup}
                  onChange={(e) => setPrimaryGroup(e.target.value)}
                  style={input}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button onClick={updatePrimaryGroup} disabled={!primaryGroup.trim()} style={buttonSecondary} aria-label="更新主组">
                  更新主组
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={label}>
                附加组
                <input aria-label="附加组" value={suppGroup} onChange={(e) => setSuppGroup(e.target.value)} style={input} />
              </label>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  onClick={addSupplementaryGroup}
                  disabled={!suppGroup.trim()}
                  style={buttonSecondary}
                  aria-label="添加附加组"
                >
                  添加附加组
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12, color: 'var(--text-soft)' }}>组信息</div>
              {!groups && <div style={{ color: 'var(--text-soft)', fontSize: 12 }}>（选择用户后自动加载）</div>}
              {groups && (
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 13 }}>
                    主组：<b>{groups.primary || '—'}</b>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    附加组：{groups.supplementary.length ? '' : '—'}
                    {groups.supplementary.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                        {groups.supplementary.map((g) => (
                          <span key={g} style={pill}>
                            {g}
                            <button
                              onClick={() => removeSupplementaryGroup(g)}
                              style={pillButton}
                              aria-label={`移除附加组 ${g}`}
                            >
                              移除
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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

const select: React.CSSProperties = {
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  fontSize: 13,
  minWidth: 280,
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

const buttonDanger: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid #fecaca',
  background: '#fee2e2',
  color: '#991b1b',
  cursor: 'pointer',
}

const linkButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  color: 'var(--heading)',
  fontSize: 13,
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

const pill: React.CSSProperties = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  padding: '6px 8px',
  borderRadius: 999,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  fontSize: 12,
  color: 'var(--text)',
}

const pillButton: React.CSSProperties = {
  border: '1px solid var(--shell-border-strong)',
  background: 'var(--shell-surface-raised)',
  color: 'var(--text)',
  borderRadius: 999,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: 12,
}

const card: React.CSSProperties = {
  padding: 12,
  border: '1px solid var(--shell-border-medium)',
  borderRadius: 12,
  marginBottom: 16,
  background: 'var(--shell-surface)',
}

const activeRow: React.CSSProperties = {
  background: 'var(--shell-nav-active-bg)',
}

