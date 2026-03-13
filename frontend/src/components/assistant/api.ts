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
  // 主请求只返回 AI 回答，KG 和论文通过 enrichKG/enrichPapers 异步加载
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
    // Agent: 35s (backend has 30s budget), Chat: 28s (backend has 25s budget)
    // Must be LESS than Vercel 60s to avoid HTML error pages
    const timeoutMs = mode === 'agent' ? 35000 : 28000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
      res = await fetch(`${API_BASE}/assistant/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, role, pagePath, pageContext, provider, mode }),
        signal: controller.signal,
      })
    } catch (fetchErr: any) {
      clearTimeout(timer)
      if (fetchErr.name === 'AbortError') {
        throw new Error(
          mode === 'agent'
            ? 'Agent mode response timed out. Try a simpler question or switch to normal chat mode.'
            : 'Request timed out. Please try again.'
        )
      }
      throw new Error(`Network error: ${fetchErr.message || 'Connection failed'}`)
    }
    clearTimeout(timer)

    // Handle non-JSON responses (e.g. Vercel 502/504 HTML error pages)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      if (res.status === 502 || res.status === 504) {
        throw new Error(
          mode === 'agent'
            ? 'AI response timed out (502/504). Try a simpler question or switch to normal chat mode.'
            : 'Server response timed out (502/504). Please try again.'
        )
      }
      throw new Error(`Server error (HTTP ${res.status}). Please try again later.`)
    }

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

  // 异步加载知识图谱（主请求返回后调用，不阻塞 AI 回答）
  async enrichKG(): Promise<KGVisualization | null> {
    try {
      const res = await fetch(`${API_BASE}/assistant/enrich/kg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s独立超时
      })
      if (!res.ok) return null
      const json: ApiResponse<{ visualization: KGVisualization }> = await res.json()
      if (json.status !== 'success') return null
      return json.data?.visualization || null
    } catch {
      console.warn('[enrichKG] Failed (non-blocking)')
      return null
    }
  },

  // 异步加载论文（主请求返回后调用，不阻塞 AI 回答）
  async enrichPapers(userQuery?: string): Promise<{ papers: AcademicPaper[]; query: string } | null> {
    try {
      const res = await fetch(`${API_BASE}/assistant/enrich/papers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery || '' }),
        signal: AbortSignal.timeout(20000), // 20s独立超时
      })
      if (!res.ok) return null
      const json: ApiResponse<{ papers: AcademicPaper[]; query: string }> = await res.json()
      if (json.status !== 'success') return null
      return json.data || null
    } catch {
      console.warn('[enrichPapers] Failed (non-blocking)')
      return null
    }
  },
}
