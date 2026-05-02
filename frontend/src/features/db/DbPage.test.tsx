import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { DbPage } from './DbPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('DbPage', () => {
  beforeEach(() => {
    apiMock.mockReset()
    vi.restoreAllMocks()
  })

  it('health load button calls /api/db/health', async () => {
    apiMock.mockResolvedValueOnce([]) // initial /api/db/backups
    apiMock.mockResolvedValueOnce({ ok: true }) // /api/db/health

    render(<DbPage />)

    const btn = screen.getByRole('button', { name: '加载' })
    fireEvent.click(btn)

    expect(apiMock).toHaveBeenCalledWith('/api/db/health')
  })

  it('loads backup list from /api/db/backups on mount', async () => {
    apiMock.mockResolvedValueOnce([
      { name: 'b1', size_bytes: 123, mtime: 1710000000, path: '/tmp/b1.sqlite3' },
    ])

    render(<DbPage />)

    expect(await screen.findByText('共 1 个备份')).toBeInTheDocument()
    expect(apiMock).toHaveBeenCalledWith('/api/db/backups')
    expect(screen.getByText('b1')).toBeInTheDocument()
  })

  it('restore calls correct endpoint', async () => {
    apiMock.mockResolvedValueOnce([
      { name: 'backup-A', size_bytes: 1, mtime: 1710000000, path: '/tmp/a' },
    ])
    apiMock.mockResolvedValueOnce({ ok: true }) // restore
    apiMock.mockResolvedValueOnce([]) // reload backups after restore

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DbPage />)

    await screen.findByText('backup-A')
    fireEvent.click(screen.getByRole('button', { name: '恢复' }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(apiMock).toHaveBeenCalledWith('/api/db/restore?name=backup-A', { method: 'POST' })
  })
})

