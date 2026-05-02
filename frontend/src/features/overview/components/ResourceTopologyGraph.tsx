import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { init, type ECharts, type EChartsOption } from 'echarts'
import { PanelFrame } from './PanelFrame'
import { getOverviewIcon } from '../assets/iconMap'
import type { OverviewResourceNode, OverviewSnapshot } from '../types'

type NodeTypeFilter = 'all' | 'host' | 'container' | 'k8s' | 'database' | 'network'
type NodeLevelFilter = 'all' | 'normal' | 'warning' | 'fault'

interface ResourceTopologyGraphProps {
  snapshot: OverviewSnapshot
}

type GraphNodeData = {
  id: string
  name: string
  type: NodeTypeFilter | 'other'
  level: Exclude<NodeLevelFilter, 'all'>
}

type GraphLinkData = {
  source: string
  target: string
  status: string
  label?: string
}

const TYPE_FILTERS: Array<{ key: NodeTypeFilter; label: string }> = [
  { key: 'all', label: '全部类型' },
  { key: 'host', label: '主机' },
  { key: 'container', label: '容器' },
  { key: 'k8s', label: 'K8s' },
  { key: 'database', label: '数据库' },
  { key: 'network', label: '网络' },
]

const LEVEL_FILTERS: Array<{ key: NodeLevelFilter; label: string }> = [
  { key: 'all', label: '全部级别' },
  { key: 'normal', label: '正常' },
  { key: 'warning', label: '告警' },
  { key: 'fault', label: '故障' },
]

function mapNodeType(node: OverviewResourceNode): GraphNodeData['type'] {
  const value = `${node.type} ${node.name}`.toLowerCase()
  if (node.type === 'host') return 'host'
  if (node.type === 'network' || node.type === 'port') return 'network'
  if (node.type === 'database') return 'database'
  if (node.type === 'container') return 'container'
  if (node.type === 'service' || /(k8s|kube|kubernetes)/.test(value)) return 'k8s'
  if (/(docker|container|pod)/.test(value)) return 'container'
  if (/(mysql|postgres|redis|mongo|database|db)/.test(value)) return 'database'
  return 'other'
}

function mapNodeLevel(status: string): GraphNodeData['level'] {
  if (status === 'critical') return 'fault'
  if (status === 'warning' || status === 'unknown') return 'warning'
  return 'normal'
}

function toGraphNodeData(node: OverviewResourceNode): GraphNodeData {
  return {
    id: node.id,
    name: node.name,
    type: mapNodeType(node),
    level: mapNodeLevel(node.status),
  }
}

export function buildTopologyOption(params: {
  nodes: GraphNodeData[]
  links: GraphLinkData[]
  activeNodeId: string | null
}): EChartsOption {
  const { nodes, links, activeNodeId } = params
  const relatedNodes = new Set<string>()
  const relatedLinks = new Set<string>()

  if (activeNodeId) {
    relatedNodes.add(activeNodeId)
    for (const link of links) {
      const key = `${link.source}->${link.target}`
      if (link.source === activeNodeId || link.target === activeNodeId) {
        relatedNodes.add(link.source)
        relatedNodes.add(link.target)
        relatedLinks.add(key)
      }
    }
  }

  return {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(10, 17, 34, 0.95)',
      borderColor: 'rgba(71, 85, 105, 0.45)',
      textStyle: { color: '#dbeafe' },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 6,
        force: {
          repulsion: 260,
          edgeLength: [80, 140],
          gravity: 0.08,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 2.5 },
        },
        data: nodes.map((node) => {
          const dimmed = activeNodeId ? !relatedNodes.has(node.id) : false
          return {
            id: node.id,
            name: node.name,
            symbol: `image://${getOverviewIcon(node.type === 'k8s' ? 'kubernetes' : node.type)}`,
            symbolSize: node.type === 'host' ? 48 : 38,
            draggable: true,
            itemStyle: {
              opacity: dimmed ? 0.2 : 1,
            },
            label: {
              show: true,
              color: '#dbeafe',
              fontSize: 11,
              distance: 6,
            },
          }
        }),
        links: links.map((link) => {
          const key = `${link.source}->${link.target}`
          const dimmed = activeNodeId ? !relatedLinks.has(key) : false
          return {
            source: link.source,
            target: link.target,
            lineStyle: {
              width: activeNodeId && !dimmed ? 2.2 : 1.2,
              color: link.status === 'critical' ? '#ef4444' : link.status === 'warning' ? '#f59e0b' : '#60a5fa',
              opacity: dimmed ? 0.15 : 0.9,
            },
            label: {
              show: Boolean(link.label),
              color: '#9db2d3',
              fontSize: 10,
            },
          }
        }),
      },
    ],
  }
}

