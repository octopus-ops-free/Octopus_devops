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
            <div style={brandTitle}>Octopus Ops</div>
            <div style={brandSub}>Control Center</div>
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
            <input aria-label="全局搜索" placeholder="搜索流程、脚本、任务..." style={searchInput} />
            <span style={badge}>3</span>
            <span style={avatar}>admin</span>
          </div>
        </header>
        <div style={contentWrap}>
          <Outlet />
        </div>
        <footer style={footerBar} aria-label="快速入口">
          {layoutNavItems.map((item) => (
            <NavLink
              key={`footer-${item.to}`}
              to={item.to}
              end={item.to === '/ui'}
              style={({ isActive }) => (isActive ? footerNavActive : footerNavLink)}
            >
              {item.label}
            </NavLink>
          ))}
        </footer>
      </main>
    </div>
  )
}

const shell: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '260px 1fr',
  minHeight: '100vh',
}

const sidebar: CSSProperties = {
  padding: 18,
  borderRight: '1px solid rgba(148, 163, 184, 0.18)',
  background: '#0b1220',
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
  background: '#2563eb',
  boxShadow: '0 0 18px rgba(37,99,235,0.25)',
}

const brandTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#eff4ff',
}

const brandSub: CSSProperties = {
  fontSize: 12,
  color: '#8ea1bc',
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
  color: '#b7c4d8',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(71, 85, 105, 0.35)',
  background: 'rgba(15,23,42,0.42)',
  transition: 'all 0.2s ease',
}

const activeNavLink: CSSProperties = {
  ...navLink,
  color: '#eff4ff',
  border: '1px solid rgba(59,130,246,0.65)',
  background: '#12223d',
  boxShadow: '0 8px 24px rgba(37,99,235,0.14)',
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
  gridTemplateRows: '58px 1fr 52px',
  gap: 10,
}

const topbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid rgba(71, 85, 105, 0.45)',
  background: '#0d1628',
}

const topbarTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#dbe7ff',
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
  border: '1px solid rgba(71, 85, 105, 0.6)',
  background: 'rgba(15, 23, 42, 0.7)',
  color: '#dbe7ff',
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
  border: '1px solid rgba(96, 165, 250, 0.55)',
  background: 'rgba(15, 23, 42, 0.75)',
  color: '#dbeafe',
  fontSize: 12,
}

const contentWrap: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  padding: '2px 4px',
}

const footerBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 10px',
  borderRadius: 12,
  border: '1px solid rgba(71, 85, 105, 0.45)',
  background: '#0d1628',
  overflowX: 'auto',
}

const footerNavLink: CSSProperties = {
  minHeight: 34,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(71, 85, 105, 0.55)',
  background: '#13243f',
  color: '#dbe7ff',
  fontSize: 12,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}

const footerNavActive: CSSProperties = {
  ...footerNavLink,
  border: '1px solid rgba(59,130,246,0.65)',
  background: '#1a3058',
  color: '#eff4ff',
}

const sidebarFooter: CSSProperties = {
  minHeight: 34,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 10px',
  color: '#9fb1c9',
  fontSize: 12,
  border: '1px solid rgba(71, 85, 105, 0.35)',
  background: 'rgba(15, 23, 42, 0.35)',
}

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#22c55e',
  boxShadow: '0 0 10px rgba(34,197,94,0.7)',
}