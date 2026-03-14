/**
 * 频谱FFT图组件
 * 显示频域特性，标注主频和带宽
 */

import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { FFTResult } from '@/utils/vibration/types'

interface FrequencySpectrumChartProps {
  fftResult: FFTResult
  channelId: number
}

export const FrequencySpectrumChart: React.FC<FrequencySpectrumChartProps> = ({
  fftResult,
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

    // 只显示 0-100Hz 的频谱（工程振动有效频段）
    const maxFreq = 100
    const validIndices = fftResult.frequencies
      .map((f, i) => (f <= maxFreq ? i : -1))
      .filter(i => i >= 0)

    const frequencies = validIndices.map(i => fftResult.frequencies[i])
    const amplitudes = validIndices.map(i => fftResult.amplitudes[i])

    // 配置项
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `通道 ${channelId} 频谱分析`,
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
          const freq = params[0].value[0].toFixed(1)
          const amp = params[0].value[1].toFixed(4)
          return `频率: ${freq} Hz<br/>幅值: ${amp}`
        }
      },
      xAxis: {
        type: 'value',
        name: '频率 (Hz)',
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
        },
        max: maxFreq
      },
      yAxis: {
        type: 'value',
        name: '幅值',
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
          name: '频谱',
          type: 'line',
          data: frequencies.map((f, i) => [f, amplitudes[i]]),
          smooth: false,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            color: '#8b5cf6'
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(139, 92, 246, 0.3)' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.05)' }
            ])
          },
          markPoint: {
            symbol: 'pin',
            symbolSize: 50,
            itemStyle: {
              color: '#f59e0b'
            },
            label: {
              formatter: `主频\n${fftResult.peakFrequency.toFixed(1)}Hz`,
              color: '#fff',
              fontSize: 10
            },
            data: [
              {
                coord: [fftResult.peakFrequency, fftResult.peakAmplitude],
                name: '主频'
              }
            ]
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#eab308',
              type: 'dashed',
              width: 1
            },
            label: {
              formatter: `带宽 ${fftResult.bandwidth.toFixed(1)} Hz`,
              position: 'end',
              color: '#eab308',
              fontSize: 10
            },
            data: [
              {
                xAxis: fftResult.peakFrequency - fftResult.bandwidth / 2
              },
              {
                xAxis: fftResult.peakFrequency + fftResult.bandwidth / 2
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
  }, [fftResult, channelId])

  return <div ref={chartRef} className="h-full w-full" />
}
