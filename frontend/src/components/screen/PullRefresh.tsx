import React, { useEffect, useRef, useState } from 'react'

interface PullRefreshProps {
  onRefresh?: () => void | Promise<void>
}

/**
 * iPad 风格下拉刷新：页面滚动到顶后再向下拉，超过阈值松手即触发 onRefresh。
 * 触屏专属（touch 事件），桌面无影响。放在滚动容器首位作为指示器。
 */
export const PullRefresh: React.FC<PullRefreshProps> = ({ onRefresh }) => {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)
  const pullRef = useRef(0)
  const busyRef = useRef(false)

  useEffect(() => { pullRef.current = pull }, [pull])
  useEffect(() => { busyRef.current = busy }, [busy])

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if ((window.scrollY || document.documentElement.scrollTop) > 0 || busyRef.current) return
      active.current = true
      startY.current = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (!active.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0) setPull(Math.min(dy * 0.5, 90))
    }
    const onEnd = () => {
      if (!active.current) return
      active.current = false
      if (pullRef.current > 56) {
        setBusy(true)
        setPull(56)
        try {
          Promise.resolve(onRefresh?.()).finally(() => {
            setBusy(false)
            setPull(0)
          })
        } catch {
          setBusy(false)
          setPull(0)
        }
      } else {
        setPull(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [onRefresh])

  if (pull <= 0 && !busy) return null
  return (
    <div style={{ height: pull, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: busy ? 'none' : 'height 200ms ease' }}>
      <i className={`fas fa-sync-alt ${busy ? 'fa-spin' : ''}`} style={{ color: '#00f0ff', fontSize: 22, textShadow: '0 0 10px rgba(0,229,255,.7)' }} />
    </div>
  )
}

export default PullRefresh
