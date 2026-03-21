import React from 'react'
import { useAgentStore, Insight } from '../../stores/agentStore'

interface Props {
  anomalies: Insight[]
  onClose: () => void
}

/**
 * Agent 详情下拉面板
 * 从 HeroBar 下方滑出，展示未读异常列表
 */
export function AgentDropdown({ anomalies, onClose }: Props) {
  const { acknowledge, dismiss } = useAgentStore()

  const handleAck = async (id: string) => {
    await acknowledge(id)
    // 全部已读后自动收起
    const remaining = anomalies.filter(a => a.id !== id)
    if (remaining.length === 0) onClose()
  }

  const handleDismiss = async (id: string) => {
    await dismiss(id)
    const remaining = anomalies.filter(a => a.id !== id)
    if (remaining.length === 0) onClose()
  }

  const sevColor = (s: string) =>
    s === 'critical' ? '#f87171' : s === 'warning' ? '#fbbf24' : '#34d399'

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      zIndex: 20,
      marginTop: 4,
      width: 420,
      maxWidth: 'calc(100vw - 40px)',
      maxHeight: 360,
      overflowY: 'auto',
      background: 'rgba(0, 10, 25, 0.97)',
      border: '1px solid rgba(0, 229, 255, 0.25)',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      padding: 8,
    }}>
      {anomalies.map(item => (
        <div key={item.id} style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(0, 229, 255, 0.08)',
        }}>
          {/* 标题行 */}
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
          }}>
            <span style={{ color: sevColor(item.severity), fontSize: 13 }}>{'\u26A0'}</span>
            {item.point_id && (
              <span style={{
                color: sevColor(item.severity),
                fontWeight: 700,
              }}>
                {item.point_id}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>
              {item.title?.replace(item.point_id || '', '').trim() || ''}
            </span>
          </div>

          {/* 原因 */}
          {item.body && (
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.5,
              marginBottom: 6,
            }}>
              {item.body}
            </div>
          )}

          {/* 建议 */}
          {item.suggestion && (
            <div style={{
              fontSize: 12,
              color: '#00e5ff',
              lineHeight: 1.5,
              marginBottom: 8,
            }}>
              {item.suggestion}
            </div>
          )}

          {/* 按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleAck(item.id)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid rgba(0, 229, 255, 0.3)',
                background: 'transparent',
                color: 'rgba(0, 229, 255, 0.8)',
                cursor: 'pointer',
              }}
            >
              已读
            </button>
            <button
              onClick={() => handleDismiss(item.id)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.45)',
                cursor: 'pointer',
              }}
            >
              不相关
            </button>
          </div>
        </div>
      ))}

      {anomalies.length === 0 && (
        <div style={{
          padding: 20,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 12,
        }}>
          暂无待处理项
        </div>
      )}
    </div>
  )
}
