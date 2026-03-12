import React, { useState } from 'react'
import type { AgentStep } from './types'

// 工具名称中文映射
const TOOL_NAME_MAP: Record<string, string> = {
  list_monitoring_points: '列出监测点',
  query_settlement_data: '查询沉降数据',
  query_temperature_data: '查询温度数据',
  query_crack_data: '查询裂缝数据',
  query_construction_events: '查询施工事件',
  detect_anomalies: '异常检测',
  predict_settlement: '沉降预测',
  build_knowledge_graph: '构建知识图谱',
  query_knowledge_graph: '查询知识图谱',
  analyze_correlation: '关联分析',
  query_anomalies: '批量异常检测',
  search_academic_papers: '搜索学术论文',
}

// 工具图标映射
const TOOL_ICON_MAP: Record<string, string> = {
  list_monitoring_points: '📍',
  query_settlement_data: '📊',
  query_temperature_data: '🌡',
  query_crack_data: '🔍',
  query_construction_events: '🏗',
  detect_anomalies: '⚠',
  predict_settlement: '📈',
  build_knowledge_graph: '🕸',
  query_knowledge_graph: '🔎',
  analyze_correlation: '🔗',
  query_anomalies: '🔬',
  search_academic_papers: '📚',
}

interface AgentStepsProps {
  steps: AgentStep[]
  totalIterations?: number
  totalDurationMs?: number
}

export default function AgentSteps({ steps, totalIterations, totalDurationMs }: AgentStepsProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  if (!steps || steps.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-purple-400/40 bg-purple-900/20 px-4 py-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block rounded-md bg-purple-600 px-2 py-1 text-sm font-bold text-white border border-purple-400">
            Agent
          </span>
          <span className="text-sm font-medium text-slate-200">
            {steps.length} 步工具调用
          </span>
        </div>
        {totalDurationMs != null && (
          <span className="text-sm font-medium text-slate-300">
            {(totalDurationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const isExpanded = expandedStep === i
          const toolLabel = TOOL_NAME_MAP[step.tool_name] || step.tool_name
          const toolIcon = TOOL_ICON_MAP[step.tool_name] || '🔧'

          return (
            <div key={i} className="rounded-lg border border-slate-500/50 bg-slate-800/50">
              {/* Step header - clickable */}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                onClick={() => setExpandedStep(isExpanded ? null : i)}
              >
                {/* Status indicator */}
                <span className={`h-2 w-2 shrink-0 rounded-full ${step.success ? 'bg-green-400' : 'bg-red-400'}`} />

                {/* Icon + tool name */}
                <span className="shrink-0 text-base">{toolIcon}</span>
                <span className="font-semibold text-white">{toolLabel}</span>

                {/* Result summary */}
                <span className="min-w-0 flex-1 truncate text-slate-300">
                  {step.result_summary}
                </span>

                {/* Duration */}
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  {step.duration_ms}ms
                </span>

                {/* Expand arrow */}
                <span className={`shrink-0 text-xs text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-600 px-3 py-2.5 text-sm">
                  {/* Input params */}
                  <div className="mb-2">
                    <span className="font-bold text-slate-200">输入参数：</span>
                    <pre className="mt-1 overflow-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-200">
                      {JSON.stringify(step.tool_input, null, 2)}
                    </pre>
                  </div>
                  {/* Result summary */}
                  <div>
                    <span className="font-bold text-slate-200">结果摘要：</span>
                    <span className="ml-1 text-slate-200">{step.result_summary}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
