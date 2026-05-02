import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'

import { AiPage } from './AiPage'

describe('AiPage', () => {
  it('opens new tab with the given URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<AiPage />)

    fireEvent.change(screen.getByLabelText('aiAgentUrl'), { target: { value: 'http://example.com:8501' } })
    fireEvent.click(screen.getByRole('button', { name: '打开智能体' }))

    expect(openSpy).toHaveBeenCalledWith('http://example.com:8501', '_blank', 'noopener,noreferrer')
  })
})

