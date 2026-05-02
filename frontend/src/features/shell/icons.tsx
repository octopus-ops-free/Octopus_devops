import type { CSSProperties, ReactNode } from 'react'

type IconProps = { style?: CSSProperties }

function BaseIcon({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={style}
    >
      {children}
    </svg>
  )
}

export function OverviewIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <path d="M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z" />
    </BaseIcon>
  )
}

export function HostIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01M17 7h2M17 17h2" />
    </BaseIcon>
  )
}

export function MonitorIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4M7 12l2-2 2 2 4-4 2 2" />
    </BaseIcon>
  )
}

export function BellIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </BaseIcon>
  )
}

export function LogIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </BaseIcon>
  )
}

export function UsersIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a3 3 0 0 1 0 5.74" />
    </BaseIcon>
  )
}

export function ResourceIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </BaseIcon>
  )
}

export function MailIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </BaseIcon>
  )
}

export function ShieldIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <path d="M12 3 5 6v6c0 5 3.5 7.5 7 9 3.5-1.5 7-4 7-9V6l-7-3z" />
    </BaseIcon>
  )
}

export function DatabaseIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </BaseIcon>
  )
}

export function SparkIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <path d="m12 3 1.9 4.3L18 9l-4.1 1.7L12 15l-1.9-4.3L6 9l4.1-1.7L12 3z" />
    </BaseIcon>
  )
}

export function TerminalIcon({ style }: IconProps) {
  return (
    <BaseIcon style={style}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m8 9 3 3-3 3M13 15h3" />
    </BaseIcon>
  )
}