export function ResourceTopologyGraph({ snapshot }: ResourceTopologyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const pinnedNodeIdRef = useRef<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<NodeTypeFilter>('all')
  const [levelFilter, setLevelFilter] = useState<NodeLevelFilter>('all')
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null)

  const graphData = useMemo(() => {
    const nodes = snapshot.topology.nodes.map(toGraphNodeData)
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    const nonHostNodes = nodes.filter((node) => node.type !== 'host')

    const filteredNonHostNodes = nonHostNodes.filter((node) => {
      const typeMatched = typeFilter === 'all' ? true : node.type === typeFilter
      const levelMatched = levelFilter === 'all' ? true : node.level === levelFilter
      return typeMatched && levelMatched
    })

    const allowedNodeIds = new Set(filteredNonHostNodes.map((node) => node.id))
    const links = snapshot.topology.links
      .filter((link) => allowedNodeIds.has(link.source) || allowedNodeIds.has(link.target))
      .map((link) => ({
        source: String(link.source),
        target: String(link.target),
        status: link.status,
        label: link.label,
      }))

    for (const link of links) {
      allowedNodeIds.add(link.source)
      allowedNodeIds.add(link.target)
    }

    if (typeFilter === 'host') {
      for (const node of nodes) {
        if (node.type === 'host') allowedNodeIds.add(node.id)
      }
    }

    const filteredNodes = Array.from(allowedNodeIds)
      .map((id) => nodeMap.get(id))
      .filter((node): node is GraphNodeData => Boolean(node))

    return { nodes: filteredNodes, links }
  }, [levelFilter, snapshot.topology.links, snapshot.topology.nodes, typeFilter])

  useEffect(() => {
    pinnedNodeIdRef.current = pinnedNodeId
  }, [pinnedNodeId])

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return
    const chart = init(containerRef.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart

    const handleNodeHover = (event: any) => {
      if (event.dataType !== 'node' || pinnedNodeIdRef.current) return
      const nodeData = event.data as { id?: string } | undefined
      setActiveNodeId(nodeData?.id ?? null)
    }

    const handleNodeOut = (event: any) => {
      if (event.dataType !== 'node' || pinnedNodeIdRef.current) return
      setActiveNodeId(null)
    }

    const handleNodeClick = (event: any) => {
      if (event.dataType !== 'node') return
      const nodeData = event.data as { id?: string } | undefined
      const nodeId = nodeData?.id ?? null
      setPinnedNodeId((prev) => {
        const next = prev === nodeId ? null : nodeId
        setActiveNodeId(next)
        return next
      })
    }

    const zr = chart.getZr()
    const handleCanvasClick = (event: { target?: unknown }) => {
      if (event.target) return
      setPinnedNodeId(null)
      setActiveNodeId(null)
    }

    chart.on('mouseover', handleNodeHover)
    chart.on('mouseout', handleNodeOut)
    chart.on('click', handleNodeClick)
    zr.on('click', handleCanvasClick)

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      chart.off('mouseover', handleNodeHover)
      chart.off('mouseout', handleNodeOut)
      chart.off('click', handleNodeClick)
      zr.off('click', handleCanvasClick)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.setOption(
      buildTopologyOption({
        nodes: graphData.nodes,
        links: graphData.links,
        activeNodeId,
      }),
      { notMerge: true },
    )
  }, [activeNodeId, graphData])

  return (
    <PanelFrame
      title="资源拓扑"
      extra={
        <div style={filterWrapStyle}>
          <label style={labelStyle}>
            类型
            <select
              aria-label="资源类型筛选"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as NodeTypeFilter)}
              style={selectStyle}
            >
              {TYPE_FILTERS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            级别
            <select
              aria-label="资源级别筛选"
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value as NodeLevelFilter)}
              style={selectStyle}
            >
              {LEVEL_FILTERS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      <div ref={containerRef} style={chartContainerStyle} />
    </PanelFrame>
  )
}

const chartContainerStyle: CSSProperties = {
  width: '100%',
  height: 280,
}

const filterWrapStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 8,
}

const labelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#9db2d3',
  fontSize: 12,
}

const selectStyle: CSSProperties = {
  border: '1px solid rgba(71, 85, 105, 0.48)',
  borderRadius: 6,
  background: 'rgba(14, 24, 45, 0.85)',
  color: '#dbeafe',
  fontSize: 12,
  padding: '2px 6px',
}
