import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'

function renderLayout(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/ui" element={<Layout />}>
          <Route index element={<div>Overview Content</div>} />
          <Route path="alerts" element={<div>Alerts Content</div>} />
          <Route path="ai" element={<div>AI Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  it('maps /ui route to 总览大屏 title', () => {
    renderLayout('/ui')
    expect(screen.getByText('总览大屏')).toBeInTheDocument()
  })

  it('maps /ui/alerts route to 告警中心 title', () => {
    renderLayout('/ui/alerts')
    expect(screen.getByText('告警中心', { selector: 'div' })).toBeInTheDocument()
  })

  it('adds navigation and icon accessibility semantics', () => {
    renderLayout('/ui/alerts')

    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '告警中心' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '告警中心图标' })).toBeInTheDocument()
  })

  it('shows section title and shell controls on /ui/ai route', () => {
    renderLayout('/ui/ai')

    expect(screen.getAllByText('AI 助手')).toHaveLength(2)
    expect(screen.getByText('AI Content')).toBeInTheDocument()
    expect(screen.getByLabelText('全局搜索')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '监控大屏' })).toBeInTheDocument()
  })
})
