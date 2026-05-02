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
  borderRadius: 12,
  border: '1px solid rgba(71, 85, 105, 0.48)',
  background: '#0b1324',
  padding: 12,
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
  color: '#dbe7ff',
  letterSpacing: 0.2,
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
