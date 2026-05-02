import { useCallback, useState } from 'react'

import type { OverviewTimeWindow } from '../types'

export function useOverviewAlertWindow(initial: OverviewTimeWindow = '24h') {
  const [window, setWindowState] = useState<OverviewTimeWindow>(initial)
  const setWindow = useCallback((w: OverviewTimeWindow) => {
    setWindowState(w)
  }, [])
  return { window, setWindow }
}
