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
    // Agent: 50s (backend has 45s budget + network), Chat: 28s (backend has 25s budget)
    // Must be LESS than Vercel 60s to avoid HTML error pages
    const timeoutMs = mode === 'agent' ? 50000 : 28000
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

  // SSE 流式发送消息 - 逐 token 返回，不会 504 超时
  sendMessageStream(
    convId: string,
    content: string,
    role: Role,
    pagePath?: string,
    pageContext?: any,
    provider: Provider = 'auto',
    mode: AssistantMode = 'chat',
    callbacks?: {
      onThinking?: (status: string, extra?: any) => void
      onToolStart?: (toolName: string, toolInput: any, iteration: number) => void
      onToolEnd?: (toolName: string, summary: string, durationMs: number, success: boolean) => void
      onTextDelta?: (delta: string) => void
      onError?: (message: string) => void
      onDone?: (data: {
        message_id: string
        model: string
        user_message: Message
        tool_steps?: AgentStep[]
        kg_visualization?: KGVisualization
        papers?: AcademicPaper[]
        papers_query?: string
      }) => void
    }
  ): { abort: () => void } {
    const controller = new AbortController()

    const run = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/assistant/conversations/${convId}/messages/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, role, pagePath, pageContext, provider, mode }),
            signal: controller.signal,
          }
        )

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          callbacks?.onError?.(`HTTP ${res.status}: ${text.slice(0, 200)}`)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          callbacks?.onError?.('No response body')
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // keep incomplete line

          let currentEvent = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6))
                switch (currentEvent) {
                  case 'thinking':
                    callbacks?.onThinking?.(data.status, data)
                    break
                  case 'tool_start':
                    callbacks?.onToolStart?.(data.tool_name, data.tool_input, data.iteration)
                    break
                  case 'tool_end':
                    callbacks?.onToolEnd?.(data.tool_name, data.result_summary, data.duration_ms, data.success)
                    break
                  case 'text_delta':
                    callbacks?.onTextDelta?.(data.delta)
                    break
                  case 'error':
                    callbacks?.onError?.(data.message)
                    break
                  case 'done':
                    callbacks?.onDone?.(data)
                    break
                }
              } catch {
                // skip malformed JSON
              }
              currentEvent = ''
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          callbacks?.onError?.(err.message || 'Stream connection failed')
        }
      }
    }

    run()
    return { abort: () => controller.abort() }
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
