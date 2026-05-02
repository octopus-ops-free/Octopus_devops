import type { CSSProperties } from 'react'

import { PanelFrame } from './PanelFrame'

export function JobExecutionPlaceholder() {
  return (
    <PanelFrame title="作业执行记录">
      <p style={hint}>后续接入作业功能后，将在此展示执行历史与状态。</p>
      <div style={tableWrap} aria-hidden>
        <div style={emptyRow}>—</div>
        <div style={emptyRow}>—</div>
        <div style={emptyRow}>—</div>
      </div>
    </PanelFrame>
  )
}

const hint: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 12,
  color: '#8ea1bc',
  lineHeight: 1.5,
}

const tableWrap: CSSProperties = {
  borderRadius: 8,
  border: '1px dashed rgba(71, 85, 105, 0.5)',
  padding: 12,
  display: 'grid',
  gap: 8,
}

const emptyRow: CSSProperties = {
  height: 32,
  borderRadius: 6,
  background: 'rgba(15, 23, 42, 0.35)',
  color: '#475569',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
}
