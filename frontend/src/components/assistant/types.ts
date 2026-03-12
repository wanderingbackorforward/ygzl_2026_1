// 悬浮小助手 - 类型定义

export type Role = 'researcher' | 'worker' | 'reporter'

export interface Conversation {
  id: string
  title: string
  role: Role
  pagePath?: string
  createdAt: string
  updatedAt: string
  messageCount?: number
  lastMessage?: string
  messages?: Message[]
}

export type Provider = 'auto' | 'claude' | 'deepseek'
export type AssistantMode = 'chat' | 'agent'

export interface AgentStep {
  iteration: number
  tool_name: string
  tool_input: Record<string, any>
  result_summary: string
  duration_ms: number
  success: boolean
}

export interface KGNode {
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

export interface KGEdge {
  source: string
  target: string
  type: string
  color: string
  label: string
  attrs?: Record<string, any>
}

export interface KGVisualization {
  nodes: KGNode[]
  edges: KGEdge[]
  stats?: {
    total_nodes?: number
    total_edges?: number
    node_types?: Record<string, number>
    edge_types?: Record<string, number>
  }
}

export interface AcademicPaper {
  title: string
  authors: string
  year: number | null
  citations: number
  url: string
  abstract: string
  doi: string
}

export interface Message {
  id: string
  conversationId?: string
  role: 'user' | 'assistant'
  content: string
  contentType?: 'text' | 'markdown' | 'chart' | 'table'
  model?: string
  provider?: string
  metadata?: {
    charts?: any[]
    dataCards?: any[]
    tables?: any[]
    mode?: AssistantMode
    tool_steps?: AgentStep[]
    total_iterations?: number
    total_duration_ms?: number
    kg_visualization?: KGVisualization
    papers?: AcademicPaper[]
    papers_query?: string
  }
  createdAt: string
}

export interface ProviderInfo {
  id: string
  name: string
  model: string
  available: boolean
}

export type ModuleKey =
  | 'settlement' | 'temperature' | 'cracks' | 'vibration'
  | 'insar' | 'advanced' | 'overview' | 'tickets'
  | 'shield-trajectory' | 'three' | 'cover' | 'general'

export interface QuickCommand {
  id: string
  title: string
  icon: string
  prompt: string
  role: Role
  modules?: ModuleKey[]  // if undefined, show on all modules
}
