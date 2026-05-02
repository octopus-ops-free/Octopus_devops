import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MonitoringPage } from './MonitoringPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('MonitoringPage', () => {
  it('loads hosts + metrics, renders rows, and collects then refreshes', async () => {
    apiMock
      .mockResolvedValueOnce([
        { id: 1, name: 'web-01', ip: '10.0.0.1', port: 22, username: 'root', cloud_provider: null, enabled: true },
      ])
      .mockResolvedValueOnce([
        { created_at: '2026-01-01T00:00:00Z', cpu_percent: 1.1, mem_percent: 2.2, disk_percent: 3.3 },
      ])
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce([
        { created_at: '2026-01-01T00:00:01Z', cpu_percent: 4.4, mem_percent: 5.5, disk_percent: 6.6 },
      ])

    render(<MonitoringPage />)

    expect(await screen.findByText('2026-01-01T00:00:00Z')).toBeInTheDocument()
    expect(screen.getByText('1.1')).toBeInTheDocument()
    expect(screen.getByText('2.2')).toBeInTheDocument()
    expect(screen.getByText('3.3')).toBeInTheDocument()

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/hosts')
    })
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/monitoring/metrics?host=local&limit=50')
    })

    fireEvent.click(screen.getByText('采集一次'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/monitoring/collect', { method: 'POST' })
    })
    expect(await screen.findByText('2026-01-01T00:00:01Z')).toBeInTheDocument()
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/monitoring/metrics?host=local&limit=50')
    })
  })
})

