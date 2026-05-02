import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../features/shell/Layout'
import { LoginPage } from '../features/login/LoginPage'
import { HostsPage } from '../features/hosts/HostsPage'
import { OverviewPage } from '../features/overview/OverviewPage'
import { MonitoringPage } from '../features/monitoring/MonitoringPage'
import { AlertsPage } from '../features/alerts/AlertsPage'
import { LogsPage } from '../features/logs/LogsPage'
import { RemoteUsersPage } from '../features/remote-users/RemoteUsersPage'
import { ResourcesPage } from '../features/resources/ResourcesPage'
import { NotificationsPage } from '../features/notifications/NotificationsPage'
import { SecurityPage } from '../features/security/SecurityPage'
import { DbPage } from '../features/db/DbPage'
import { AiPage } from '../features/ai/AiPage'
import { TerminalPage } from '../features/terminal/TerminalPage'

export const router = createBrowserRouter([
  { path: '/ui-login', element: <LoginPage /> },
  {
    path: '/ui',
    element: <Layout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'hosts', element: <HostsPage /> },
      { path: 'monitoring', element: <MonitoringPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'remote-users', element: <RemoteUsersPage /> },
      { path: 'resources', element: <ResourcesPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'db', element: <DbPage /> },
      { path: 'ai', element: <AiPage /> },
      { path: 'terminal', element: <TerminalPage /> },
    ],
  },
])