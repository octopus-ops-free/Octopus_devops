import { api } from '../../../lib/api'
import type {
  OverviewAlertItem,
  OverviewAlertLevel,
  OverviewFilters,
  OverviewKpi,
  OverviewResourceLink,
  OverviewResourceNode,
  OverviewResourceStatus,
  OverviewSnapshot,
  OverviewTimeWindow,
  OverviewTrendPoint,
} from '../types'

type MetricsApiRow = {
  created_at: string
  cpu_percent: number
  mem_percent: number
  disk_percent: number
}

type AlertApiRow = {
  id: number | string
  host: string
  metric: string
  level: string
  value: number
  threshold: number
  message: string
  resolved: boolean
  created_at: string
}

type ProcessApiRow = {
  pid: number
  user: string
  cpu: number
  mem: number
  cmd: string
}

type PortApiRow = {
  proto: string
  local: string
  state: string
  pid_program?: string | null
}

type LogSourceApiRow = {
  id: number
  host_id: number
  dir_path: string
}

type SourceTag = 'monitoring' | 'alerts' | 'resources' | 'logs'

/** 与 `HostOut` 对齐的最小字段，用于 metrics 的 `host` 与展示 IP */
export type HostApiRow = {
  id: number
  name: string
  ip: string
}

export type AlertTrendBucket = { start: string; counts: Record<string, number> }

export type AlertTrendResponse = {
  window: string
  buckets: AlertTrendBucket[]
}

export type CronSummaryResponse = {
  configured_lines: number
  success: number
  failure: number
  running: number
  skipped: number
  degraded: boolean
  detail?: string | null
}

class OverviewFatalSourceError extends Error {
  readonly degradedSources: SourceTag[]

  constructor(degradedSources: SourceTag[]) {
    super('overview core sources unavailable')
    this.name = 'OverviewFatalSourceError'
    this.degradedSources = degradedSources
  }
}

