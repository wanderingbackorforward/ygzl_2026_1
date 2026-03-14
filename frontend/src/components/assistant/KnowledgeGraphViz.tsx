import React, { useCallback, useEffect, useRef, useState } from 'react'

interface KGNode {
  id: string
  label: string
  type: string
  color: string
  size: number
  x: number
  y: number
  severity?: string
  attrs?: Record<string, any>
}

interface KGEdge {
  source: string
  target: string
  type: string
  color: string
  label: string
  attrs?: Record<string, any>
}

interface KnowledgeGraphVizProps {
  nodes: KGNode[]
  edges: KGEdge[]
  stats?: {
    total_nodes?: number
    total_edges?: number
    node_types?: Record<string, number>
    edge_types?: Record<string, number>
  }
}

const TYPE_LABELS: Record<string, string> = {
  MonitoringPoint: '监测点',
  ConstructionEvent: '施工事件',
  Anomaly: '异常',
  AcademicPaper: '参考文献',
  Document: '文献',
  Concept: '概念',
  Threshold: '预警阈值',
  SPATIAL_NEAR: '空间邻近',
  CORRELATES_WITH: '数据相关',
  CAUSES: '因果',
  DETECTED_AT: '检测于',
  REFERENCES: '参考',
  MENTIONS: '引用',
  RELATED_TO: '概念关联',
  EXCEEDS_THRESHOLD: '超限',
  NEAR_BY: '邻近',
}

const NODE_TYPE_COLORS: Record<string, string> = {
  MonitoringPoint: '#06b6d4',
  ConstructionEvent: '#f59e0b',
  Anomaly: '#ef4444',
  AcademicPaper: '#8b5cf6',
  Document: '#3b82f6',
  Concept: '#10b981',
  Threshold: '#facc15',
}

const EDGE_TYPE_COLORS: Record<string, string> = {
  SPATIAL_NEAR: '#38bdf8',
  CORRELATES_WITH: '#a78bfa',
  CAUSES: '#fb923c',
  DETECTED_AT: '#f87171',
  MENTIONS: '#3b82f6',
  RELATED_TO: '#10b981',
  EXCEEDS_THRESHOLD: '#facc15',
  NEAR_BY: '#06b6d4',
  REFERENCES: '#c084fc',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中等',
  low: '低',
}

