import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../lib/api', () => ({
  api: vi.fn().mockResolvedValue({ ok: true }),
}))

import { App } from './App'

describe('App', () => {
  it('renders heading and health status', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /octopus ops/i })).toBeInTheDocument()
    expect(await screen.findByText(/backend ok/i)).toBeInTheDocument()
  })
})