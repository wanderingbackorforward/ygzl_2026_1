// 悬浮小助手 - API 客户端

import { API_BASE } from '../../lib/api'
import type { Conversation, Message, Role } from './types'

interface ApiResponse<T> {
  status: string
  data?: T
  message?: string
}

export const assistantApi = {
  // 获取对话列表
  async getConversations(limit = 100, pagePath?: string): Promise<Conversation[]> {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (pagePath) {
      params.append('page_path', pagePath)
    }
    const res = await fetch(`${API_BASE}/assistant/conversations?${params}`)
    const json: ApiResponse<Conversation[]> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || '获取对话列表失败')
    }
    return json.data || []
  },

  // 创建新对话
  async createConversation(title = '新对话', role: Role = 'researcher', pagePath?: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/assistant/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, role, pagePath }),
    })
    const json: ApiResponse<Conversation> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || '创建对话失败')
    }
    return json.data!
  },

  // 获取对话详情
  async getConversation(convId: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}`)
    const json: ApiResponse<Conversation> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || '获取对话详情失败')
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
      throw new Error(json.message || '更新对话失败')
    }
  },

  // 删除对话
  async deleteConversation(convId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}`, {
      method: 'DELETE',
    })
    const json: ApiResponse<any> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || '删除对话失败')
    }
  },

  // 发送消息
  async sendMessage(
    convId: string,
    content: string,
    role: Role,
    pagePath?: string,
    pageContext?: any
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const res = await fetch(`${API_BASE}/assistant/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, role, pagePath, pageContext }),
    })
    const json: ApiResponse<{ userMessage: Message; assistantMessage: Message }> = await res.json()
    if (!res.ok || json.status !== 'success') {
      throw new Error(json.message || '发送消息失败')
    }
    return json.data!
  },
}
