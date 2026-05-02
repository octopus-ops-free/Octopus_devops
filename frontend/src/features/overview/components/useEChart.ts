import { useCallback, useEffect, useRef } from 'react'
import { init, type ECharts, type EChartsOption, type SetOptionOpts } from 'echarts'

interface UseEChartResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  setChartOption: (option: EChartsOption, opts?: SetOptionOpts) => void
  resizeChart: () => void
}

export function useEChart(): UseEChartResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const resizeTimerRef = useRef<number | null>(null)

  const setChartOption = useCallback((option: EChartsOption, opts?: SetOptionOpts) => {
    if (!chartRef.current) {
      return
    }
    chartRef.current.setOption(option, opts)
  }, [])

  const resizeChart = useCallback(() => {
    chartRef.current?.resize()
  }, [])

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return
    }

    chartRef.current = init(containerRef.current, undefined, { renderer: 'canvas' })

    const handleResize = () => {
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }
      resizeTimerRef.current = window.setTimeout(() => {
        chartRef.current?.resize()
        resizeTimerRef.current = null
      }, 120)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
        resizeTimerRef.current = null
      }
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  return { containerRef, setChartOption, resizeChart }
}