function mapAlertLevel(level: string): OverviewAlertLevel {
  if (level === 'critical' || level === 'warning' || level === 'info') return level
  if (level === 'high' || level === 'medium' || level === 'low') return level
  return 'warning'
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

async function fetchHostsList(): Promise<HostApiRow[]> {
  try {
    const rows = await api<HostApiRow[]>('/api/hosts')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export function resolveHost(hosts: HostApiRow[], key?: string): HostApiRow | null {
  const t = key?.trim()
  if (!t) return hosts[0] ?? null
  const byId = hosts.find((h) => String(h.id) === t)
  if (byId) return byId
  return hosts.find((h) => h.name === t) ?? null
}

function parsePositiveHostId(key?: string): number {
  const t = key?.trim()
  if (!t || !/^\d+$/.test(t)) return 0
  const n = Number(t)
  return Number.isInteger(n) && n > 0 ? n : 0
}

function windowStartIso(timeWindow: OverviewFilters['timeWindow']): string {
  const w = timeWindow ?? '24h'
  const ms = w === '24h' ? 86400000 : w === '7d' ? 7 * 86400000 : 30 * 86400000
  return new Date(Date.now() - ms).toISOString()
}

function metricLimit(timeWindow: OverviewFilters['timeWindow']): number {
  const w = timeWindow ?? '24h'
  if (w === '24h') return 500
  if (w === '7d') return 2000
  return 4000
}

function inferProcessType(cmd: string): OverviewResourceNode['type'] {
  const value = cmd.toLowerCase()
  if (/(k8s|kube|kubernetes)/.test(value)) return 'service'
  if (/(docker|containerd|podman|pod)/.test(value)) return 'container'
  if (/(mysql|postgres|redis|mongo|database|db)/.test(value)) return 'database'
  return 'process'
}

async function loadOverviewSources(filters: OverviewFilters): Promise<{
  metrics: MetricsApiRow[]
  allAlertRows: AlertApiRow[]
  processes: ProcessApiRow[]
  ports: PortApiRow[]
  logSources: LogSourceApiRow[]
  degradedSources: SourceTag[]
  hosts: HostApiRow[]
  resolved: HostApiRow | null
  metricsHost: string
  resourcesHostId: number
}> {
  const degradedSources: SourceTag[] = []
  const hosts = await fetchHostsList()
  const resolved = resolveHost(hosts, filters.host)
  const metricsHost = resolved?.name ?? 'local'
  const resourcesHostId = resolved?.id ?? parsePositiveHostId(filters.host)
  if (filters.host?.trim() && hosts.length > 0 && !resolved) {
    degradedSources.push('monitoring')
  }

  const since = windowStartIso(filters.timeWindow)
  const eventsQuery = new URLSearchParams({
    limit: '500',
    include_resolved: 'true',
    since,
  })

  const metricsQuery = new URLSearchParams({
    host: metricsHost,
    limit: String(metricLimit(filters.timeWindow)),
  })

  const metricsPromise = api<MetricsApiRow[]>(`/api/monitoring/metrics?${metricsQuery.toString()}`)
  const allEventsPromise = api<AlertApiRow[]>(`/api/alerts/events?${eventsQuery.toString()}`)
  const logsPromise = api<LogSourceApiRow[]>('/api/logs/sources')

  const resourcesEnabled = resourcesHostId > 0
  const processesPromise = resourcesEnabled
    ? api<ProcessApiRow[]>(`/api/resources/processes?host_id=${resourcesHostId}`)
    : Promise.resolve([] as ProcessApiRow[])
  const portsPromise = resourcesEnabled
    ? api<PortApiRow[]>(`/api/resources/ports?host_id=${resourcesHostId}`)
    : Promise.resolve([] as PortApiRow[])

  const [metrics, allEvents, logSources, processes, ports] = await Promise.allSettled([
    metricsPromise,
    allEventsPromise,
    logsPromise,
    processesPromise,
    portsPromise,
  ])

  if (metrics.status === 'rejected') degradedSources.push('monitoring')
  if (allEvents.status === 'rejected') degradedSources.push('alerts')
  if (resourcesEnabled && (processes.status === 'rejected' || ports.status === 'rejected')) degradedSources.push('resources')
  if (logSources.status === 'rejected') degradedSources.push('logs')
  const uniqueDegradedSources = unique(degradedSources)

  const monitoringFailed = metrics.status === 'rejected'
  const alertsFailed = allEvents.status === 'rejected'
  const resourcesFailed =
    resourcesEnabled && processes.status === 'rejected' && ports.status === 'rejected'
  const coreFailed = resourcesEnabled
    ? monitoringFailed && alertsFailed && resourcesFailed
    : monitoringFailed && alertsFailed
  if (coreFailed) {
    throw new OverviewFatalSourceError(uniqueDegradedSources)
  }

  return {
    metrics: metrics.status === 'fulfilled' && Array.isArray(metrics.value) ? metrics.value : [],
    allAlertRows: allEvents.status === 'fulfilled' && Array.isArray(allEvents.value) ? allEvents.value : [],
    processes: processes.status === 'fulfilled' && Array.isArray(processes.value) ? processes.value : [],
    ports: ports.status === 'fulfilled' && Array.isArray(ports.value) ? ports.value : [],
    logSources: logSources.status === 'fulfilled' && Array.isArray(logSources.value) ? logSources.value : [],
    degradedSources: uniqueDegradedSources,
    hosts,
    resolved,
    metricsHost,
    resourcesHostId,
  }
}

function buildTrend(metrics: MetricsApiRow[], alerts: AlertApiRow[]): OverviewTrendPoint[] {
  if (metrics.length === 0) return []

  const orderedMetrics = metrics
    .slice()
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const metricTimes = orderedMetrics.map((row) => Date.parse(row.created_at))
  const alertBuckets = new Array(orderedMetrics.length).fill(0)

  for (const alert of alerts) {
    const alertTime = Date.parse(alert.created_at)
    if (!Number.isFinite(alertTime)) continue
    let nearestMetricIdx = 0
    let nearestDelta = Number.POSITIVE_INFINITY
    for (let idx = 0; idx < metricTimes.length; idx += 1) {
      const delta = Math.abs(metricTimes[idx] - alertTime)
      if (delta < nearestDelta) {
        nearestDelta = delta
        nearestMetricIdx = idx
      }
    }
    alertBuckets[nearestMetricIdx] += 1
  }

  return orderedMetrics.map((row, idx) => ({
    timestamp: row.created_at,
    cpuPercent: Number(row.cpu_percent) || 0,
    memPercent: Number(row.mem_percent) || 0,
    diskPercent: Number(row.disk_percent) || 0,
    alertCount: alertBuckets[idx],
  }))
}

const ALERT_LEVEL_WEIGHT: Record<string, number> = {
  critical: 60,
  high: 50,
  warning: 40,
  medium: 30,
  info: 20,
  low: 10,
}

function compareAlertRowsBySpec(a: AlertApiRow, b: AlertApiRow): number {
  const wa = ALERT_LEVEL_WEIGHT[mapAlertLevel(a.level)] ?? 5
  const wb = ALERT_LEVEL_WEIGHT[mapAlertLevel(b.level)] ?? 5
  if (wa !== wb) return wb - wa
  return Date.parse(b.created_at) - Date.parse(a.created_at)
}

function buildAlerts(rows: AlertApiRow[], level?: OverviewFilters['level']): OverviewAlertItem[] {
  const merged = rows.slice().sort(compareAlertRowsBySpec)
  const filtered = level ? merged.filter((item) => mapAlertLevel(item.level) === level) : merged
  const limited = filtered.slice(0, 80)
  return limited.map((item) => ({
    id: String(item.id),
    host: item.host,
    metric: item.metric,
    level: mapAlertLevel(item.level),
    value: Number(item.value) || 0,
    threshold: Number(item.threshold) || 0,
    message: item.message ?? '',
    createdAt: item.created_at,
    resolved: Boolean(item.resolved),
  }))
}

function buildKpis(params: {
  hostCount: number
  activeAlerts: number
  previousActiveAlerts: number
  runningProcesses: number
  logSources: number
}): OverviewKpi[] {
  const activeAlertsDelta = params.activeAlerts - params.previousActiveAlerts
  const activeAlertsTrend: OverviewKpi['trend'] =
    activeAlertsDelta > 0 ? 'up' : activeAlertsDelta < 0 ? 'down' : 'flat'

  return [
    { key: 'hosts', label: '主机总数', value: params.hostCount, status: 'healthy' },
    {
      key: 'activeAlerts',
      label: '活动告警',
      value: params.activeAlerts,
      comparison: 'mom',
      delta: activeAlertsDelta,
      trend: activeAlertsTrend,
      status: params.activeAlerts > 0 ? 'warning' : 'healthy',
    },
    { key: 'runningProcesses', label: '进程数量', value: params.runningProcesses, status: 'healthy' },
    { key: 'logSources', label: '日志源', value: params.logSources, status: 'healthy' },
  ]
}

function buildTopology(
  filters: OverviewFilters,
  processes: ProcessApiRow[],
  ports: PortApiRow[],
  hostName: string,
): { nodes: OverviewResourceNode[]; links: OverviewResourceLink[] } {
  const rootId = `host:${hostName}`

  const nodes: OverviewResourceNode[] = [
    { id: rootId, name: hostName, type: 'host', status: 'healthy', host: hostName },
  ]
  const links: OverviewResourceLink[] = []

  const processNodes = processes.slice(0, 12).map((proc) => ({
    id: `proc:${proc.pid}`,
    name: proc.cmd || `pid-${proc.pid}`,
    type: inferProcessType(proc.cmd || ''),
    status: (Number(proc.cpu) > 90 || Number(proc.mem) > 90 ? 'warning' : 'healthy') as OverviewResourceStatus,
    host: hostName,
    value: Number(proc.cpu) || 0,
  }))
  nodes.push(...processNodes)
  links.push(
    ...processNodes.map((node) => ({
      source: rootId,
      target: node.id,
      kind: 'contains' as const,
      status: node.status,
    })),
  )

  const portNodes = ports.slice(0, 12).map((port, idx) => ({
    id: `port:${idx}:${port.local}`,
    name: `${port.proto}/${port.local}`,
    type: 'network' as const,
    status: port.state?.toUpperCase() === 'LISTEN' ? ('healthy' as const) : ('unknown' as const),
    host: hostName,
  }))
  nodes.push(...portNodes)
  links.push(
    ...portNodes.map((node) => ({
      source: rootId,
      target: node.id,
      kind: 'listens' as const,
      status: node.status,
      label: node.name,
    })),
  )

  if (filters.resourceType && filters.resourceType !== 'all') {
    const filteredNodes = nodes.filter((node) => node.type === 'host' || node.type === filters.resourceType)
    const allowedNodeIds = new Set(filteredNodes.map((node) => node.id))
    return {
      nodes: filteredNodes,
      links: links.filter((link) => allowedNodeIds.has(link.source) && allowedNodeIds.has(link.target)),
    }
  }

  return { nodes, links }
}

export async function fetchResourceTopology(
  filters: OverviewFilters,
): Promise<{ nodes: OverviewResourceNode[]; links: OverviewResourceLink[] }> {
  const hosts = await fetchHostsList()
  const resolved = resolveHost(hosts, filters.host)
  const hostId = resolved?.id ?? parsePositiveHostId(filters.host)
  const displayName = resolved?.name ?? (filters.host?.trim() || 'local')
  const resourcesEnabled = hostId > 0
  if (!resourcesEnabled) {
    return buildTopology(filters, [], [], displayName)
  }
  const [processes, ports] = await Promise.all([
    api<ProcessApiRow[]>(`/api/resources/processes?host_id=${hostId}`),
    api<PortApiRow[]>(`/api/resources/ports?host_id=${hostId}`),
  ])
  return buildTopology(filters, processes, ports, displayName)
}

export async function fetchOverviewSnapshot(filters: OverviewFilters): Promise<OverviewSnapshot> {
  const sourceData = await loadOverviewSources(filters)
  const topologyRootName = sourceData.resolved?.name ?? sourceData.metricsHost
  const topology = buildTopology(filters, sourceData.processes, sourceData.ports, topologyRootName)
  const alertRowsForList = sourceData.metricsHost
    ? sourceData.allAlertRows.filter((r) => r.host === sourceData.metricsHost)
    : sourceData.allAlertRows
  const alerts = buildAlerts(alertRowsForList, filters.level)

  const hostCandidates = [
    ...alerts.map((item) => item.host).filter(Boolean),
    ...(filters.host ? [filters.host] : []),
  ]

  const activeOpenCount = sourceData.allAlertRows.filter((item) => !item.resolved).length
  const previousActiveAlerts = 0

  const monitoredHostId = sourceData.resolved ? String(sourceData.resolved.id) : ''
  const monitoredHostName = sourceData.resolved?.name ?? sourceData.metricsHost
  const monitoredHostIp = sourceData.resolved?.ip ?? ''

  return {
    updatedAt: new Date().toISOString(),
    monitoredHostId,
    monitoredHostName,
    monitoredHostIp,
    kpis: buildKpis({
      hostCount: sourceData.hosts.length > 0 ? sourceData.hosts.length : unique(hostCandidates).length || 1,
      activeAlerts: activeOpenCount,
      previousActiveAlerts,
      runningProcesses: sourceData.processes.length,
      logSources: sourceData.logSources.length,
    }),
    trend: buildTrend(sourceData.metrics, sourceData.allAlertRows),
    alerts,
    topology,
    logSources: sourceData.logSources.length,
    degradedSources: sourceData.degradedSources,
  }
}

export async function fetchAlertTrend(
  window: OverviewTimeWindow,
  hostName?: string | null,
): Promise<AlertTrendResponse> {
  const q = new URLSearchParams({ window })
  if (hostName?.trim()) q.set('host', hostName.trim())
  return api<AlertTrendResponse>(`/api/alerts/trend?${q.toString()}`)
}

export async function fetchCronSummary(hostId: number, window: OverviewTimeWindow): Promise<CronSummaryResponse> {
  return api<CronSummaryResponse>(`/api/hosts/${hostId}/cron/summary?window=${window}`)
}
