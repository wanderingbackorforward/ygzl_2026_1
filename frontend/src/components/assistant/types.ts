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
  }
  createdAt: string
}

export interface ProviderInfo {
  id: string
  name: string
  model: string
  available: boolean
}

export interface QuickCommand {
  id: string
  title: string
  icon: string
  prompt: string
  role: Role
}
