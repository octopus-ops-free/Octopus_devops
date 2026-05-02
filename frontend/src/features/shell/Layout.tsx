import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { CSSProperties } from 'react'
import hostsIcon from '../../assets/nav-icons/hosts.png'
import monitoringIcon from '../../assets/nav-icons/monitoring.png'
import alertsIcon from '../../assets/nav-icons/alerts.png'
import logsIcon from '../../assets/nav-icons/logs.png'
import usersIcon from '../../assets/nav-icons/users.png'
import notificationsIcon from '../../assets/nav-icons/notifications.png'
import securityIcon from '../../assets/nav-icons/security.png'
import databaseIcon from '../../assets/nav-icons/database.png'
import aiIcon from '../../assets/nav-icons/ai.png'
import terminalIcon from '../../assets/nav-icons/terminal.png'

type NavItem = {
  to: string
  label: string
  iconSrc: string
}

/** 侧边栏与底栏「快速入口」共用 */
export const layoutNavItems: NavItem[] = [
  { to: '/ui', label: '首页', iconSrc: hostsIcon },
  { to: '/ui/hosts', label: '资源管理', iconSrc: hostsIcon },
  { to: '/ui/monitoring', label: '监控告警', iconSrc: monitoringIcon },
  { to: '/ui/alerts', label: '告警中心', iconSrc: alertsIcon },
  { to: '/ui/logs', label: '作业管理', iconSrc: logsIcon },
  { to: '/ui/remote-users', label: '配置管理', iconSrc: usersIcon },
  { to: '/ui/resources', label: '变更发布', iconSrc: hostsIcon },
  { to: '/ui/notifications', label: '工单管理', iconSrc: notificationsIcon },
  { to: '/ui/security', label: '报表中心', iconSrc: securityIcon },
  { to: '/ui/db', label: '系统管理', iconSrc: databaseIcon },
  { to: '/ui/ai', label: 'AI 助手', iconSrc: aiIcon },
  { to: '/ui/terminal', label: '终端', iconSrc: terminalIcon },
]

function getTopbarTitle(pathname: string): string {
  if (pathname === '/ui' || pathname === '/ui/') return '总览大屏'
  const matched = layoutNavItems.find((item) => item.to !== '/ui' && pathname.startsWith(item.to))
  return matched?.label ?? '首页'
}

export function Layout() {
  const { pathname } = useLocation()

  return (
    <div style={shell}>
      <aside style={sidebar}>
        <div style={brandWrap}>
          <div style={brandLogo} />
          <div>
            <div style={brandTitle}>自动化运维平台</div>
            <div style={brandSub}>Octopus Ops · Control Center</div>
          </div>
        </div>

        <nav aria-label="主导航" style={nav}>
          {layoutNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/ui'}
              aria-label={item.label}
              style={({ isActive }) => (isActive ? activeNavLink : navLink)}
            >
              <span style={iconWrap}>
                <img src={item.iconSrc} alt={`${item.label}图标`} style={iconImage} />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={sidebarFooter}>
          <span style={dot} />
          <span>在线运行中</span>
        </div>
      </aside>
      <main style={main}>
        <header style={topbar}>
          <div style={topbarTitle}>{getTopbarTitle(pathname)}</div>
          <div style={topbarRight}>
            <input aria-label="全局搜索" placeholder="搜索资源、脚本、任务..." style={searchInput} />
            <span style={badge}>3</span>
            <span style={avatar}>admin</span>
          </div>
        </header>
        <div style={contentWrap}>
          <Outlet />
        </div>
        <footer style={footerBar} aria-label="快速入口">
          <span style={footerQuickLabel}>快速入口</span>
          <div style={footerQuickLinks}>
            {layoutNavItems.map((item) => (
              <NavLink
                key={`footer-${item.to}`}
                to={item.to}
                end={item.to === '/ui'}
                style={({ isActive }) => (isActive ? footerNavActive : footerNavLink)}
              >
                <img src={item.iconSrc} alt="" width={16} height={16} style={footerNavIcon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </footer>
      </main>
    </div>
  )
}

const shell: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '260px 1fr',
  minHeight: '100vh',
  background: 'var(--shell-bg)',
}

const sidebar: CSSProperties = {
  padding: 18,
  borderRight: '1px solid var(--shell-border)',
  background: 'var(--shell-sidebar-bg)',
  backdropFilter: 'blur(8px)',
}

const brandWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 16,
}

const brandLogo: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: 'var(--shell-brand-mark)',
  boxShadow: 'inset 0 1px 0 var(--shell-inset)',
  border: '1px solid var(--shell-border-medium)',
}

const brandTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--heading)',
}

const brandSub: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-soft)',
}

const nav: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginBottom: 12,
}

const navLink: CSSProperties = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  color: 'var(--text-soft)',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--shell-border)',
  background: 'rgba(255,255,255,0.02)',
  transition: 'all 0.2s ease',
}

const activeNavLink: CSSProperties = {
  ...navLink,
  color: 'var(--heading)',
  border: '1px solid var(--shell-nav-active-border)',
  background: 'var(--shell-nav-active-bg)',
  boxShadow: 'none',
}

const iconWrap: CSSProperties = {
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const iconImage: CSSProperties = {
  width: 18,
  height: 18,
  objectFit: 'contain',
  opacity: 0.95,
}

const main: CSSProperties = {
  padding: 14,
  display: 'grid',
  gridTemplateRows: '58px 1fr auto',
  gap: 12,
  background: 'var(--shell-bg)',
}

const topbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface)',
}

const topbarTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--heading)',
}

const topbarRight: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const searchInput: CSSProperties = {
  width: 280,
  maxWidth: '40vw',
  minHeight: 34,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
}

const badge: CSSProperties = {
  minWidth: 22,
  height: 22,
  borderRadius: 11,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  color: '#f8fafc',
  background: 'linear-gradient(180deg, #f43f5e, #be123c)',
}

const avatar: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  fontSize: 12,
}

const contentWrap: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  padding: '2px 4px',
  display: 'flex',
  flexDirection: 'column',
}

const footerBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  borderRadius: 14,
  border: '1px solid var(--shell-border-medium)',
  background: 'var(--shell-surface)',
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.2), inset 0 1px 0 var(--shell-inset)',
  overflowX: 'auto',
}

const footerQuickLabel: CSSProperties = {
  flexShrink: 0,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.02,
  color: '#94a3b8',
}

const footerQuickLinks: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  minWidth: 0,
}

const footerNavIcon: CSSProperties = {
  objectFit: 'contain',
  opacity: 0.92,
  flexShrink: 0,
}

const footerNavLink: CSSProperties = {
  minHeight: 36,
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid var(--shell-border)',
  background: 'var(--shell-surface-muted)',
  color: 'var(--text)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
}

const footerNavActive: CSSProperties = {
  ...footerNavLink,
  border: '1px solid var(--shell-nav-active-border)',
  background: 'var(--shell-nav-active-bg)',
  color: 'var(--heading)',
}

const sidebarFooter: CSSProperties = {
  minHeight: 34,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 10px',
  color: 'var(--text-soft)',
  fontSize: 12,
  border: '1px solid var(--shell-border)',
  background: 'rgba(255,255,255,0.02)',
}

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#22c55e',
  boxShadow: '0 0 10px rgba(34,197,94,0.7)',
}