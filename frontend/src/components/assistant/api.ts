// 悬浮小助手 - API 客户端

import { API_BASE } from '../../lib/api'
import type { AgentStep, AcademicPaper, AssistantMode, Conversation, KGVisualization, Message, Provider, ProviderInfo, Role } from './types'

interface ApiResponse<T> {
  status: string
  data?: T
  message?: string
}

export const assistantApi = {
  // 获取可用 AI 模型列表
  async getProviders(): Promise<{ providers: ProviderInfo[]; default: string }> {
    const res = await fetch(`${API_BASE}/assistant/providers`)
    const json: ApiResponse<{ providers: ProviderInfo[]; default: string }> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to get providers')
    }
    return json.data!
  },

  // 获取对话列表
  async getConversations(limit = 100, pagePath?: string): Promise<Conversation[]> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (pagePath) {
      params.append('page_path', pagePath)
    }
    const res = await fetch(`${API_BASE}/assistant/conversations?${params}`)
    const json: ApiResponse<Conversation[]> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to get conversations')
    }
    return json.data || []
  },

  // 创建新对话
  async createConversation(title = 'New conversation', role: Role = 'researcher', pagePath?: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/assistant/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, role, pagePath }),
    })
    const json: ApiResponse<Conversation> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to create conversation')
    }
    return json.data!
  },

  // 获取对话详情
  async getConversation(convId: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}`)
    const json: ApiResponse<Conversation> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to get conversation')
    }
    return json.data!
  },

  // 更新对话
  async updateConversation(convId: string, updates: { title?: string; role?: Role }): Promise<void> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const json: ApiResponse<any> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to update conversation')
    }
  },

  // 删除对话
  async deleteConversation(convId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}`, {
      method: 'DELETE',
    })
    const json: ApiResponse<any> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to delete conversation')
    }
  },

  // 发送消息（支持选择 AI 模型和 Agent 模式）
  async sendMessage(
    convId: string,
    content: string,
    role: Role,
    pagePath?: string,
    pageContext?: any,
    provider: Provider = 'auto',
    mode: AssistantMode = 'chat'
  ): Promise<{
    userMessage: Message
    assistantMessage: Message
    model?: string
    provider?: string
    agentSteps?: AgentStep[]
    agentIterations?: number
    agentDurationMs?: number
    kgVisualization?: KGVisualization
    papers?: AcademicPaper[]
    papersQuery?: string
  }> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, role, pagePath, pageContext, provider, mode }),
    })
    const json: ApiResponse<{
      userMessage: Message
      assistantMessage: Message
      model?: string
      provider?: string
      agentSteps?: AgentStep[]
      agentIterations?: number
      agentDurationMs?: number
      kgVisualization?: KGVisualization
      papers?: AcademicPaper[]
      papersQuery?: string
    }> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || 'Failed to send message')
    }
    return json.data!
  },
}
