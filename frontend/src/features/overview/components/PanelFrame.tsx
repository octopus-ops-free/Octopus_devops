import type { CSSProperties, ReactNode } from 'react'

interface PanelFrameProps {
  title: string
  /** 标题下小字，如主机 IP 说明 */
  subtitle?: string
  extra?: ReactNode
  children: ReactNode
}

export function PanelFrame({ title, subtitle, extra, children }: PanelFrameProps) {
  return (
    <section style={panelStyle}>
      <header style={headerStyle}>
        <div>
          <h3 style={titleStyle}>{title}</h3>
          {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
        </div>
        {extra ? <div style={extraStyle}>{extra}</div> : null}
      </header>
      <div style={bodyStyle}>{children}</div>
    </section>
  )
}

const panelStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface)',
  padding: 14,
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 var(--shell-inset)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: '#f8fafc',
  letterSpacing: 0.02,
}

const subtitleStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: '#8ea1bc',
  fontWeight: 500,
}

const extraStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
}

const bodyStyle: CSSProperties = {
  minHeight: 220,
}