export default function KnowledgeGraphViz({ nodes, edges, stats }: KnowledgeGraphVizProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<KGNode | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<KGEdge | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [collapsed, setCollapsed] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Build node position map
  const nodeMap = useRef<Map<string, KGNode>>(new Map())
  useEffect(() => {
    const m = new Map<string, KGNode>()
    nodes.forEach(n => m.set(n.id, n))
    nodeMap.current = m
  }, [nodes])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Track mouse position relative to container for tooltip
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    if (!isDragging) return
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }))
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Zoom handler - use native event listener to avoid passive event issue
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.3, Math.min(3, prev.scale * delta)),
      }))
    }
    container.addEventListener('wheel', handler, { passive: false })
    return () => container.removeEventListener('wheel', handler)
  }, [])

  if (!nodes || nodes.length === 0) return null

  if (collapsed) {
    return (
      <div className="mb-3 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-cyan-950/30 px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <i className="fas fa-project-diagram" style={{ color: '#06b6d4', fontSize: '16px' }} />
            <span className="text-base font-medium text-cyan-200">知识图谱</span>
            <span className="text-sm text-white">
              {stats?.total_nodes ?? nodes.length} 节点 / {stats?.total_edges ?? edges.length} 边
            </span>
          </div>
          <span className="text-sm text-white">点击展开 ▼</span>
        </button>
      </div>
    )
  }

  // Compute viewBox from node positions
  const xs = nodes.map(n => n.x)
  const ys = nodes.map(n => n.y)
  const minX = Math.min(...xs) - 60
  const maxX = Math.max(...xs) + 60
  const minY = Math.min(...ys) - 60
  const maxY = Math.max(...ys) + 60
  const viewWidth = maxX - minX || 800
  const viewHeight = maxY - minY || 600

  return (
    <div className="mb-3 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-cyan-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <i className="fas fa-project-diagram" style={{ color: '#06b6d4', fontSize: '16px' }} />
          <span className="text-base font-medium text-cyan-200">知识图谱</span>
          {stats && (
            <span className="text-sm text-white">
              {stats.total_nodes} 节点 / {stats.total_edges} 边
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button type="button" onClick={() => setTransform(p => ({ ...p, scale: Math.min(3, p.scale * 1.2) }))}
            className="rounded px-2 py-1 text-sm font-medium text-white hover:bg-white/10 hover:text-white">+</button>
          <button type="button" onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.3, p.scale * 0.8) }))}
            className="rounded px-2 py-1 text-sm font-medium text-white hover:bg-white/10 hover:text-white">-</button>
          <button type="button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
            className="rounded px-2 py-1 text-sm font-medium text-white hover:bg-white/10 hover:text-white">重置</button>
          <button type="button" onClick={() => setCollapsed(true)}
            className="rounded px-2 py-1 text-sm font-medium text-white hover:bg-white/10 hover:text-white">收起 ▲</button>
        </div>
      </div>

      {/* Legend - dynamic: only show types present in current graph */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-cyan-500/10 px-3 py-2">
        {[...new Set(nodes.map(n => n.type))].map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: NODE_TYPE_COLORS[t] || '#8b5cf6' }} />
            <span className="text-sm text-white">{TYPE_LABELS[t] || t}</span>
          </div>
        ))}
        {[...new Set(nodes.map(n => n.type))].length > 0 && [...new Set(edges.map(e => e.type))].length > 0 && (
          <span className="text-sm text-white">|</span>
        )}
        {[...new Set(edges.map(e => e.type))].map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: EDGE_TYPE_COLORS[t] || '#a78bfa' }} />
            <span className="text-sm text-white">{TYPE_LABELS[t] || t}</span>
          </div>
        ))}
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="relative cursor-grab active:cursor-grabbing"
        style={{ height: '320px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          viewBox={`${minX} ${minY} ${viewWidth} ${viewHeight}`}
          className="h-full w-full"
          style={{ background: 'transparent' }}
        >
          <defs>
            {/* Glow filter */}
            <filter id="kg-glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Arrow marker */}
            <marker id="kg-arrow" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" opacity="0.6" />
            </marker>
          </defs>

          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {edges.map((edge, i) => {
              const src = nodeMap.current.get(edge.source)
              const tgt = nodeMap.current.get(edge.target)
              if (!src || !tgt) return null
              const isHovered = hoveredEdge === edge
              return (
                <g key={`e-${i}`}>
                  <line
                    x1={src.x} y1={src.y}
                    x2={tgt.x} y2={tgt.y}
                    stroke={edge.color}
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    strokeOpacity={isHovered ? 0.9 : 0.4}
                    markerEnd="url(#kg-arrow)"
                    className="transition-all duration-200"
                  />
                  {/* Edge label at midpoint */}
                  <text
                    x={(src.x + tgt.x) / 2}
                    y={(src.y + tgt.y) / 2 - 6}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize={11}
                    fontWeight={isHovered ? 600 : 400}
                    opacity={isHovered ? 1 : 0.7}
                    className="pointer-events-none select-none transition-all duration-200"
                  >
                    {TYPE_LABELS[edge.type] || edge.label}
                  </text>
                  {/* Invisible wider line for hover */}
                  <line
                    x1={src.x} y1={src.y}
                    x2={tgt.x} y2={tgt.y}
                    stroke="transparent"
                    strokeWidth={10}
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{ cursor: 'pointer' }}
                  />
                </g>
              )
            })}

            {/* Animated pulse ring behind nodes */}
            {nodes.map(node => {
              if (node.type !== 'Anomaly') return null
              return (
                <circle
                  key={`pulse-${node.id}`}
                  cx={node.x} cy={node.y}
                  r={node.size * 0.6}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={1}
                  opacity={0.4}
                >
                  <animate attributeName="r" from={String(node.size * 0.5)} to={String(node.size * 1.2)} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isHovered = hoveredNode?.id === node.id
              const r = (node.size / 2) * (isHovered ? 1.3 : 1)
              const isPaper = node.type === 'AcademicPaper'
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: isPaper && node.attrs?.url ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (isPaper && node.attrs?.url) {
                      window.open(node.attrs.url, '_blank', 'noreferrer')
                    }
                  }}
                >
                  {/* Paper nodes: rounded rectangle; others: circle */}
                  {isPaper ? (
                    <rect
                      x={node.x - r} y={node.y - r * 0.75}
                      width={r * 2} height={r * 1.5}
                      rx={3} ry={3}
                      fill={node.color}
                      fillOpacity={isHovered ? 0.9 : 0.7}
                      stroke={isHovered ? '#fff' : node.color}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeOpacity={isHovered ? 0.8 : 0.3}
                      filter={isHovered ? 'url(#kg-glow)' : undefined}
                      className="transition-all duration-200"
                    />
                  ) : (
                    <circle
                      cx={node.x} cy={node.y} r={r}
                      fill={node.color}
                      fillOpacity={isHovered ? 0.9 : 0.7}
                      stroke={isHovered ? '#fff' : node.color}
                      strokeWidth={isHovered ? 2 : 1}
                      strokeOpacity={isHovered ? 0.8 : 0.3}
                      filter={isHovered ? 'url(#kg-glow)' : undefined}
                      className="transition-all duration-200"
                    />
                  )}
                  {/* Node label */}
                  <text
                    x={node.x} y={node.y + r + 14}
                    textAnchor="middle"
                    fill={isHovered ? '#ffffff' : '#f1f5f9'}
                    fontSize={isHovered ? 14 : 12}
                    fontWeight={isHovered ? 700 : 500}
                    className="pointer-events-none select-none transition-all duration-200"
                  >
                    {node.label.length > 12 ? node.label.slice(0, 12) + '...' : node.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredNode && (
          <div className="pointer-events-none absolute z-10 max-w-[280px] rounded-lg border border-cyan-500/30 bg-slate-900/95 px-4 py-3 text-sm shadow-lg shadow-cyan-500/10 backdrop-blur"
            style={{ left: Math.min(mousePos.x + 16, (containerRef.current?.clientWidth || 600) - 300), top: Math.min(mousePos.y + 16, (containerRef.current?.clientHeight || 400) - 200) }}>
            <div className="mb-1 text-base font-semibold text-cyan-200">{hoveredNode.label}</div>
            <div className="text-sm text-white">
              {TYPE_LABELS[hoveredNode.type] || hoveredNode.type}
            </div>
            {hoveredNode.severity && (
              <div className="mt-1.5">
                <span className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${
                  hoveredNode.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                  hoveredNode.severity === 'high' ? 'bg-orange-500/20 text-orange-300' :
                  hoveredNode.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-green-500/20 text-green-300'
                }`}>
                  {SEVERITY_LABELS[hoveredNode.severity] || hoveredNode.severity}
                </span>
              </div>
            )}
            {hoveredNode.attrs?.point_id && (
              <div className="mt-1 text-sm text-white">ID: {hoveredNode.attrs.point_id}</div>
            )}
            {/* Paper-specific tooltip */}
            {hoveredNode.type === 'AcademicPaper' && hoveredNode.attrs && (
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                {hoveredNode.attrs.title && (
                  <div className="text-sm font-medium leading-snug text-violet-200">{hoveredNode.attrs.title}</div>
                )}
                {hoveredNode.attrs.authors && (
                  <div className="text-sm text-white truncate">{hoveredNode.attrs.authors}</div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  {hoveredNode.attrs.year && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-white">{hoveredNode.attrs.year}</span>
                  )}
                  {hoveredNode.attrs.citations > 0 && (
                    <span className="text-amber-300">{hoveredNode.attrs.citations} 引用</span>
                  )}
                  {hoveredNode.attrs.doi && (
                    <span className="text-white">DOI</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edge tooltip */}
        {hoveredEdge && !hoveredNode && (
          <div className="pointer-events-none absolute z-10 max-w-[200px] rounded-lg border border-purple-500/30 bg-slate-900/95 px-4 py-3 text-sm shadow-lg backdrop-blur"
            style={{ left: Math.min(mousePos.x + 16, (containerRef.current?.clientWidth || 600) - 220), top: Math.min(mousePos.y + 16, (containerRef.current?.clientHeight || 400) - 150) }}>
            <div className="mb-1 text-base font-semibold text-purple-200">
              {TYPE_LABELS[hoveredEdge.type] || hoveredEdge.type}
            </div>
            {hoveredEdge.attrs?.distance != null && (
              <div className="text-sm text-white">距离: {hoveredEdge.attrs.distance}m</div>
            )}
            {hoveredEdge.attrs?.correlation != null && (
              <div className="text-sm text-white">相关系数: {hoveredEdge.attrs.correlation}</div>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {stats?.node_types && (
        <div className="flex shrink-0 items-center gap-3 border-t border-cyan-500/10 px-3 py-2 text-sm text-white">
          {Object.entries(stats.node_types).map(([type, count]) => (
            <span key={type}>{TYPE_LABELS[type] || type}: {count}</span>
          ))}
          <span className="text-slate-500">|</span>
          {Object.entries(stats.edge_types || {}).map(([type, count]) => (
            <span key={type}>{TYPE_LABELS[type] || type}: {count}</span>
          ))}
        </div>
      )}
    </div>
  )
}
