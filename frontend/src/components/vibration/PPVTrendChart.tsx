/**
 * PPV 趋势图组件
 * 8通道叠加 + GB规范三级阈值线
 */

import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { Thresholds } from '@/utils/vibration/types'

interface PPVTrendChartProps {
  channelsData: {
    channelId: number
    ppvTimeSeries: number[]  // PPV时间序列
    timestamps: number[]     // 时间戳（秒）
    color: string
    visible: boolean
  }[]
  thresholds: Thresholds
  highlightedChannelId: number | null
  onChannelClick?: (channelId: number) => void
}

export const PPVTrendChart: React.FC<PPVTrendChartProps> = ({
  channelsData,
  thresholds,
  highlightedChannelId,
  onChannelClick
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    // 准备系列数据
    const series = channelsData
      .filter(ch => ch.visible)
      .map(ch => ({
        name: `通道 ${ch.channelId}`,
        type: 'line',
        data: ch.ppvTimeSeries.map((ppv, i) => [ch.timestamps[i], ppv]),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: highlightedChannelId === ch.channelId ? 3 : 1.5,
          color: ch.color
        },
        emphasis: {
          lineStyle: {
            width: 3
          }
        }
      }))

    // 配置项
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: {
        left: 60,
        right: 40,
        top: 60,
        bottom: 60
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: {
          color: '#fff'
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''
          const time = params[0].value[0].toFixed(2)
          let html = `<div style="font-weight: bold; margin-bottom: 8px;">时间: ${time}s</div>`
          params.forEach((p: any) => {
            const ppv = p.value[1].toFixed(2)
            html += `<div style="margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color}; margin-right: 8px;"></span>
              ${p.seriesName}: <span style="font-weight: bold;">${ppv} mm/s</span>
            </div>`
          })
          return html
        }
      },
      legend: {
        data: series.map(s => s.name),
        textStyle: {
          color: '#cbd5e1'
        },
        top: 10,
        left: 'center'
      },
      xAxis: {
        type: 'value',
        name: '时间 (s)',
        nameTextStyle: {
          color: '#94a3b8'
        },
        axisLine: {
          lineStyle: {
            color: '#475569'
          }
        },
        axisLabel: {
          color: '#cbd5e1'
        },
        splitLine: {
          lineStyle: {
            color: '#334155',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'PPV (mm/s)',
        nameTextStyle: {
          color: '#94a3b8'
        },
        axisLine: {
          lineStyle: {
            color: '#475569'
          }
        },
        axisLabel: {
          color: '#cbd5e1'
        },
        splitLine: {
          lineStyle: {
            color: '#334155',
            type: 'dashed'
          }
        }
      },
      series: [
        ...series,
        // 停工线
        {
          name: '停工线',
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#ef4444',
              type: 'dashed',
              width: 2
            },
            label: {
              formatter: `停工 ${thresholds.stop.toFixed(1)} mm/s`,
              position: 'end',
              color: '#ef4444',
              fontSize: 12,
              fontWeight: 'bold'
            },
            data: [{ yAxis: thresholds.stop }]
          }
        },
        // 报警线
        {
          name: '报警线',
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#f97316',
              type: 'dashed',
              width: 2
            },
            label: {
              formatter: `报警 ${thresholds.alert.toFixed(1)} mm/s`,
              position: 'end',
              color: '#f97316',
              fontSize: 12
            },
            data: [{ yAxis: thresholds.alert }]
          }
        },
        // 预警线
        {
          name: '预警线',
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#eab308',
              type: 'dashed',
              width: 1.5
            },
            label: {
              formatter: `预警 ${thresholds.warn.toFixed(1)} mm/s`,
              position: 'end',
              color: '#eab308',
              fontSize: 12
            },
            data: [{ yAxis: thresholds.warn }]
          }
        }
      ]
    }

    chart.setOption(option)

    // 点击事件
    chart.off('click')
    chart.on('click', (params: any) => {
      if (params.componentType === 'series' && params.seriesType === 'line') {
        const channelName = params.seriesName
        const match = channelName.match(/通道 (\d+)/)
        if (match && onChannelClick) {
          onChannelClick(Number(match[1]))
        }
      }
    })

    // 响应式
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [channelsData, thresholds, highlightedChannelId, onChannelClick])

  return (
    <div ref={chartRef} className="h-full w-full" />
  )
}
