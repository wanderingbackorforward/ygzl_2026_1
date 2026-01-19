import React, { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useModules } from '../../contexts/ModulesContext'
import FullscreenModal from '../layout/FullscreenModal'

export default function ModuleGate({ moduleKey, children }: { moduleKey: string, children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { getByKey } = useModules()

  const mod = useMemo(() => getByKey(moduleKey), [getByKey, moduleKey])

  if (!mod) return <>{children}</>
  if (mod.status !== 'pending') return <>{children}</>

  const title = mod.pending_popup_title || '模块待开发'
  const body = mod.pending_popup_body || '该模块正在开发中'

  return (
    <FullscreenModal
      isOpen
      title={title}
      onClose={() => navigate('/cover', { replace: true, state: { from: location.pathname } })}
    >
      <div style={{ color: '#aaddff', fontSize: 16, lineHeight: 1.7, maxWidth: 900 }}>
        <div style={{ marginBottom: 16 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/cover', { replace: true })}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid rgba(64,174,255,.6)',
              background: 'rgba(64,174,255,.12)',
              color: '#aaddff',
              cursor: 'pointer'
            }}
          >
            返回封面
          </button>
          <button
            onClick={() => navigate('/modules')}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid rgba(0,229,255,.35)',
              background: 'rgba(0,229,255,.08)',
              color: '#aaddff',
              cursor: 'pointer'
            }}
          >
            去模块管理
          </button>
        </div>
      </div>
    </FullscreenModal>
  )
}

