import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiGet, apiPatch } from '../lib/api'
import type { AppModule, ModuleStatus } from '../types/modules'

interface ModulesContextValue {
  modules: AppModule[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getByRoute: (routePath: string) => AppModule | undefined
  getByKey: (moduleKey: string) => AppModule | undefined
  setStatus: (moduleKey: string, status: ModuleStatus, updatedBy?: string, reason?: string) => Promise<AppModule | null>
}

const ModulesContext = createContext<ModulesContextValue | null>(null)

const MODULES_CACHE_KEY = 'modules_cache_v1'

function normalizeModules(rows: AppModule[]): AppModule[] {
  return (rows || [])
    .filter(Boolean)
    .filter(m => m.is_visible !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

async function fetchModulesWithRetry(): Promise<AppModule[]> {
  try {
    return await apiGet<AppModule[]>('/modules')
  } catch {
    await new Promise(resolve => setTimeout(resolve, 500))
    return await apiGet<AppModule[]>('/modules')
  }
}

function readCachedModules(): AppModule[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(MODULES_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCachedModules(rows: AppModule[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MODULES_CACHE_KEY, JSON.stringify(rows))
  } catch {
    return
  }
}

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<AppModule[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchModulesWithRetry()
      const normalized = normalizeModules(rows)
      setModules(normalized)
      writeCachedModules(normalized)
    } catch (e) {
      const cached = readCachedModules()
      if (cached?.length) {
        setModules(normalizeModules(cached))
        setError('模块配置服务暂时不可用，已使用上次成功配置')
      } else {
        setModules([])
        setError(e instanceof Error ? `模块配置接口不可用：${e.message}` : '模块配置接口不可用')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const getByRoute = useCallback((routePath: string) => {
    return modules.find(m => m.route_path === routePath)
  }, [modules])

  const getByKey = useCallback((moduleKey: string) => {
    return modules.find(m => m.module_key === moduleKey)
  }, [modules])

  const setStatus = useCallback(async (moduleKey: string, status: ModuleStatus, updatedBy?: string, reason?: string) => {
    const updated = await apiPatch<AppModule | null>('/modules', {
      module_key: moduleKey,
      status,
      updated_by: updatedBy,
      reason
    })
    if (updated) {
      setModules(prev => prev.map(m => (m.module_key === moduleKey ? { ...m, ...updated } : m)))
    }
    return updated
  }, [])

  const value: ModulesContextValue = useMemo(() => ({
    modules,
    loading,
    error,
    refresh,
    getByRoute,
    getByKey,
    setStatus,
  }), [modules, loading, error, refresh, getByRoute, getByKey, setStatus])

  return (
    <ModulesContext.Provider value={value}>
      {children}
    </ModulesContext.Provider>
  )
}

export function useModules(): ModulesContextValue {
  const ctx = useContext(ModulesContext)
  if (!ctx) throw new Error('useModules must be used within a ModulesProvider')
  return ctx
}
