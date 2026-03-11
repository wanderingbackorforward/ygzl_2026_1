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
    <div className="mb-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block rounded bg-purple-500/20 px-1.5 py-0.5 text-[11px] font-medium text-purple-300 border border-purple-500/30">
            Agent
          </span>
          <span className="text-[11px] text-slate-400">
            {steps.length} 步工具调用
          </span>
        </div>
        {totalDurationMs != null && (
          <span className="text-[11px] text-slate-500">
            {(totalDurationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step, i) => {
          const isExpanded = expandedStep === i
          const toolLabel = TOOL_NAME_MAP[step.tool_name] || step.tool_name
          const toolIcon = TOOL_ICON_MAP[step.tool_name] || '🔧'

          return (
            <div key={i} className="rounded border border-white/5 bg-white/[0.02]">
              {/* Step header - clickable */}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-white/5 transition-colors"
                onClick={() => setExpandedStep(isExpanded ? null : i)}
              >
                {/* Status indicator */}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${step.success ? 'bg-green-400' : 'bg-red-400'}`} />

                {/* Icon + tool name */}
                <span className="shrink-0">{toolIcon}</span>
                <span className="font-medium text-slate-200">{toolLabel}</span>

                {/* Result summary */}
                <span className="min-w-0 flex-1 truncate text-slate-400">
                  {step.result_summary}
                </span>

                {/* Duration */}
                <span className="shrink-0 text-[10px] text-slate-500">
                  {step.duration_ms}ms
                </span>

                {/* Expand arrow */}
                <span className={`shrink-0 text-[10px] text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/5 px-2.5 py-2 text-[11px]">
                  {/* Input params */}
                  <div className="mb-1.5">
                    <span className="font-medium text-slate-400">输入参数：</span>
                    <pre className="mt-0.5 overflow-auto rounded bg-black/30 p-2 text-slate-300">
                      {JSON.stringify(step.tool_input, null, 2)}
                    </pre>
                  </div>
                  {/* Result summary */}
                  <div>
                    <span className="font-medium text-slate-400">结果摘要：</span>
                    <span className="ml-1 text-slate-300">{step.result_summary}</span>
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
