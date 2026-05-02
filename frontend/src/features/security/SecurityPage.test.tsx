import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { SecurityPage } from './SecurityPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('SecurityPage', () => {
  it('loads hosts then loads login history with selected host_id and limit', async () => {
    apiMock
      .mockResolvedValueOnce([
        { id: 1, name: 'web-01', ip: '10.0.0.1', port: 22, username: 'root', cloud_provider: null, enabled: true },
        { id: 2, name: 'db-01', ip: '10.0.0.2', port: 22, username: 'ubuntu', cloud_provider: null, enabled: true },
      ])
      .mockResolvedValueOnce([
        { time: '2026-01-01T00:00:00Z', user: 'root', ip: '1.2.3.4', line: 'Accepted password for root' },
      ])

    render(<SecurityPage />)

    expect(await screen.findByText('共 2 台主机')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('主机'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('limit'), { target: { value: '10' } })
    fireEvent.click(screen.getByText('加载'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/hosts')
    })
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/security/logins?host_id=2&limit=10')
    })

    expect(await screen.findByText('2026-01-01T00:00:00Z')).toBeInTheDocument()
    expect(screen.getByText('root')).toBeInTheDocument()
    expect(screen.getByText('1.2.3.4')).toBeInTheDocument()
    expect(screen.getByText('Accepted password for root')).toBeInTheDocument()
  })
})

