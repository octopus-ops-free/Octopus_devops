import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { HostsPage } from './HostsPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('HostsPage', () => {
  it('loads hosts and shows count', async () => {
    apiMock.mockResolvedValueOnce([
      { id: 1, name: 'web-01', ip: '10.0.0.1', port: 22, username: 'root', cloud_provider: null, enabled: true },
      { id: 2, name: 'web-02', ip: '10.0.0.2', port: 22, username: 'ubuntu', cloud_provider: 'aws', enabled: false },
    ])

    render(<HostsPage />)

    expect(await screen.findByText('共 2 台主机')).toBeInTheDocument()
    expect(screen.getByText('web-01')).toBeInTheDocument()
    expect(screen.getByText('web-02')).toBeInTheDocument()
  })
})

