import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * 三档运行时设备识别（控制室 / 壁挂大屏 · 触控化重构）
 *
 * - phone   : 构建期 VITE_MOBILE=true（Capacitor APK）强制为 phone，本识别不再细分
 * - tablet  : !IS_MOBILE 且触控为主（pointer:coarse）+ 宽度 ≥768 —— 覆盖 iPad 与壁挂触控大屏
 * - desktop : 精细指针（鼠标）或窄窗 —— 维持原有桌面交互
 *
 * 与 useViewMode.IS_MOBILE 并存不冲突：phone 档仍由构建期开关决定。
 * 手动覆盖：localStorage['device-tier'] = 'tablet' | 'desktop' | 'phone'（便于桌面浏览器调试大屏）。
 */
export type DeviceTier = 'phone' | 'tablet' | 'desktop'

export const IS_MOBILE = import.meta.env.VITE_MOBILE === 'true'

const OVERRIDE_KEY = 'device-tier'
const TABLET_MIN_WIDTH = 768

function readOverride(): DeviceTier | null {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY)
    if (v === 'tablet' || v === 'desktop' || v === 'phone') return v
  } catch {
    // localStorage 不可用（隐私模式等）——忽略
  }
  return null
}

function detectTier(): DeviceTier {
  if (IS_MOBILE) return 'phone'
  const override = readOverride()
  if (override) return override
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop'

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const width = window.innerWidth || document.documentElement.clientWidth || 0
  // 触控为主 + 足够宽 → 平板/大屏档
  if (coarse && width >= TABLET_MIN_WIDTH) return 'tablet'
  return 'desktop'
}

interface DeviceTierContextValue {
  tier: DeviceTier
  isTablet: boolean
  isDesktop: boolean
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
      body.classList.remove('tier-phone', 'tier-tablet', 'tier-desktop')
      body.classList.add(`tier-${next}`)
    }
    apply(detectTier())

    // 监听指针类型与尺寸变化（iPad 旋转、外接鼠标、窗口缩放）
    let coarseMql: MediaQueryList | null = null
    const onCoarseChange = () => apply(detectTier())
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      coarseMql = window.matchMedia('(pointer: coarse)')
      coarseMql.addEventListener?.('change', onCoarseChange)
    }

    let resizeTimer: number | null = null
    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => apply(detectTier()), 150)
    }
    window.addEventListener('resize', onResize)

    // 手动覆盖变更（跨标签页）
    const onStorage = (e: StorageEvent) => {
      if (e.key === OVERRIDE_KEY) apply(detectTier())
    }
    window.addEventListener('storage', onStorage)

    return () => {
      coarseMql?.removeEventListener?.('change', onCoarseChange)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('storage', onStorage)
      if (resizeTimer) window.clearTimeout(resizeTimer)
    }
  }, [])

  // 首屏确保 body class 已设置
  useEffect(() => {
    const body = document.body
    if (!body.classList.contains(`tier-${tier}`)) {
      body.classList.remove('tier-phone', 'tier-tablet', 'tier-desktop')
      body.classList.add(`tier-${tier}`)
    }
  }, [tier])

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
      isDesktop: tier === 'desktop',
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
    // 允许在 Provider 外部安全降级（例如单元测试）
    return {
      tier: IS_MOBILE ? 'phone' : 'desktop',
      isTablet: false,
      isDesktop: !IS_MOBILE,
      isPhone: IS_MOBILE,
      setOverride: () => {},
    }
  }
  return ctx
}

export default DeviceTierContext
