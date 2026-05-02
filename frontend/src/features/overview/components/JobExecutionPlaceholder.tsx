import type { CSSProperties } from 'react'

import { PanelFrame } from './PanelFrame'

export function JobExecutionPlaceholder() {
  return (
    <PanelFrame title="作业执行记录" subtitle="本地尚未接入作业调度 · 以下为版式占位">
      <p style={hint}>接入后将展示任务名称、状态、耗时与执行人，与参考大屏「作业执行记录」区块一致。</p>
      <div style={tableWrap} role="table" aria-label="作业执行记录占位">
        <div style={thead} role="row">
          <span style={th}>作业名称</span>
          <span style={th}>状态</span>
          <span style={th}>执行时间</span>
          <span style={th}>执行人</span>
        </div>
        <div style={emptyRow}>暂无记录</div>
        <div style={emptyRowMuted}>—</div>
        <div style={emptyRowMuted}>—</div>
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
  borderRadius: 10,
  border: '1px solid var(--shell-border-medium)',
  overflow: 'hidden',
  display: 'grid',
  gap: 0,
}

const thead: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 0.7fr 1fr 0.7fr',
  gap: 0,
  padding: '10px 12px',
  background: 'rgba(15, 23, 42, 0.75)',
  borderBottom: '1px solid var(--shell-border-medium)',
}

const th: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: 0.02,
}

const emptyRow: CSSProperties = {
  height: 40,
  padding: '0 12px',
  background: 'rgba(2, 6, 23, 0.35)',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  borderBottom: '1px solid var(--shell-border)',
}

const emptyRowMuted: CSSProperties = {
  ...emptyRow,
  height: 36,
  color: '#475569',
  fontSize: 11,
}
