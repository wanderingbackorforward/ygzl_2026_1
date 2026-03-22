import React from 'react'
import { useAgentStore, Insight } from '../../stores/agentStore'
import { useNavigate } from 'react-router-dom'

interface Props {
  anomalies: Insight[]
  onClose: () => void
  onSelectPoint?: (pointId: string) => void
}

/**
 * Agent 详情下拉面板
 * 点击点位名可联动跳转到对应监测点
 */
export function AgentDropdown({ anomalies, onClose, onSelectPoint }: Props) {
  const { acknowledge, dismiss } = useAgentStore()
  const navigate = useNavigate()

  const handleAck = async (id: string) => {
    await acknowledge(id)
    if (anomalies.filter(a => a.id !== id).length === 0) onClose()
  }

  const handleDismiss = async (id: string) => {
    await dismiss(id)
    if (anomalies.filter(a => a.id !== id).length === 0) onClose()
  }

  const sevColor = (s: string) =>
    s === 'critical' ? '#f87171' : s === 'warning' ? '#fbbf24' : '#34d399'

  const sevLabel = (s: string) =>
    s === 'critical' ? '严重' : s === 'warning' ? '关注' : '正常'

  const cleanTitle = (item: Insight) => {
    let t = item.title || '异常'
    if (item.point_id) t = t.replace(item.point_id, '').trim()
    t = t.replace(/\[\s*\]/g, '').trim()
    return t
  }

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      zIndex: 50,
      marginTop: 4,
      width: 380,
      maxWidth: 'calc(100vw - 40px)',
      maxHeight: 360,
      overflowY: 'auto',
      background: 'rgba(0, 10, 25, 0.98)',
      border: '1px solid rgba(0, 229, 255, 0.2)',
      borderRadius: 8,
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
    }}>
      {/* 头部 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>
          待处理 ({anomalies.length})
        </span>
        <button onClick={onClose} style={{
          fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none',
          border: 'none', cursor: 'pointer',
        }}>
          关闭
        </button>
      </div>

      {anomalies.map(item => {
        const isTemp = (item as any).evidence?.sense === 'temperature'
        const borderColor = isTemp ? '#60a5fa' : sevColor(item.severity)
        const label = isTemp ? '温度' : sevLabel(item.severity)
        const labelColor = isTemp ? '#60a5fa' : sevColor(item.severity)

        return (
        <div key={item.id} style={{
          padding: '8px 12px',
          borderBottom: '1px solid rgba(0, 229, 255, 0.06)',
          borderLeft: `3px solid ${borderColor}`,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* 标题行 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}>
            <span style={{
              fontSize: 10, padding: '1px 5px', borderRadius: 3,
              background: `${labelColor}22`,
              color: labelColor, fontWeight: 700, flexShrink: 0,
            }}>
              {label}
            </span>
            {isTemp ? (
              <span
                onClick={() => { navigate('/temperature'); onClose() }}
                style={{
                  fontSize: 12, fontWeight: 700, color: '#60a5fa',
                  cursor: 'pointer', textDecoration: 'underline',
                  textDecorationColor: 'rgba(96,165,250,0.3)', flexShrink: 0,
                }}
              >
                查看温度详情
              </span>
            ) : item.point_id && (
              <span
                onClick={() => onSelectPoint?.(item.point_id!)}
                style={{
                  fontSize: 12, fontWeight: 700, color: '#00e5ff',
                  cursor: onSelectPoint ? 'pointer' : 'default',
                  textDecoration: onSelectPoint ? 'underline' : 'none',
                  textDecorationColor: 'rgba(0,229,255,0.3)',
                  flexShrink: 0,
                }}
              >
                {item.point_id}
              </span>
            )}
            <span style={{
              fontSize: 12, color: 'rgba(255,255,255,0.75)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {cleanTitle(item)}
            </span>
          </div>

          {/* 描述 */}
          {item.body && (
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4,
              marginBottom: 4,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
            }}>
              {item.body}
            </div>
          )}

          {/* 建议 + 按钮 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {item.suggestion && (
              <span style={{
                fontSize: 10, color: '#00e5ff', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8,
              }}>
                {item.suggestion}
              </span>
            )}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => handleAck(item.id)} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 3,
                border: '1px solid rgba(0, 229, 255, 0.3)', background: 'transparent',
                color: 'rgba(0, 229, 255, 0.8)', cursor: 'pointer',
              }}>已读</button>
              <button onClick={() => handleDismiss(item.id)} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 3,
                border: '1px solid rgba(255, 255, 255, 0.12)', background: 'transparent',
                color: 'rgba(255, 255, 255, 0.35)', cursor: 'pointer',
              }}>忽略</button>
            </div>
          </div>
        </div>
      )})}

      {anomalies.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          暂无待处理项
        </div>
      )}
    </div>
  )
}
