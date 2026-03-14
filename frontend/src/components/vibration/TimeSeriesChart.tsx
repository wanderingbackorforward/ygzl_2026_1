/**
 * 时域波形图组件
 * 显示原始振动信号，标注PPV峰值点
 */

import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface TimeSeriesChartProps {
  timeData: number[]      // 时间序列（秒）
  amplitude: number[]     // 振幅（mm/s）
  ppv: number            // 峰值质点速度
  peakTime: number       // 峰值时刻
  channelId: number
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  timeData,
  amplitude,
  ppv,
  peakTime,
  channelId
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

    // 配置项
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `通道 ${channelId} 时域波形`,
        textStyle: {
          color: '#cbd5e1',
          fontSize: 14,
          fontWeight: 'normal'
        },
        left: 'center',
        top: 10
      },
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
          const time = params[0].value[0].toFixed(3)
          const amp = params[0].value[1].toFixed(2)
          return `时间: ${time}s<br/>振幅: ${amp} mm/s`
        }
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
        name: '振幅 (mm/s)',
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
        {
          name: '振幅',
          type: 'line',
          data: timeData.map((t, i) => [t, amplitude[i]]),
          smooth: false,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            color: '#06b6d4'
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6, 182, 212, 0.3)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.05)' }
            ])
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 50,
            itemStyle: {
              color: '#ef4444'
            },
            label: {
              formatter: `PPV\n${ppv.toFixed(2)}`,
              color: '#fff',
              fontSize: 10
            },
            data: [
              {
                coord: [peakTime, ppv],
                name: 'PPV峰值'
              }
            ]
          }
        }
      ]
    }

    chart.setOption(option)

    // 响应式
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [timeData, amplitude, ppv, peakTime, channelId])

  return <div ref={chartRef} className="h-full w-full" />
}
