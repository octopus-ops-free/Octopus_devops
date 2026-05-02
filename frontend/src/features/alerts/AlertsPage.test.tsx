import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { AlertsPage } from './AlertsPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('AlertsPage legacy', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  it('loads triggers list when switching to Triggers tab', async () => {
    apiMock.mockResolvedValueOnce([{ id: 1, host: 'local', metric: 'cpu', op: '>', value: 80, level: 'warning' }])
    apiMock.mockResolvedValueOnce([{ id: 1, name: 'web-01' }])

    render(<AlertsPage />)

    fireEvent.click(screen.getByText('规则'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/alerts/triggers')
    })
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/hosts')
    })

    expect(await screen.findByText('local')).toBeInTheDocument()
    expect(screen.getByText('cpu')).toBeInTheDocument()
  })

  it('creates trigger with correct endpoint + payload', async () => {
    apiMock
      .mockResolvedValueOnce([]) // events initial load
      .mockResolvedValueOnce([]) // triggers load
      .mockResolvedValueOnce([]) // hosts load
      .mockResolvedValueOnce({ id: 9 }) // create trigger
      .mockResolvedValueOnce([]) // reload triggers

    render(<AlertsPage />)

    fireEvent.click(screen.getByText('规则'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/alerts/triggers')
    })

    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'local' } })
    fireEvent.change(screen.getByLabelText('Metric'), { target: { value: 'cpu' } })
    fireEvent.change(screen.getByLabelText('Op'), { target: { value: '>=' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '90' } })
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'critical' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'high cpu' } })
    fireEvent.change(screen.getByLabelText('Email to'), { target: { value: 'a@b.com' } })

    fireEvent.click(screen.getByText('创建规则'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/alerts/triggers', {
        method: 'POST',
        body: JSON.stringify({
          host: 'local',
          metric: 'cpu',
          op: '>=',
          value: 90,
          level: 'critical',
          description: 'high cpu',
          email_to: 'a@b.com',
        }),
      })
    })
  })

  it('completes unresolved event with correct endpoint', async () => {
    apiMock
      .mockResolvedValueOnce([
        {
          id: 123,
          host: 'local',
          metric: 'cpu',
          level: 'warning',
          value: 99,
          message: 'too high',
          created_at: '2026-01-01T00:00:00Z',
          resolved: false,
        },
      ])
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce([]) // reload events

    render(<AlertsPage />)

    expect(await screen.findByText('too high')).toBeInTheDocument()

    fireEvent.click(screen.getByText('complete'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/alerts/events/123/complete', { method: 'POST' })
    })
  })
})

