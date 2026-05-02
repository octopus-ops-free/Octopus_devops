import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourcesPage } from './ResourcesPage'

const apiMock = vi.fn()

vi.mock('../../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

describe('ResourcesPage legacy', () => {
  beforeEach(() => {
    apiMock.mockReset()
    vi.restoreAllMocks()
  })

  it('loads processes for selected host', async () => {
    apiMock
      .mockResolvedValueOnce([{ id: 1, name: 'web-01' }]) // /api/hosts
      .mockResolvedValueOnce([
        { pid: 100, user: 'root', cpu: 0.1, mem: 1.2, time: '00:00:01', cmd: 'nginx: master' },
      ]) // /api/resources/processes?host_id=1

    render(<ResourcesPage />)

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/hosts')
    })

    fireEvent.change(screen.getByLabelText('host_id'), { target: { value: '1' } })

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/resources/processes?host_id=1')
    })

    expect(await screen.findByText('nginx: master')).toBeInTheDocument()
  })

  it('clicking kill calls legacy kill endpoint with force=false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    apiMock
      .mockResolvedValueOnce([{ id: 1, name: 'web-01' }]) // /api/hosts
      .mockResolvedValueOnce([
        { pid: 123, user: 'app', cpu: 1, mem: 2, time: '00:00:10', cmd: 'python app.py' },
      ]) // /api/resources/processes?host_id=1
      .mockResolvedValueOnce({ ok: true }) // POST kill
      .mockResolvedValueOnce([
        { pid: 123, user: 'app', cpu: 1, mem: 2, time: '00:00:10', cmd: 'python app.py' },
      ]) // reload processes

    render(<ResourcesPage />)

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/hosts')
    })

    fireEvent.change(screen.getByLabelText('host_id'), { target: { value: '1' } })

    expect(await screen.findByText('python app.py')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('kill 123'))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/api/resources/processes/kill?host_id=1&pid=123&force=false', {
        method: 'POST',
      })
    })
  })
})

