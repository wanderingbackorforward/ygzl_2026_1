import React, { useMemo, useState } from 'react'
import { useModules } from '../contexts/ModulesContext'
import type { AppModule, ModuleStatus } from '../types/modules'

function statusLabel(s: ModuleStatus) {
  return s === 'developed' ? '已开发' : '待开发'
}

export default function ModuleAdmin() {
  const { modules, loading, error, refresh, setStatus } = useModules()
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  const sorted = useMemo(() => modules.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [modules])

  const toggle = async (m: AppModule) => {
    const next: ModuleStatus = m.status === 'developed' ? 'pending' : 'developed'
    setUpdating(prev => ({ ...prev, [m.module_key]: true }))
    try {
      await setStatus(m.module_key, next, 'admin', `toggle:${next}`)
    } finally {
      setUpdating(prev => ({ ...prev, [m.module_key]: false }))
    }
  }

  return (
    <div style={{ padding: 16, color: '#aaddff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>
          <i className="fas fa-sliders-h" /> 模块管理
        </h2>
        <button
          onClick={() => refresh()}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid rgba(64,174,255,.6)',
            background: 'rgba(64,174,255,.12)',
            color: '#aaddff',
            cursor: 'pointer'
          }}
        >
          刷新
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 6,
          border: '1px solid rgba(255,62,95,.35)',
          background: 'rgba(255,62,95,.08)',
          color: 'rgba(255,255,255,.9)'
        }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: 12,
        border: '1px solid rgba(64,174,255,.25)',
        borderRadius: 8,
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 160px 1fr 140px 140px',
          gap: 0,
          background: 'rgba(10,25,47,.9)',
          borderBottom: '1px solid rgba(64,174,255,.25)'
        }}>
          <div style={{ padding: 10, fontWeight: 600 }}>模块</div>
          <div style={{ padding: 10, fontWeight: 600 }}>路由</div>
          <div style={{ padding: 10, fontWeight: 600 }}>提示文案</div>
          <div style={{ padding: 10, fontWeight: 600 }}>状态</div>
          <div style={{ padding: 10, fontWeight: 600 }}>操作</div>
        </div>

        {(loading ? [] : sorted).map(m => {
          const busy = !!updating[m.module_key]
          return (
            <div
              key={m.module_key}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 160px 1fr 140px 140px',
                borderBottom: '1px solid rgba(64,174,255,.12)',
                background: 'rgba(10,25,47,.55)'
              }}
            >
              <div style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                {m.icon_class && <i className={m.icon_class} />}
                <span>{m.display_name}</span>
              </div>
              <div style={{ padding: 10, color: 'rgba(255,255,255,.7)' }}>{m.route_path}</div>
              <div style={{ padding: 10, color: 'rgba(255,255,255,.75)' }}>
                {m.pending_popup_title ? `${m.pending_popup_title}：` : ''}
                {m.pending_popup_body || ''}
              </div>
              <div style={{ padding: 10 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: m.status === 'pending' ? '1px solid rgba(250,173,20,.55)' : '1px solid rgba(82,196,26,.55)',
                  background: m.status === 'pending' ? 'rgba(250,173,20,.12)' : 'rgba(82,196,26,.12)',
                  color: 'rgba(255,255,255,.85)'
                }}>
                  {statusLabel(m.status)}
                </span>
              </div>
              <div style={{ padding: 10 }}>
                <button
                  onClick={() => toggle(m)}
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(0,229,255,.35)',
                    background: busy ? 'rgba(255,255,255,.08)' : 'rgba(0,229,255,.08)',
                    color: 'rgba(255,255,255,.85)',
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? '处理中...' : `切换为${statusLabel(m.status === 'developed' ? 'pending' : 'developed')}`}
                </button>
              </div>
            </div>
          )
        })}

        {loading && (
          <div style={{ padding: 12, background: 'rgba(10,25,47,.55)', color: 'rgba(255,255,255,.75)' }}>
            加载中...
          </div>
        )}
      </div>
    </div>
  )
}

