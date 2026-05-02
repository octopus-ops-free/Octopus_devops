export function TerminalPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid var(--shell-border-medium)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--shell-surface-muted)',
        }}
      >
        <iframe
          title="legacy-terminal"
          src="/terminal?embed=1"
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </div>
    </div>
  )
}

