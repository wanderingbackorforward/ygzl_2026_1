import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

interface TemperatureIntelligencePanelProps {
  sensorId: string | null;
  snapshot: any;
  riskItem: any;
  actionPlan: any;
  loading?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const LEVEL_STYLE: Record<string, string> = {
  normal: 'bg-green-900/30 border-green-700/40 text-green-200',
  watch: 'bg-yellow-900/30 border-yellow-700/40 text-yellow-100',
  warning: 'bg-orange-900/30 border-orange-700/40 text-orange-100',
  critical: 'bg-red-900/30 border-red-700/40 text-red-100',
};

const PRIORITY_STYLE: Record<string, string> = {
  medium: 'bg-slate-700/70 text-slate-100',
  high: 'bg-orange-600/80 text-white',
  urgent: 'bg-red-600/85 text-white',
};

type NoticeState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

const Empty: React.FC<{ icon: string; text: string; color?: string }> = ({ icon, text, color = 'text-cyan-400' }) => (
  <div className="text-center text-slate-200 py-8">
    <i className={`fas ${icon} text-2xl mb-2 block ${color}`} />
    {text}
  </div>
);

export const TemperatureIntelligencePanel: React.FC<TemperatureIntelligencePanelProps> = ({
  sensorId,
  snapshot,
  riskItem,
  actionPlan,
  loading = false,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [feedbackSubmittingId, setFeedbackSubmittingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!sensorId) {
    return <Empty icon="fa-mouse-pointer" text="请先选择一个传感器" />;
  }

  if (loading) {
    return <Empty icon="fa-spinner fa-spin" text="温度智能评估中..." />;
  }

  if (!riskItem) {
    return <Empty icon="fa-brain" text="暂无智能评估结果" color="text-yellow-400" />;
  }

  const snapshotData = snapshot?.latest_snapshot || riskItem?.latest_snapshot || {};
  const level = riskItem?.risk_level || 'normal';
  const levelText = level === 'critical' ? '高危'
    : level === 'warning' ? '预警'
    : level === 'watch' ? '观察'
    : '正常';
  const drivers = Array.isArray(riskItem?.drivers) ? riskItem.drivers.filter(Boolean) : [];
  const events = Array.isArray(riskItem?.events) ? riskItem.events : [];
  const actions = Array.isArray(actionPlan?.actions) ? actionPlan.actions : [];
  const thresholds = snapshot?.thresholds || {};
  const topEvent = events[0] || null;
  const showNotice = (text: string, type: NoticeState['type'] = 'info') => setNotice({ text, type });

  const getThresholdForEvent = (event: any) => {
    const eventType = event?.event_type;
    if (eventType === 'extreme_high') return thresholds.temp_high_warning ?? thresholds.temp_high_critical ?? null;
    if (eventType === 'extreme_low') return thresholds.temp_low_warning ?? thresholds.temp_low_critical ?? null;
    if (eventType === 'wide_daily_range') return thresholds.daily_range_warning ?? thresholds.daily_range_critical ?? null;
    if (eventType === 'rapid_change') return thresholds.rate_change_warning ?? thresholds.rate_change_critical ?? null;
    if (eventType === 'abnormal_gradient') return thresholds.gradient_warning ?? thresholds.gradient_critical ?? null;
    if (eventType === 'freeze_thaw') return thresholds.freeze_thaw_annual_warning ?? thresholds.freeze_thaw_annual_critical ?? null;
    return null;
  };

  const getCurrentValueForEvent = (event: any) => {
    const eventType = event?.event_type;
    if (eventType === 'extreme_high') return snapshotData?.max_temperature ?? snapshotData?.avg_temperature ?? null;
    if (eventType === 'extreme_low') return snapshotData?.min_temperature ?? snapshotData?.avg_temperature ?? null;
    if (eventType === 'wide_daily_range') return snapshotData?.daily_range ?? null;
    if (eventType === 'rapid_change') return event?.evidence?.rate_per_day ?? null;
    if (eventType === 'abnormal_gradient') return event?.evidence?.gradient ?? null;
    if (eventType === 'freeze_thaw') return event?.evidence?.annual_rate ?? null;
    return snapshotData?.avg_temperature ?? null;
  };

  const handleCreateTicket = async () => {
    if (!sensorId || ticketSubmitting) return;
    const event = topEvent;
    const severity = event?.severity || (level === 'critical' ? 'critical' : level === 'warning' ? 'high' : 'medium');
    const title = event?.title || `[${sensorId}] 温度智能${levelText}处置`;
    const confirmCreate = window.confirm(
      `确认创建温度工单？\n\n传感器: ${sensorId}\n风险等级: ${levelText}\n标题: ${title}`
    );
    if (!confirmCreate) return;
    const sendEmail = window.confirm('创建工单同时发送邮件通知？\n确定=发送邮件；取消=不发邮件但仍创建工单');
    const descriptionLines = [
      `智能风险分: ${Math.round(riskItem?.risk_score || 0)}`,
      drivers.length > 0 ? `关键驱动: ${drivers.join('、')}` : '',
      event?.description ? `核心事件: ${event.description}` : '',
      actions.length > 0 ? `建议动作: ${actions.slice(0, 3).map((item: any) => item.title).join('；')}` : '',
    ].filter(Boolean);

    setTicketSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/analysis/v2/temperature/create-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomaly_id: event?.id || `temperature-risk:${sensorId}`,
          point_id: sensorId,
          title,
          description: descriptionLines.join('\n'),
          severity,
          anomaly_type: event?.event_type || 'temperature_intelligence',
          current_value: getCurrentValueForEvent(event),
          threshold: getThresholdForEvent(event),
          send_email: sendEmail,
        }),
      });
      const result = await response.json();
      if (result?.success) {
        showNotice(`工单 ${result.data?.ticket_number || ''} 已创建，正在跳转工单中心`, 'success');
        const ticketId = result.data?.ticket_id;
        if (ticketId) {
          navigate(`/tickets?ticketId=${ticketId}&created=1`);
        } else {
          navigate('/tickets');
        }
      } else {
        showNotice(`工单创建失败：${result?.message || '未知错误'}`, 'error');
      }
    } catch (error) {
      showNotice(`工单创建失败：${error instanceof Error ? error.message : '网络错误'}`, 'error');
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleFeedback = async (event: any, verdict: 'false_positive' | 'ignored' | 'missed') => {
    if (!sensorId || !event?.event_type || feedbackSubmittingId) return;
    const verdictLabel = verdict === 'false_positive' ? '误报'
      : verdict === 'ignored' ? '已处理'
      : '漏报';
    setFeedbackSubmittingId(event.id);
    try {
      const response = await fetch(`${API_BASE}/temperature/v2/intelligence/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensor_id: sensorId,
          event_type: event.event_type,
          verdict,
          notes: '',
        }),
      });
      const result = await response.json();
      if (result?.success) {
        showNotice(`已记录“${verdictLabel}”反馈`, 'success');
        await onRefresh?.();
      } else {
        showNotice(`反馈失败：${result?.message || '未知错误'}`, 'error');
      }
    } catch (error) {
      showNotice(`反馈失败：${error instanceof Error ? error.message : '网络错误'}`, 'error');
    } finally {
      setFeedbackSubmittingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto">
      {notice && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          notice.type === 'success'
            ? 'border-green-600/40 bg-green-900/20 text-green-200'
            : notice.type === 'error'
            ? 'border-red-600/40 bg-red-900/20 text-red-200'
            : 'border-cyan-600/40 bg-cyan-900/20 text-cyan-100'
        }`}>
          <i className={`fas ${
            notice.type === 'success'
              ? 'fa-circle-check'
              : notice.type === 'error'
              ? 'fa-circle-exclamation'
              : 'fa-circle-info'
          } mr-2`} />
          {notice.text}
        </div>
      )}
      <div className={`rounded-lg border p-3 ${LEVEL_STYLE[level] || LEVEL_STYLE.normal}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-80">智能风险评估</div>
            <div className="text-lg font-semibold text-white mt-1">{sensorId}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{Math.round(riskItem?.risk_score || 0)}</div>
            <div className="text-xs opacity-90">{levelText}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-slate-950/25 px-2 py-1.5">
            质量分 {snapshotData?.quality_score != null ? Number(snapshotData.quality_score).toFixed(2) : Number(riskItem?.quality_score || 0).toFixed(2)}
          </div>
          <div className="rounded bg-slate-950/25 px-2 py-1.5">
            当前均温 {snapshotData?.avg_temperature != null ? `${Number(snapshotData.avg_temperature).toFixed(1)}°C` : '--'}
          </div>
          <div className="rounded bg-slate-950/25 px-2 py-1.5">
            日温差 {snapshotData?.daily_range != null ? `${Number(snapshotData.daily_range).toFixed(1)}°C` : '--'}
          </div>
          <div className="rounded bg-slate-950/25 px-2 py-1.5">
            趋势 {snapshotData?.trend_type || '未识别'}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleCreateTicket}
            disabled={ticketSubmitting}
            className="flex-1 rounded-lg bg-red-600/85 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={`fas ${ticketSubmitting ? 'fa-spinner fa-spin' : 'fa-ticket-alt'} mr-1.5`} />
            {ticketSubmitting ? '创建中...' : '创建工单'}
          </button>
          <button
            type="button"
            onClick={() => onRefresh?.()}
            className="rounded-lg border border-slate-600/60 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <i className="fas fa-rotate-right mr-1.5" />
            刷新
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
        <div className="text-white text-sm font-medium mb-2">
          <i className="fas fa-bolt mr-1.5 text-cyan-400" />
          关键驱动
        </div>
        {drivers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {drivers.map((driver: string, index: number) => (
              <span key={`${driver}-${index}`} className="rounded-full bg-slate-700/70 px-2.5 py-1 text-xs text-slate-100">
                {driver}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-300">暂无显著驱动</div>
        )}
      </section>

      <section className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
        <div className="text-white text-sm font-medium mb-2">
          <i className="fas fa-siren-on mr-1.5 text-cyan-400" />
          事件清单
        </div>
        {events.length > 0 ? (
          <div className="space-y-2">
            {events.slice(0, 4).map((event: any) => (
              <div
                key={event.id}
                className={`rounded-lg border px-3 py-2 ${
                  event.severity === 'critical'
                    ? 'bg-red-900/20 border-red-700/40'
                    : event.severity === 'warning'
                    ? 'bg-orange-900/20 border-orange-700/40'
                    : 'bg-slate-900/40 border-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{event.title}</span>
                  <span className="text-[11px] text-slate-300">
                    置信度 {event.confidence != null ? Number(event.confidence).toFixed(2) : '--'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-200">{event.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={feedbackSubmittingId === event.id}
                    onClick={() => handleFeedback(event, 'false_positive')}
                    className="rounded border border-slate-600/60 px-2 py-1 text-[11px] text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    误报
                  </button>
                  <button
                    type="button"
                    disabled={feedbackSubmittingId === event.id}
                    onClick={() => handleFeedback(event, 'ignored')}
                    className="rounded border border-slate-600/60 px-2 py-1 text-[11px] text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    已处理
                  </button>
                  <button
                    type="button"
                    disabled={feedbackSubmittingId === event.id}
                    onClick={() => handleFeedback(event, 'missed')}
                    className="rounded border border-slate-600/60 px-2 py-1 text-[11px] text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    漏报
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-300">未发现显著温度事件</div>
        )}
      </section>

      <section className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
        <div className="text-white text-sm font-medium mb-2">
          <i className="fas fa-list-check mr-1.5 text-cyan-400" />
          动作计划
        </div>
        {actions.length > 0 ? (
          <div className="space-y-2">
            {actions.slice(0, 5).map((action: any, index: number) => (
              <div key={`${action.action_type}-${index}`} className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[action.priority || 'medium'] || PRIORITY_STYLE.medium}`}>
                    {action.priority === 'urgent' ? '紧急' : action.priority === 'high' ? '高优先级' : '处理中'}
                  </span>
                  <span className="text-sm font-medium text-white">{action.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-200">{action.reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-300">暂无推荐动作</div>
        )}
      </section>

      <section className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
        <div className="text-white text-sm font-medium mb-2">
          <i className="fas fa-sliders mr-1.5 text-cyan-400" />
          当前阈值
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
          <div className="rounded bg-slate-900/40 px-2 py-1.5">高温预警 {thresholds.temp_high_warning ?? '--'}°C</div>
          <div className="rounded bg-slate-900/40 px-2 py-1.5">高温严重 {thresholds.temp_high_critical ?? '--'}°C</div>
          <div className="rounded bg-slate-900/40 px-2 py-1.5">低温预警 {thresholds.temp_low_warning ?? '--'}°C</div>
          <div className="rounded bg-slate-900/40 px-2 py-1.5">日温差预警 {thresholds.daily_range_warning ?? '--'}°C</div>
        </div>
      </section>
    </div>
  );
};

export default TemperatureIntelligencePanel;
