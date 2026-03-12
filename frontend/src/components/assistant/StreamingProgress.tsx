import React, { useEffect, useRef, useState } from 'react'
import type { AssistantMode } from './types'

interface StreamingProgressProps {
  mode: AssistantMode
  startTime: number // Date.now() when request started
}

interface ProgressStep {
  label: string
  icon: string
  minTime: number   // seconds after start to show this step
  estimatedEnd: number // seconds - rough estimate when this step finishes
}

const AGENT_STEPS: ProgressStep[] = [
  { label: '\u6b63\u5728\u8fde\u63a5 AI \u670d\u52a1...', icon: '\ud83d\udd17', minTime: 0, estimatedEnd: 3 },
  { label: '\u6b63\u5728\u5206\u6790\u4f60\u7684\u95ee\u9898...', icon: '\ud83e\udde0', minTime: 2, estimatedEnd: 6 },
  { label: '\u6b63\u5728\u9009\u62e9\u5206\u6790\u5de5\u5177...', icon: '\ud83d\udd27', minTime: 5, estimatedEnd: 10 },
  { label: '\u6b63\u5728\u67e5\u8be2\u76d1\u6d4b\u6570\u636e...', icon: '\ud83d\udcca', minTime: 8, estimatedEnd: 18 },
  { label: '\u6b63\u5728\u8fd0\u884c\u5f02\u5e38\u68c0\u6d4b...', icon: '\ud83d\udd0d', minTime: 15, estimatedEnd: 25 },
  { label: '\u6b63\u5728\u6784\u5efa\u77e5\u8bc6\u56fe\u8c31...', icon: '\ud83d\udd78\ufe0f', minTime: 22, estimatedEnd: 35 },
  { label: '\u6b63\u5728\u68c0\u7d22\u5b66\u672f\u8bba\u6587...', icon: '\ud83d\udcda', minTime: 30, estimatedEnd: 42 },
  { label: '\u6b63\u5728\u751f\u6210\u56de\u7b54...', icon: '\u270d\ufe0f', minTime: 38, estimatedEnd: 55 },
  { label: '\u5373\u5c06\u5b8c\u6210\uff0c\u8bf7\u7a0d\u5019...', icon: '\u23f3', minTime: 50, estimatedEnd: 65 },
]

const CHAT_STEPS: ProgressStep[] = [
  { label: '\u6b63\u5728\u8fde\u63a5 AI \u670d\u52a1...', icon: '\ud83d\udd17', minTime: 0, estimatedEnd: 2 },
  { label: 'AI \u6b63\u5728\u601d\u8003...', icon: '\ud83e\udde0', minTime: 2, estimatedEnd: 8 },
  { label: '\u6b63\u5728\u751f\u6210\u56de\u7b54...', icon: '\u270d\ufe0f', minTime: 6, estimatedEnd: 15 },
  { label: '\u6b63\u5728\u4e30\u5bcc\u77e5\u8bc6\u56fe\u8c31...', icon: '\ud83d\udd78\ufe0f', minTime: 12, estimatedEnd: 22 },
  { label: '\u5373\u5c06\u5b8c\u6210\uff0c\u8bf7\u7a0d\u5019...', icon: '\u23f3', minTime: 20, estimatedEnd: 30 },
]

export default function StreamingProgress({ mode, startTime }: StreamingProgressProps) {
  const [elapsed, setElapsed] = useState(0)
  const [smoothProgress, setSmoothProgress] = useState(0)
  const rafRef = useRef<number>(0)

  const steps = mode === 'agent' ? AGENT_STEPS : CHAT_STEPS
  const totalEstimated = mode === 'agent' ? 60 : 25

  // High-precision timer using requestAnimationFrame
  useEffect(() => {
    let running = true
    const tick = () => {
      if (!running) return
      const now = (Date.now() - startTime) / 1000
      setElapsed(now)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [startTime])

  // Smooth progress animation - slows down as it approaches 95%
  useEffect(() => {
    // Use easing: fast at start, slows down near end
    // Never reaches 100% (that's when the response arrives)
    const raw = elapsed / totalEstimated
    // Deceleration curve: y = 1 - (1-x)^2, capped at 0.95
    const eased = Math.min(0.95, 1 - Math.pow(1 - Math.min(raw, 1), 2))
    setSmoothProgress(eased)
  }, [elapsed, totalEstimated])

  // Determine current step
  const currentStepIndex = steps.reduce((acc, step, i) => {
    return elapsed >= step.minTime ? i : acc
  }, 0)

  const currentStep = steps[currentStepIndex]
  const progressPercent = Math.round(smoothProgress * 100)

  return (
    <div className="mb-6 flex justify-start">
      <div className="w-full max-w-[75%] rounded-2xl bg-slate-700 px-6 py-5">
        {/* Thin progress bar at top */}
        <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-slate-600">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #06b6d4)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s linear infinite',
            }}
          />
        </div>

        {/* Current step with icon */}
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xl">{currentStep.icon}</span>
          <span className="text-lg font-medium text-white">
            {currentStep.label}
          </span>
          <span className="ml-auto text-sm text-slate-400">
            {progressPercent}%
          </span>
        </div>

        {/* Step timeline */}
        <div className="flex items-center gap-1">
          {steps.map((step, i) => {
            const isCompleted = i < currentStepIndex
            const isCurrent = i === currentStepIndex
            return (
              <div key={i} className="flex flex-1 flex-col items-center">
                {/* Step dot */}
                <div className="relative flex w-full items-center">
                  {/* Line before dot */}
                  {i > 0 && (
                    <div
                      className={`h-0.5 flex-1 transition-colors duration-500 ${
                        isCompleted ? 'bg-cyan-400' : 'bg-slate-600'
                      }`}
                    />
                  )}
                  {/* Dot */}
                  <div
                    className={`relative z-10 shrink-0 rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'h-2.5 w-2.5 bg-cyan-400'
                        : isCurrent
                          ? 'h-3.5 w-3.5 border-2 border-cyan-400 bg-slate-700'
                          : 'h-2 w-2 bg-slate-600'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 animate-ping rounded-full border border-cyan-400 opacity-50" />
                    )}
                  </div>
                  {/* Line after dot */}
                  {i < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 transition-colors duration-500 ${
                        isCompleted ? 'bg-cyan-400' : 'bg-slate-600'
                      }`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Elapsed time */}
        <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
          <span>
            {mode === 'agent' ? 'Agent \u6a21\u5f0f' : '\u5bf9\u8bdd\u6a21\u5f0f'}
          </span>
          <span>{elapsed.toFixed(1)}s</span>
        </div>

        {/* Shimmer animation keyframes */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    </div>
  )
}
