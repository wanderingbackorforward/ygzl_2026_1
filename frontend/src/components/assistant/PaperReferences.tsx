import React, { useState } from 'react'

interface AcademicPaper {
  title: string
  authors: string
  year: number | null
  citations: number
  url: string
  abstract: string
  doi: string
}

interface PaperReferencesProps {
  papers: AcademicPaper[]
  query?: string
}

export default function PaperReferences({ papers, query }: PaperReferencesProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedPaper, setExpandedPaper] = useState<number | null>(null)

  if (!papers || papers.length === 0) return null

  if (collapsed) {
    return (
      <div className="mb-3 rounded-lg border border-amber-500/20 bg-gradient-to-br from-slate-900/80 to-amber-950/20 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📚</span>
            <span className="text-base font-medium text-amber-200">参考文献</span>
            <span className="text-sm text-slate-300">{papers.length} 篇</span>
          </div>
          <span className="text-sm text-slate-300">点击展开 ▼</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-amber-500/20 bg-gradient-to-br from-slate-900/80 to-amber-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-amber-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📚</span>
          <span className="text-base font-medium text-amber-200">参考文献</span>
          <span className="text-sm text-slate-300">{papers.length} 篇</span>
          {query && (
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-sm text-amber-300">
              {query}
            </span>
          )}
        </div>
        <button type="button" onClick={() => setCollapsed(true)}
          className="rounded px-2 py-1 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white">
          收起 ▲
        </button>
      </div>

      {/* Paper list */}
      <div className="max-h-[300px] overflow-y-auto">
        {papers.map((paper, i) => {
          const isExpanded = expandedPaper === i
          return (
            <div
              key={i}
              className="border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/[0.02]"
            >
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left"
                onClick={() => setExpandedPaper(isExpanded ? null : i)}
              >
                {/* Title */}
                <div className="mb-1 text-base font-medium leading-snug text-slate-100">
                  <span className="mr-1.5 text-amber-400">[{i + 1}]</span>
                  {paper.title}
                </div>

                {/* Authors + Year */}
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="min-w-0 flex-1 truncate">{paper.authors}</span>
                  {paper.year && (
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-sm text-slate-200">
                      {paper.year}
                    </span>
                  )}
                  {paper.citations > 0 && (
                    <span className="shrink-0 text-sm text-amber-300" title="引用数">
                      {paper.citations} 引用
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/5 px-3 py-2">
                  {paper.abstract && (
                    <p className="mb-2 text-sm leading-relaxed text-slate-300">
                      {paper.abstract}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    {paper.url && (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2.5 py-1 text-sm text-amber-300 hover:bg-amber-500/20 transition-colors"
                      >
                        <span>🔗</span> 查看论文
                      </a>
                    )}
                    {paper.doi && (
                      <span className="text-sm text-slate-300">
                        DOI: {paper.doi}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-amber-500/10 px-3 py-2 text-center text-sm text-slate-300">
        数据来源: Semantic Scholar
      </div>
    </div>
  )
}
