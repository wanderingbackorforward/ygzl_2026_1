import { useEffect, useRef, useState } from 'react'
import { StateView } from '../components/common/ui'

const MODEL_URL = `${import.meta.env.BASE_URL}static/three_test.html?embedded=1`

export default function ThreeModel() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    setStatus('loading')
    timerRef.current = window.setTimeout(() => {
      setStatus(prev => (prev === 'loading' ? 'error' : prev))
    }, 15000)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [attempt])

  return (
    <div style={{ height: 'calc(100vh - 64px)', position: 'relative' }}>
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfe8ff', fontSize: 14, pointerEvents: 'none' }}>
          3D 场景加载中…
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8, 16, 28, 0.92)', zIndex: 2 }}>
          <StateView
            kind="error"
            title="3D 场景加载失败"
            hint="静态页面或 three.js 资源未就绪，可重试；若持续失败请检查 /static/three_test.html 与 CDN 可达性。"
            onRetry={() => setAttempt(value => value + 1)}
          />
        </div>
      )}
      <iframe
        key={attempt}
        ref={iframeRef}
        title="three-model"
        src={MODEL_URL}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onLoad={() => {
          if (timerRef.current) window.clearTimeout(timerRef.current)
          const doc = iframeRef.current?.contentDocument
          setStatus(doc?.getElementById('loading-indicator') ? 'ready' : 'error')
        }}
      />
    </div>
  )
}
