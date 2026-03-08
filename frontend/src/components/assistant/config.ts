// 悬浮小助手 - 快捷指令配置

import type { QuickCommand } from './types'

export const quickCommands: QuickCommand[] = [
  {
    id: 'weekly-report',
    title: '生成本周沉降报告',
    icon: '📊',
    prompt: '请生成本周的沉降监测报告，包括：1. 整体趋势分析 2. 异常点位统计 3. 风险预警 4. 处置建议',
    role: 'reporter',
  },
  {
    id: 'check-anomalies',
    title: '检查异常点位',
    icon: '⚠️',
    prompt: '请检查当前所有监测点的异常情况，按严重程度排序，并给出处置建议',
    role: 'worker',
  },
  {
    id: 'predict-trend',
    title: '预测未来趋势',
    icon: '🔮',
    prompt: '请预测未来 30 天的沉降趋势，识别高风险点位，并分析可能的原因',
    role: 'researcher',
  },
  {
    id: 'event-impact',
    title: '施工事件影响分析',
    icon: '🏗️',
    prompt: '请分析最近的施工事件对沉降的影响，量化影响程度，并评估是否需要采取措施',
    role: 'researcher',
  },
  {
    id: 'spatial-correlation',
    title: '空间关联分析',
    icon: '🗺️',
    prompt: '请分析监测点之间的空间关联性，识别影响传播路径，并标注高风险区域',
    role: 'researcher',
  },
  {
    id: 'daily-inspection',
    title: '今日巡检清单',
    icon: '📋',
    prompt: '请生成今日需要巡检的点位清单，按优先级排序，并说明巡检重点',
    role: 'worker',
  },
]

export const roleConfig = {
  researcher: {
    label: '科研人员',
    color: '#8b5cf6',
    icon: '🔬',
    description: '专业详细，引用数据和算法',
  },
  worker: {
    label: '施工人员',
    color: '#f59e0b',
    icon: '👷',
    description: '简单直白，可操作性强',
  },
  reporter: {
    label: '项目汇报',
    color: '#10b981',
    icon: '📈',
    description: '总结性强，适合展示',
  },
}
