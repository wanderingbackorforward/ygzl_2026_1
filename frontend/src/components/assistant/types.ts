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

export interface Message {
  id: string
  conversationId?: string
  role: 'user' | 'assistant'
  content: string
  contentType?: 'text' | 'markdown' | 'chart' | 'table'
  metadata?: {
    charts?: any[]
    dataCards?: any[]
    tables?: any[]
  }
  createdAt: string
}

export interface QuickCommand {
  id: string
  title: string
  icon: string
  prompt: string
  role: Role
}
