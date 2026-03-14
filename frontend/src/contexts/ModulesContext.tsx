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

const FALLBACK_MODULES: AppModule[] = [
  { module_key: 'cover', route_path: '/cover', display_name: '封面', icon_class: 'fas fa-home', sort_order: 10, status: 'developed', is_visible: true },
  { module_key: 'settlement', route_path: '/settlement', display_name: '沉降', icon_class: 'fas fa-chart-area', sort_order: 20, status: 'developed', is_visible: true },
  { module_key: 'temperature', route_path: '/temperature', display_name: '温度', icon_class: 'fas fa-thermometer-half', sort_order: 30, status: 'developed', is_visible: true },
  { module_key: 'cracks', route_path: '/cracks', display_name: '裂缝', icon_class: 'fas fa-bug', sort_order: 40, status: 'developed', is_visible: true },
  { module_key: 'vibration', route_path: '/vibration', display_name: '振动', icon_class: 'fas fa-wave-square', sort_order: 50, status: 'developed', is_visible: true },
  { module_key: 'insar', route_path: '/insar', display_name: 'InSAR', icon_class: 'fas fa-satellite', sort_order: 60, status: 'developed', is_visible: true },
  { module_key: 'advanced', route_path: '/advanced', display_name: '高级分析', icon_class: 'fas fa-microscope', sort_order: 65, status: 'developed', is_visible: true },
  { module_key: 'overview', route_path: '/overview', display_name: '数据总览', icon_class: 'fas fa-chart-line', sort_order: 70, status: 'developed', is_visible: true },
  { module_key: 'three', route_path: '/three', display_name: '3D模型', icon_class: 'fas fa-cubes', sort_order: 80, status: 'developed', is_visible: true },
  { module_key: 'tickets', route_path: '/tickets', display_name: '工单', icon_class: 'fas fa-ticket-alt', sort_order: 90, status: 'developed', is_visible: true },
]

export function ModulesProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<AppModule[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await apiGet<AppModule[]>('/modules')
      const normalized = (rows || [])
        .filter(Boolean)
        .filter(m => m.is_visible !== false)
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setModules(normalized)
    } catch (e) {
      setModules(FALLBACK_MODULES)
      setError(e instanceof Error ? `${e.message}，已使用本地模块配置` : '加载模块配置失败，已使用本地模块配置')
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
