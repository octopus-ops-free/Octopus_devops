import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { useEChart } from './useEChart'

const setOptionMock = vi.fn()
const resizeMock = vi.fn()
const disposeMock = vi.fn()

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: setOptionMock,
    resize: resizeMock,
    dispose: disposeMock,
  })),
}))

function HookHost() {
  const { containerRef } = useEChart()
  return <div ref={containerRef} />
}

describe('useEChart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setOptionMock.mockClear()
    resizeMock.mockClear()
    disposeMock.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('triggers chart resize on window resize', async () => {
    render(<HookHost />)
    expect(resizeMock).toHaveBeenCalledTimes(0)

    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(121)

    expect(resizeMock).toHaveBeenCalledTimes(1)
  })

  it('cleans up listener and disposes chart on unmount', async () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')

    const view = render(<HookHost />)
    expect(addListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    view.unmount()

    expect(removeListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(disposeMock).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(121)
    expect(resizeMock).toHaveBeenCalledTimes(0)

    addListenerSpy.mockRestore()
    removeListenerSpy.mockRestore()
  })
})
