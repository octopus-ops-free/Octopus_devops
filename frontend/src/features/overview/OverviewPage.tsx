import { useEffect, useState } from 'react'

import { AlertOverviewPanel } from './components/AlertOverviewPanel'
import { AlertTrendChart } from './components/AlertTrendChart'
import { CronTaskSummaryPanel } from './components/CronTaskSummaryPanel'
import { JobExecutionPlaceholder } from './components/JobExecutionPlaceholder'
import { KpiCards } from './components/KpiCards'
import { ResourceTopologyGraph } from './components/ResourceTopologyGraph'
import { TrendLineChart } from './components/TrendLineChart'
import { useOverviewAlertWindow } from './hooks/useOverviewAlertWindow'
import { useOverviewData } from './hooks/useOverviewData'
import type { AlertTrendResponse, CronSummaryResponse } from './services/overviewApi'
import { fetchAlertTrend, fetchCronSummary } from './services/overviewApi'
import type { OverviewTimeWindow } from './types'
import './OverviewPage.css'

function formatConnectionText(status: ReturnType<typeof useOverviewData>['connectionStatus']): string {
  if (status === 'connected') return '在线'
  if (status === 'reconnecting') return '重连中（保留上次数据）'
  if (status === 'snapshot-only') return '快照模式（离线）'
  if (status === 'disconnected') return '连接中断（仅展示缓存/空态）'
  return '初始化中'
}

function formatStatusClass(status: ReturnType<typeof useOverviewData>['connectionStatus']): string {
  if (status === 'connected') return 'overview-page__status--online'
  return 'overview-page__status--reconnecting'
}

export function OverviewPage() {
  const { snapshot, loading, error, connectionStatus } = useOverviewData()
  const { window, setWindow } = useOverviewAlertWindow('24h')
  const [alertTrend, setAlertTrend] = useState<AlertTrendResponse | null>(null)
  const [cronSummary, setCronSummary] = useState<CronSummaryResponse | null>(null)

  useEffect(() => {
    if (!snapshot?.monitoredHostName) return
    let cancelled = false
    fetchAlertTrend(window, snapshot.monitoredHostName)
      .then((r) => {
        if (!cancelled) setAlertTrend(r)
      })
      .catch(() => {
        if (!cancelled) setAlertTrend(null)
      })
    return () => {
      cancelled = true
    }
  }, [window, snapshot?.monitoredHostName, snapshot?.updatedAt])

  useEffect(() => {
    const id = Number(snapshot?.monitoredHostId)
    if (!snapshot || !Number.isFinite(id) || id <= 0) {
      setCronSummary(null)
      return
    }
    let cancelled = false
    fetchCronSummary(id, window)
      .then((r) => {
        if (!cancelled) setCronSummary(r)
      })
      .catch(() => {
        if (!cancelled) setCronSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [window, snapshot?.monitoredHostId, snapshot?.updatedAt])

  if (loading && !snapshot) {
    return (
      <section className="overview-page__state-card" aria-live="polite">
        <h2 className="overview-page__state-title">概览加载中</h2>
        <p className="overview-page__state-text">正在获取首页聚合数据...</p>
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className="overview-page__state-card" role="alert">
        <h2 className="overview-page__state-title">概览暂不可用</h2>
        <p className="overview-page__state-text">{error ?? '未获取到可展示的首页数据。'}</p>
      </section>
    )
  }

  const hasPartialError = Boolean(error)

  return (
    <div className="overview-page">
      <section className="overview-page__top">
        <KpiCards snapshot={snapshot} />
        <div className={`overview-page__status ${formatStatusClass(connectionStatus)}`} role="status" aria-live="polite">
          <span className="overview-page__status-dot" />
          <span className="overview-page__status-text">实时状态：{formatConnectionText(connectionStatus)}</span>
          {hasPartialError ? <span className="overview-page__status-tip">部分数据更新失败</span> : null}
        </div>
      </section>

      <section className="overview-page__middle">
        <div className="overview-page__window-toolbar" role="toolbar" aria-label="概览时间窗">
          {(['24h', '7d', '30d'] as OverviewTimeWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              className={`overview-page__window-btn${w === window ? ' overview-page__window-btn--active' : ''}`}
              aria-pressed={w === window}
              onClick={() => setWindow(w)}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="overview-page__middle-columns">
          <TrendLineChart snapshot={snapshot} timeWindow={window} onTimeWindowChange={setWindow} hideTabs />
          <AlertTrendChart trend={alertTrend} hostIp={snapshot.monitoredHostIp} />
          <AlertOverviewPanel snapshot={snapshot} trend={alertTrend} />
        </div>
      </section>

      <section className="overview-page__bottom">
        <CronTaskSummaryPanel summary={cronSummary} hostIp={snapshot.monitoredHostIp} />
        <JobExecutionPlaceholder />
        <ResourceTopologyGraph snapshot={snapshot} />
      </section>
    </div>
  )
}
