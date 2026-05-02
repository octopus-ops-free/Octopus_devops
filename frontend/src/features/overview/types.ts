export type OverviewAlertLevel = 'info' | 'warning' | 'critical' | 'low' | 'medium' | 'high'
export type OverviewResourceType = 'host' | 'process' | 'port' | 'service' | 'database' | 'network' | 'container'
export type OverviewResourceStatus = 'healthy' | 'warning' | 'critical' | 'unknown'
export type OverviewTimeWindow = '24h' | '7d' | '30d'

export interface OverviewKpi {
  key: 'hosts' | 'activeAlerts' | 'runningProcesses' | 'logSources'
  label: string
  value: number
  unit?: string
  comparison?: 'yoy' | 'mom'
  delta?: number
  trend?: 'up' | 'down' | 'flat'
  status?: OverviewResourceStatus
}

export interface OverviewTrendPoint {
  timestamp: string
  cpuPercent: number
  memPercent: number
  diskPercent: number
  alertCount: number
}

export interface OverviewAlertItem {
  id: string
  host: string
  metric: string
  level: OverviewAlertLevel
  value: number
  threshold: number
  message: string
  createdAt: string
  resolved: boolean
}

export interface OverviewResourceNode {
  id: string
  name: string
  type: OverviewResourceType
  status: OverviewResourceStatus
  host?: string
  value?: number
}

export interface OverviewResourceLink {
  source: string
  target: string
  kind: 'contains' | 'listens' | 'depends'
  status: OverviewResourceStatus
  value?: number
  label?: string
}

export interface OverviewSnapshot {
  updatedAt: string
  /** 当前概览解析到的被监控主机（与 metrics 的 Host.name 对齐） */
  monitoredHostId: string
  monitoredHostName: string
  monitoredHostIp: string
  kpis: OverviewKpi[]
  trend: OverviewTrendPoint[]
  alerts: OverviewAlertItem[]
  topology: {
    nodes: OverviewResourceNode[]
    links: OverviewResourceLink[]
  }
  logSources: number
  degradedSources: Array<'monitoring' | 'alerts' | 'resources' | 'logs'>
}

export interface OverviewFilters {
  host?: string
  level?: OverviewAlertLevel
  resourceType?: OverviewResourceType | 'all'
  timeWindow?: OverviewTimeWindow
}

// Task 1 lifecycle only emits: idle -> snapshot-only(discovery success) | disconnected(fetch failed).
// connected/reconnecting are reserved for Task 3 real-time channel integration.
export type OverviewConnectionStatus =
  | 'idle'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'snapshot-only'

export interface OverviewDataState {
  snapshot: OverviewSnapshot | null
  loading: boolean
  error: string | null
  connectionStatus: OverviewConnectionStatus
}
