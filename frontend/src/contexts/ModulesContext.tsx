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

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<AppModule[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await apiGet<AppModule[]>('/modules/')
      const normalized = (rows || [])
        .filter(Boolean)
        .filter(m => m.is_visible !== false)
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setModules(normalized)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载模块配置失败')
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
    const updated = await apiPatch<AppModule | null>(`/modules/${encodeURIComponent(moduleKey)}`, {
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
