/**
 * 特征雷达图组件
 * 16项完整特征 / 精选8项切换
 */

import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { VibrationFeatures, SelectedFeatures } from '@/utils/vibration/types'
import { normalize } from '@/utils/vibration/signalProcessing'

interface FeatureRadarChartProps {
  features: VibrationFeatures
  channelId: number
}

// 精选8项特征配置
const SELECTED_FEATURES: Array<{
  key: keyof SelectedFeatures
  label: string
  max: number
}> = [
  { key: 'standard_deviation', label: '标准差', max: 10 },
  { key: 'kurtosis', label: '峰度', max: 10 },
  { key: 'root_mean_square', label: '均方根', max: 20 },
  { key: 'peak_factor', label: '峰值因子', max: 5 },
  { key: 'pulse_factor', label: '脉冲因子', max: 5 },
  { key: 'peak_value', label: 'PPV', max: 30 },
  { key: 'center_frequency', label: '中心频率', max: 100 },
  { key: 'frequency_variance', label: '频率方差', max: 500 }
]

// 完整16项特征配置
const ALL_FEATURES: Array<{
  key: keyof VibrationFeatures
  label: string
  max: number
}> = [
  { key: 'mean_value', label: '均值', max: 5 },
  { key: 'standard_deviation', label: '标准差', max: 10 },
  { key: 'kurtosis', label: '峰度', max: 10 },
  { key: 'root_mean_square', label: '均方根', max: 20 },
  { key: 'wave_form_factor', label: '波形因子', max: 2 },
  { key: 'peak_factor', label: '峰值因子', max: 5 },
  { key: 'pulse_factor', label: '脉冲因子', max: 5 },
  { key: 'clearance_factor', label: '间隙因子', max: 10 },
  { key: 'peak_value', label: 'PPV', max: 30 },
  { key: 'waveform_center', label: '波形中心', max: 5 },
  { key: 'time_width', label: '时间带宽', max: 2 },
  { key: 'center_frequency', label: '中心频率', max: 100 },
  { key: 'frequency_variance', label: '频率方差', max: 500 },
  { key: 'mean_square_frequency', label: '均方频率', max: 1000 },
  { key: 'root_mean_square_frequency', label: '均方根频率', max: 50 },
  { key: 'frequency_standard_deviation', label: '频率标准差', max: 30 }
]

export const FeatureRadarChart: React.FC<FeatureRadarChartProps> = ({
  features,
  channelId
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!chartRef.current) return

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    // 选择特征配置
    const featureConfig = showAll ? ALL_FEATURES : SELECTED_FEATURES

    // 准备雷达图指标
    const indicator = featureConfig.map(f => ({
      name: f.label,
      max: f.max
    }))

    // 准备数据
    const data = featureConfig.map(f => features[f.key] || 0)

    // 配置项
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      title: {
        text: `通道 ${channelId} 特征分析 (${showAll ? '16项' : '精选8项'})`,
        textStyle: {
          color: '#cbd5e1',
          fontSize: 14,
          fontWeight: 'normal'
        },
        left: 'center',
        top: 10
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: {
          color: '#fff'
        }
      },
      radar: {
        indicator,
        center: ['50%', '55%'],
        radius: showAll ? '60%' : '70%',
        splitNumber: 4,
        name: {
          textStyle: {
            color: '#cbd5e1',
            fontSize: 11
          }
        },
        splitLine: {
          lineStyle: {
            color: '#334155'
          }
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(51, 65, 85, 0.1)', 'rgba(51, 65, 85, 0.2)']
          }
        },
        axisLine: {
          lineStyle: {
            color: '#475569'
          }
        }
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: data,
              name: '特征值',
              areaStyle: {
                color: 'rgba(6, 182, 212, 0.3)'
              },
              lineStyle: {
                color: '#06b6d4',
                width: 2
              },
              itemStyle: {
                color: '#06b6d4'
              }
            }
          ]
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
  }, [features, channelId, showAll])

  return (
    <div className="flex h-full flex-col">
      {/* 切换按钮 */}
      <div className="flex shrink-0 justify-center pb-2">
        <button
          onClick={() => setShowAll(!showAll)}
          className="rounded-md bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-600"
        >
          {showAll ? '显示精选8项' : '显示全部16项'}
        </button>
      </div>

      {/* 图表 */}
      <div ref={chartRef} className="min-h-0 flex-1" />
    </div>
  )
}
