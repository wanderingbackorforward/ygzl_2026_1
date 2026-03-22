import React from 'react'
import { useAgentStore, Insight } from '../../stores/agentStore'

interface Props {
  anomalies: Insight[]
  onClose: () => void
}

/**
 * Agent 详情下拉面板
 * 按点位分组显示，每个点只展示最关键的一条
 */
export function AgentDropdown({ anomalies, onClose }: Props) {
  const { acknowledge, dismiss } = useAgentStore()

  const handleAck = async (id: string) => {
    await acknowledge(id)
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

  const sevLabel = (s: string) =>
    s === 'critical' ? '严重' : s === 'warning' ? '关注' : '正常'

  // 清理标题：去掉 point_id 和残留的 []
  const cleanTitle = (item: Insight) => {
    let t = item.title || '异常'
    if (item.point_id) {
      t = t.replace(item.point_id, '').trim()
    }
    // 去掉残留的 [] 或 [  ]
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
      width: 400,
      maxWidth: 'calc(100vw - 40px)',
      maxHeight: 400,
      overflowY: 'auto',
      background: 'rgba(0, 10, 25, 0.98)',
      border: '1px solid rgba(0, 229, 255, 0.2)',
      borderRadius: 8,
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
      padding: 0,
    }}>
      {/* 面板头部 */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>
          待处理 ({anomalies.length})
        </span>
        <button
          onClick={onClose}
          style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '2px 4px',
          }}
        >
          关闭
        </button>
      </div>

      {/* 异常列表 */}
      {anomalies.map(item => (
        <div key={item.id} style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(0, 229, 255, 0.06)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* 标题行：严重度标签 + 点位 + 标题 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 5,
          }}>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 3,
              background: `${sevColor(item.severity)}22`,
              color: sevColor(item.severity),
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {sevLabel(item.severity)}
            </span>
            {item.point_id && (
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'white',
                flexShrink: 0,
              }}>
                {item.point_id}
              </span>
            )}
            <span style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {cleanTitle(item)}
            </span>
          </div>

          {/* 描述（一行截断） */}
          {item.body && (
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.4,
              marginBottom: 5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as any,
              overflow: 'hidden',
            }}>
              {item.body}
            </div>
          )}

          {/* 建议 + 操作按钮 同行 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {item.suggestion && (
              <span style={{
                fontSize: 11,
                color: '#00e5ff',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginRight: 8,
              }}>
                {item.suggestion}
              </span>
            )}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => handleAck(item.id)}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 3,
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
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 3,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                }}
              >
                忽略
              </button>
            </div>
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
