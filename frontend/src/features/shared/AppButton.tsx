import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AppButtonVariant = 'primary' | 'secondary' | 'danger'

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant
  children: ReactNode
}

const baseStyle: React.CSSProperties = {
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--shell-border-strong)',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
}

const variants: Record<AppButtonVariant, React.CSSProperties> = {
  primary: {
    ...baseStyle,
    background: 'var(--shell-surface-raised)',
    color: 'var(--heading)',
    borderColor: 'var(--shell-border-strong)',
  },
  secondary: {
    ...baseStyle,
    background: 'var(--shell-surface-muted)',
    color: 'var(--text)',
    borderColor: 'var(--shell-border-medium)',
  },
  danger: {
    ...baseStyle,
    background: 'rgba(239, 68, 68, 0.14)',
    color: '#fecaca',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
}

export function AppButton({ variant = 'primary', style, children, ...props }: AppButtonProps) {
  return (
    <button
      {...props}
      style={{
        ...variants[variant],
        ...(props.disabled ? { opacity: 0.6, cursor: 'not-allowed' } : null),
        ...style,
      }}
    >
      {children}
    </button>
  )
}
