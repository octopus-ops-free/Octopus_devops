import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { NotificationsPage } from './NotificationsPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('NotificationsPage SMTP', () => {
  beforeEach(() => {
    apiMock.mockReset()
  })

  it('loads smtp settings and saves via PUT', async () => {
    apiMock.mockResolvedValueOnce({
      smtp_host: 'smtp.example.com',
      smtp_port: 25,
      smtp_username: 'u1',
      smtp_from: 'noreply@example.com',
      use_tls: false,
    })
    apiMock.mockResolvedValueOnce({ ok: true })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/notifications/smtp')
    })

    expect(await screen.findByDisplayValue('smtp.example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('smtp_host'), { target: { value: 'smtp2.example.com' } })
    fireEvent.change(screen.getByLabelText('smtp_port'), { target: { value: '587' } })
    fireEvent.change(screen.getByLabelText('smtp_username'), { target: { value: 'u2' } })
    fireEvent.change(screen.getByLabelText('smtp_from'), { target: { value: 'ops@example.com' } })
    fireEvent.change(screen.getByLabelText('smtp_password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByLabelText('use_tls'))

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/notifications/smtp', {
        method: 'PUT',
        body: JSON.stringify({
          smtp_host: 'smtp2.example.com',
          smtp_port: 587,
          smtp_username: 'u2',
          smtp_from: 'ops@example.com',
          use_tls: true,
          smtp_password: 'secret',
        }),
      })
    })
  })
})

