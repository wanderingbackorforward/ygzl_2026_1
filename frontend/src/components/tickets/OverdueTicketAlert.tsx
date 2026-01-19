import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

type OverdueTicket = {
  id?: number
  ticket_number?: string
  title?: string
  status?: string
  priority?: string
  assignee_name?: string
  created_at?: string
  age_days?: number
}

type OverdueResponse = {
  days: number
  count: number
  tickets: OverdueTicket[]
  server_time?: string
}

const DISMISS_KEY = 'tickets:overdue-unresolved:dismissedUntil'

function getDismissedUntil(): number {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return 0
  const v = Number(raw)
  return Number.isFinite(v) ? v : 0
}

function setDismissedForMs(ms: number) {
  localStorage.setItem(DISMISS_KEY, String(Date.now() + ms))
}

function toDateStr(value?: string) {
  if (!value) return ''
  return String(value).split('T')[0]
}

export const OverdueTicketAlert: React.FC = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<OverdueResponse | null>(null)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shouldShow = useMemo(() => {
    if (!data) return false
    if ((data.count || 0) <= 0) return false
    return Date.now() >= getDismissedUntil()
  }, [data])

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const resp = await apiGet<OverdueResponse>('/tickets/overdue-unresolved?days=3&limit=10')
        if (cancelled) return
        setData(resp)
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '请求失败')
      }
    }

    void fetchData()
    const t = window.setInterval(fetchData, 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    if (shouldShow) setVisible(true)
  }, [shouldShow])

  const tickets = data?.tickets || []
  const count = data?.count || 0
  const days = data?.days || 3

  if (!visible) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.title}>工单超期告警</div>
          <button
            type="button"
            onClick={() => {
              setVisible(false)
            }}
            style={styles.closeBtn}
          >
            ×
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.summary}>
            存在 <span style={styles.em}>{count}</span> 个工单超过 <span style={styles.em}>{days}</span> 天未解决
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}

          <div style={styles.list}>
            {tickets.map((t) => {
              const key = String(t.id ?? t.ticket_number ?? t.title ?? Math.random())
              return (
                <div key={key} style={styles.item}>
                  <div style={styles.itemTop}>
                    <div style={styles.itemTitle}>
                      {(t.ticket_number ? `${t.ticket_number} ` : '') + (t.title || '未命名工单')}
                    </div>
                    <div style={styles.badges}>
                      {t.priority ? <span style={styles.badge}>{t.priority}</span> : null}
                      {t.status ? <span style={styles.badge}>{t.status}</span> : null}
                    </div>
                  </div>
                  <div style={styles.itemMeta}>
                    <span>创建: {toDateStr(t.created_at) || '--'}</span>
                    <span style={{ marginLeft: 12 }}>已超期: {t.age_days ?? '--'} 天</span>
                    {t.assignee_name ? <span style={{ marginLeft: 12 }}>处理人: {t.assignee_name}</span> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            onClick={() => {
              setDismissedForMs(30 * 60 * 1000)
              setVisible(false)
            }}
            style={styles.btnSecondary}
          >
            稍后提醒
          </button>
          <button
            type="button"
            onClick={() => {
              setVisible(false)
              navigate('/tickets')
            }}
            style={styles.btnPrimary}
          >
            查看工单
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    width: 'min(720px, 100%)',
    background: 'rgba(10, 25, 47, 0.98)',
    border: '1px solid rgba(64, 174, 255, 0.35)',
    borderRadius: 10,
    boxShadow: '0 0 24px rgba(0, 0, 0, 0.5)',
    color: '#e6f4ff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(64, 174, 255, 0.2)',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: '#40aeff',
  },
  closeBtn: {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: 'rgba(230, 244, 255, 0.85)',
    fontSize: 22,
    cursor: 'pointer',
    lineHeight: 1,
  },
  body: {
    padding: 16,
  },
  summary: {
    fontSize: 14,
    marginBottom: 12,
  },
  em: {
    fontWeight: 800,
    color: '#ff7a45',
  },
  error: {
    color: '#ff7875',
    fontSize: 12,
    marginBottom: 10,
  },
  list: {
    maxHeight: '52vh',
    overflow: 'auto',
    paddingRight: 6,
  },
  item: {
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(64, 174, 255, 0.06)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  itemTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: 650,
    color: '#e6f4ff',
    lineHeight: 1.35,
  },
  badges: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  badge: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid rgba(64, 174, 255, 0.35)',
    background: 'rgba(64, 174, 255, 0.1)',
    color: 'rgba(230, 244, 255, 0.9)',
    whiteSpace: 'nowrap',
  },
  itemMeta: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(230, 244, 255, 0.75)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTop: '1px solid rgba(64, 174, 255, 0.2)',
    background: 'rgba(64, 174, 255, 0.03)',
  },
  btnPrimary: {
    background: '#1677ff',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid rgba(64, 174, 255, 0.35)',
    color: '#40aeff',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
}
