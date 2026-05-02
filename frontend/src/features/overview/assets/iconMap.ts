import hostIcon from '../../../assets/icon-alias/host.png'
import cloudHostIcon from '../../../assets/icon-alias/cloud_host.png'
import physicalHostIcon from '../../../assets/icon-alias/physical_host.png'
import containerIcon from '../../../assets/icon-alias/container.png'
import k8sClusterIcon from '../../../assets/icon-alias/k8s_cluster.png'
import databaseIcon from '../../../assets/icon-alias/database.png'
import middlewareIcon from '../../../assets/icon-alias/middleware.png'
import networkIcon from '../../../assets/icon-alias/network.png'
import storageIcon from '../../../assets/icon-alias/storage.png'
import successIcon from '../../../assets/icon-alias/success.png'
import failureIcon from '../../../assets/icon-alias/failed.png'
import warningIcon from '../../../assets/icon-alias/warning.png'
import runningIcon from '../../../assets/icon-alias/running.png'
import pausedIcon from '../../../assets/icon-alias/paused.png'
import searchIcon from '../../../assets/icon-alias/search.png'
import filterIcon from '../../../assets/icon-alias/filter.png'
import relationIcon from '../../../assets/icon-alias/relation.png'
import treeIcon from '../../../assets/icon-alias/tree.png'
import groupIcon from '../../../assets/icon-alias/group.png'

type IconName =
  | '主机'
  | '云主机'
  | '物理机'
  | '容器'
  | 'K8s集群'
  | '数据库'
  | '中间件'
  | '网络'
  | '存储'
  | '成功'
  | '失败'
  | '警告'
  | '运行中'
  | '已暂停'
  | '搜索'
  | '筛选'
  | '关联'
  | '树形结构'
  | '分组'

type SemanticRule = {
  iconName: IconName
  aliases: string[]
}

const overviewRules: SemanticRule[] = [
  { iconName: 'K8s集群', aliases: ['k8s', 'kubernetes', '集群'] },
  { iconName: '云主机', aliases: ['云主机', 'cloudhost', 'cloudvm'] },
  { iconName: '物理机', aliases: ['物理机', 'baremetal', 'physicalhost'] },
  { iconName: '容器', aliases: ['容器', 'container', 'docker', 'pod'] },
  { iconName: '数据库', aliases: ['数据库', 'database', 'db', 'mysql', 'postgres', 'redis'] },
  { iconName: '中间件', aliases: ['中间件', 'middleware', 'mq', 'kafka', 'rabbitmq'] },
  { iconName: '网络', aliases: ['网络', 'network', 'vpc', 'subnet', 'route'] },
  { iconName: '存储', aliases: ['存储', 'storage', 'disk', 'volume', 'nas', 's3'] },
  { iconName: '主机', aliases: ['主机', 'host', 'server', '机器'] },
  { iconName: '搜索', aliases: ['搜索', 'search', 'query'] },
  { iconName: '筛选', aliases: ['筛选', 'filter'] },
  { iconName: '关联', aliases: ['关联', 'relation', 'link'] },
  { iconName: '树形结构', aliases: ['树形', 'tree', 'topology'] },
  { iconName: '分组', aliases: ['分组', 'group', 'clusterby'] },
]

const statusRules: SemanticRule[] = [
  { iconName: '成功', aliases: ['成功', 'success', 'ok', 'healthy', 'resolved'] },
  { iconName: '失败', aliases: ['失败', 'failed', 'error', 'critical', 'down'] },
  { iconName: '警告', aliases: ['警告', 'warning', 'warn', 'degraded'] },
  { iconName: '运行中', aliases: ['运行中', 'running', 'active', 'processing'] },
  { iconName: '已暂停', aliases: ['已暂停', 'paused', 'pause', 'stopped'] },
]

const iconLibrary: Record<IconName, string | undefined> = {
  主机: hostIcon,
  云主机: cloudHostIcon,
  物理机: physicalHostIcon,
  容器: containerIcon,
  K8s集群: k8sClusterIcon,
  数据库: databaseIcon,
  中间件: middlewareIcon,
  网络: networkIcon,
  存储: storageIcon,
  成功: successIcon,
  失败: failureIcon,
  警告: warningIcon,
  运行中: runningIcon,
  已暂停: pausedIcon,
  搜索: searchIcon,
  筛选: filterIcon,
  关联: relationIcon,
  树形结构: treeIcon,
  分组: groupIcon,
}

const DEFAULT_ICON_NAME: IconName = '主机'

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function matchSemanticIcon(name: string, rules: SemanticRule[]): IconName | null {
  const normalizedName = normalizeValue(name)
  const matched = rules.find((rule) => rule.aliases.some((alias) => normalizedName.includes(normalizeValue(alias))))
  return matched?.iconName ?? null
}

function resolveIcon(iconName: IconName): string {
  return iconLibrary[iconName] ?? iconLibrary[DEFAULT_ICON_NAME] ?? ''
}

export function getOverviewIcon(name: string): string {
  const iconName = matchSemanticIcon(name, overviewRules) ?? DEFAULT_ICON_NAME
  return resolveIcon(iconName)
}

export function getStatusIcon(level: string): string {
  const iconName = matchSemanticIcon(level, statusRules) ?? DEFAULT_ICON_NAME
  return resolveIcon(iconName)
}

export const __iconMapTestHooks = {
  iconLibrary,
}
