import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * 设备形态识别（统一大屏触控设计后简化为两档）
 *
 * - phone  : 构建期 VITE_MOBILE=true（Capacitor APK）—— 手机专属（MobileCardSwitcher + 底部 Tab）
 * - tablet : 其余所有 Web 访问（桌面浏览器 / iPad / 壁挂大屏）—— 统一的大屏触控设计
 *
 * 桌面档已废弃：新大屏设计即唯一 Web UI。
 * 手动覆盖：localStorage['device-tier'] = 'tablet' | 'phone'（调试用）。
 */
export type DeviceTier = 'phone' | 'tablet'

export const IS_MOBILE = import.meta.env.VITE_MOBILE === 'true'

const OVERRIDE_KEY = 'device-tier'

function readOverride(): DeviceTier | null {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY)
    if (v === 'tablet' || v === 'phone') return v
  } catch {
    // localStorage 不可用——忽略
  }
  return null
}

function detectTier(): DeviceTier {
  if (IS_MOBILE) return 'phone'
  return readOverride() ?? 'tablet'
}

interface DeviceTierContextValue {
  tier: DeviceTier
  isTablet: boolean
  isPhone: boolean
  setOverride: (tier: DeviceTier | null) => void
}

const DeviceTierContext = createContext<DeviceTierContextValue | null>(null)

export const DeviceTierProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tier, setTier] = useState<DeviceTier>(() => detectTier())

  useEffect(() => {
    const apply = (next: DeviceTier) => {
      setTier(prev => (prev === next ? prev : next))
      const body = document.body
      body.classList.remove('tier-phone', 'tier-tablet')
      body.classList.add(`tier-${next}`)
    }
    apply(detectTier())

    // 跨标签页同步手动覆盖
    const onStorage = (e: StorageEvent) => {
      if (e.key === OVERRIDE_KEY) apply(detectTier())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setOverride = (next: DeviceTier | null) => {
    try {
      if (next) localStorage.setItem(OVERRIDE_KEY, next)
      else localStorage.removeItem(OVERRIDE_KEY)
    } catch {
      // 忽略
    }
    setTier(detectTier())
  }

  const value = useMemo<DeviceTierContextValue>(
    () => ({
      tier,
      isTablet: tier === 'tablet',
      isPhone: tier === 'phone',
      setOverride,
    }),
    [tier]
  )

  return <DeviceTierContext.Provider value={value}>{children}</DeviceTierContext.Provider>
}

export function useDeviceTier(): DeviceTierContextValue {
  const ctx = useContext(DeviceTierContext)
  if (!ctx) {
    // Provider 外部安全降级（如单元测试）
    return {
      tier: IS_MOBILE ? 'phone' : 'tablet',
      isTablet: !IS_MOBILE,
      isPhone: IS_MOBILE,
      setOverride: () => {},
    }
  }
  return ctx
}

export default DeviceTierContext
