import { afterEach, describe, expect, it } from 'vitest'

import { __iconMapTestHooks, getOverviewIcon, getStatusIcon } from './iconMap'

const { iconLibrary } = __iconMapTestHooks

const originalLibraryHost = iconLibrary.主机
const originalLibraryCloudHost = iconLibrary.云主机
const originalLibraryWarning = iconLibrary.警告

describe('iconMap', () => {
  afterEach(() => {
    iconLibrary.主机 = originalLibraryHost
    iconLibrary.云主机 = originalLibraryCloudHost
    iconLibrary.警告 = originalLibraryWarning
  })

  it('maps resource semantic name to k8s icon', () => {
    const icon = decodeURIComponent(getOverviewIcon('kubernetes cluster'))
    expect(icon).toContain('icon-alias')
    expect(icon).toContain('k8s_cluster')
  })

  it('maps operation semantic name', () => {
    const icon = decodeURIComponent(getOverviewIcon('search nodes'))
    expect(icon).toContain('icon-alias')
    expect(icon).toContain('search')
  })

  it('maps status level to status icon', () => {
    const icon = decodeURIComponent(getStatusIcon('warning'))
    expect(icon).toContain('icon-alias')
    expect(icon).toContain('warning')
  })

  it('falls back to default host icon when status icon is missing', () => {
    iconLibrary.警告 = undefined
    const icon = decodeURIComponent(getStatusIcon('warning'))
    expect(icon).toContain('host')
  })

  it('falls back to default host icon when status semantic does not match', () => {
    const icon = decodeURIComponent(getStatusIcon('unknown_status'))
    expect(icon).toContain('host')
  })

  it('falls back to default host icon when semantic icon is missing', () => {
    iconLibrary.云主机 = undefined
    const icon = decodeURIComponent(getOverviewIcon('cloud host'))
    expect(icon).toContain('host')
  })
})
