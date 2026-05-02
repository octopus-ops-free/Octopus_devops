import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { RemoteUsersPage } from './RemoteUsersPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('RemoteUsersPage', () => {
  it('loads users for chosen host', async () => {
    apiMock
      .mockResolvedValueOnce([
        { id: 1, name: 'web-01', ip: '10.0.0.1', port: 22, username: 'root', enabled: true },
        { id: 2, name: 'web-02', ip: '10.0.0.2', port: 22, username: 'root', enabled: true },
      ])
      .mockResolvedValueOnce([{ username: 'alice', uid: 1001, gid: 1001, home: '/home/alice', shell: '/bin/bash' }])
      .mockResolvedValueOnce([{ username: 'bob', uid: 1002, gid: 1002, home: '/home/bob', shell: '/bin/zsh' }])

    render(<RemoteUsersPage />)

    expect(await screen.findByText('alice')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('主机'), { target: { value: '2' } })
    expect(await screen.findByText('bob')).toBeInTheDocument()

    expect(apiMock).toHaveBeenCalledWith('/api/hosts')
    expect(apiMock).toHaveBeenCalledWith('/api/remote-users?host_id=1')
    expect(apiMock).toHaveBeenCalledWith('/api/remote-users?host_id=2')
  })

  it('create user calls correct endpoint', async () => {
    apiMock
      .mockResolvedValueOnce([{ id: 1, name: 'web-01', ip: '10.0.0.1', port: 22, username: 'root', enabled: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce([{ username: 'newuser', uid: 2001, gid: 2001, home: '/home/newuser', shell: '/bin/bash' }])

    render(<RemoteUsersPage />)

    await screen.findByText('暂无用户数据')

    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'newuser' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByLabelText('sudo'))
    fireEvent.click(screen.getByRole('button', { name: '创建用户' }))

    expect(apiMock).toHaveBeenCalledWith('/api/remote-users?host_id=1', {
      method: 'POST',
      body: JSON.stringify({ username: 'newuser', password: 'secret', make_sudo: true }),
    })
  })

  it('delete calls correct endpoint', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    apiMock
      .mockResolvedValueOnce([{ id: 1, name: 'web-01', ip: '10.0.0.1', port: 22, username: 'root', enabled: true }])
      .mockResolvedValueOnce([{ username: 'alice', uid: 1001, gid: 1001, home: '/home/alice', shell: '/bin/bash' }])
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce([])

    render(<RemoteUsersPage />)

    expect(await screen.findByText('alice')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('删除用户 alice'))

    expect(apiMock).toHaveBeenCalledWith('/api/remote-users?host_id=1&username=alice', { method: 'DELETE' })
  })
})

