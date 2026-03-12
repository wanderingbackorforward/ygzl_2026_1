// 悬浮小助手 - 快捷指令配置

import type { ModuleKey, QuickCommand } from './types'

export const quickCommands: QuickCommand[] = [
  // ── 沉降模块 ──
  {
    id: 'settlement-report',
    title: '生成本周沉降报告',
    icon: '📊',
    prompt: '请生成本周的沉降监测报告，包括：1. 整体趋势分析 2. 异常点位统计 3. 风险预警 4. 处置建议',
    role: 'reporter',
    modules: ['settlement'],
  },
  {
    id: 'settlement-anomalies',
    title: '检查沉降异常点位',
    icon: '⚠️',
    prompt: '请检查当前所有沉降监测点的异常情况，按严重程度排序，并给出处置建议',
    role: 'worker',
    modules: ['settlement'],
  },
  {
    id: 'settlement-predict',
    title: '预测沉降趋势',
    icon: '🔮',
    prompt: '请预测未来 30 天的沉降趋势，识别高风险点位，并分析可能的原因',
    role: 'researcher',
    modules: ['settlement'],
  },
  {
    id: 'settlement-inspection',
    title: '沉降巡检清单',
    icon: '📋',
    prompt: '请生成今日需要巡检的沉降点位清单，按优先级排序，并说明巡检重点',
    role: 'worker',
    modules: ['settlement'],
  },

  // ── 温度模块 ──
  {
    id: 'temperature-report',
    title: '生成温度监测报告',
    icon: '📊',
    prompt: '请生成当前温度监测报告，包括：1. 各测点温度分布 2. 异常高温/低温点位 3. 温度变化趋势 4. 处置建议',
    role: 'reporter',
    modules: ['temperature'],
  },
  {
    id: 'temperature-anomalies',
    title: '检查温度异常',
    icon: '⚠️',
    prompt: '请检查当前所有温度监测点的异常情况，识别超温或温差过大的点位，并给出处置建议',
    role: 'worker',
    modules: ['temperature'],
  },
  {
    id: 'temperature-correlation',
    title: '温度-沉降关联分析',
    icon: '🔮',
    prompt: '请分析温度变化与沉降之间的关联性，找出温度对沉降影响最显著的区域',
    role: 'researcher',
    modules: ['temperature'],
  },

  // ── 裂缝模块 ──
  {
    id: 'crack-report',
    title: '生成裂缝监测报告',
    icon: '📊',
    prompt: '请生成当前裂缝监测报告，包括：1. 裂缝分布统计 2. 宽度/深度变化趋势 3. 新增裂缝情况 4. 处置建议',
    role: 'reporter',
    modules: ['cracks'],
  },
  {
    id: 'crack-anomalies',
    title: '检查裂缝异常',
    icon: '⚠️',
    prompt: '请检查当前所有裂缝监测点的异常情况，识别快速发展的裂缝，并给出处置建议',
    role: 'worker',
    modules: ['cracks'],
  },
  {
    id: 'crack-trend',
    title: '裂缝发展趋势分析',
    icon: '🔮',
    prompt: '请分析各裂缝点位的发展趋势，预测未来可能恶化的裂缝，并提出加固建议',
    role: 'researcher',
    modules: ['cracks'],
  },

  // ── 振动模块 ──
  {
    id: 'vibration-report',
    title: '生成振动监测报告',
    icon: '📊',
    prompt: '请生成当前振动监测报告，包括：1. 振动强度分布 2. 超标点位统计 3. 频谱特征分析 4. 处置建议',
    role: 'reporter',
    modules: ['vibration'],
  },
  {
    id: 'vibration-anomalies',
    title: '检查振动超标',
    icon: '⚠️',
    prompt: '请检查当前所有振动监测点的超标情况，识别振动源，并给出减振建议',
    role: 'worker',
    modules: ['vibration'],
  },

  // ── InSAR 模块 ──
  {
    id: 'insar-report',
    title: '生成 InSAR 分析报告',
    icon: '📊',
    prompt: '请生成当前 InSAR 监测报告，包括：1. 地表形变分布 2. 形变速率分析 3. 重点区域识别 4. 与地面监测对比',
    role: 'reporter',
    modules: ['insar'],
  },
  {
    id: 'insar-compare',
    title: 'InSAR 与地面数据对比',
    icon: '🔮',
    prompt: '请对比 InSAR 遥感数据与地面沉降监测数据，分析一致性和差异，评估数据可靠性',
    role: 'researcher',
    modules: ['insar'],
  },

  // ── 高级分析模块 ──
  {
    id: 'advanced-diagnosis',
    title: '智能异常诊断',
    icon: '⚠️',
    prompt: '请对所有监测数据进行综合异常诊断，识别异常点位，按严重程度分级，并给出处置建议',
    role: 'researcher',
    modules: ['advanced'],
  },
  {
    id: 'advanced-predict',
    title: '多点位趋势预测',
    icon: '🔮',
    prompt: '请对所有高风险点位进行趋势预测，预测未来 30 天的变化，并识别可能超限的点位',
    role: 'researcher',
    modules: ['advanced'],
  },
  {
    id: 'advanced-causal',
    title: '施工事件影响分析',
    icon: '🏗️',
    prompt: '请分析最近的施工事件对沉降的影响，量化影响程度，并评估是否需要采取措施',
    role: 'researcher',
    modules: ['advanced'],
  },
  {
    id: 'advanced-spatial',
    title: '空间关联分析',
    icon: '🗺️',
    prompt: '请分析监测点之间的空间关联性，识别影响传播路径，并标注高风险区域',
    role: 'researcher',
    modules: ['advanced'],
  },

  // ── 数据总览模块 ──
  {
    id: 'overview-summary',
    title: '生成数据总览摘要',
    icon: '📊',
    prompt: '请生成当前所有监测数据的总览摘要，包括各类数据的关键指标、异常统计和整体趋势',
    role: 'reporter',
    modules: ['overview'],
  },
  {
    id: 'overview-risk',
    title: '综合风险评估',
    icon: '⚠️',
    prompt: '请综合沉降、温度、裂缝、振动等多源数据，进行综合风险评估，识别高风险区域',
    role: 'researcher',
    modules: ['overview'],
  },

  // ── 工单模块 ──
  {
    id: 'tickets-overdue',
    title: '检查逾期工单',
    icon: '⚠️',
    prompt: '请检查当前所有逾期未完成的工单，列出负责人、逾期天数，并给出催办建议',
    role: 'worker',
    modules: ['tickets'],
  },
  {
    id: 'tickets-stats',
    title: '工单统计分析',
    icon: '📊',
    prompt: '请统计当前工单的完成情况，包括各状态工单数量、平均处理时间、各类型分布',
    role: 'reporter',
    modules: ['tickets'],
  },

  // ── 盾构轨迹模块 ──
  {
    id: 'shield-status',
    title: '盾构推进状态',
    icon: '📊',
    prompt: '请分析当前盾构推进状态，包括推进速度、偏差情况、姿态参数，并评估是否需要纠偏',
    role: 'worker',
    modules: ['shield-trajectory'],
  },
  {
    id: 'shield-impact',
    title: '盾构对沉降的影响',
    icon: '🔮',
    prompt: '请分析盾构推进对周边地表沉降的影响范围和程度，预测后续影响趋势',
    role: 'researcher',
    modules: ['shield-trajectory'],
  },

  // ── 通用指令（所有模块可用）──
  {
    id: 'general-help',
    title: '系统使用帮助',
    icon: '📋',
    prompt: '请介绍当前页面的功能和使用方法，帮助我快速上手',
    role: 'worker',
  },
  {
    id: 'general-export',
    title: '导出数据建议',
    icon: '📊',
    prompt: '请告诉我当前页面有哪些数据可以导出，以及推荐的导出格式和用途',
    role: 'reporter',
  },
]

/** 从路由路径推导模块 key */
export function pathToModule(pathname: string): ModuleKey {
  const seg = pathname.replace(/^\//, '').split('/')[0]
  const map: Record<string, ModuleKey> = {
    settlement: 'settlement',
    temperature: 'temperature',
    cracks: 'cracks',
    vibration: 'vibration',
    insar: 'insar',
    advanced: 'advanced',
    overview: 'overview',
    three: 'three',
    tickets: 'tickets',
    'shield-trajectory': 'shield-trajectory',
    cover: 'cover',
    tunnel: 'general',
    modules: 'general',
  }
  return map[seg] || 'general'
}

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
