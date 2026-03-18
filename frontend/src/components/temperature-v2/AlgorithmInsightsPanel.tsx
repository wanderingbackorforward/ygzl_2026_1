/**
 * 温度V2 算法洞察面板
 * STL分解 + CUSUM变点 + 冻融分析 + 养护成熟度
 */
import React, { useState, useEffect, useCallback } from 'react';
import { EChartsWrapper } from '../charts/EChartsWrapper';
import { apiGet } from '../../lib/api';

interface AlgorithmInsightsPanelProps {
  sensorId: string | null;
}

type AlgoTab = 'stl' | 'cusum' | 'freeze' | 'maturity';

const TABS: { key: AlgoTab; label: string; icon: string }[] = [
  { key: 'stl', label: 'STL分解', icon: 'fa-wave-square' },
  { key: 'cusum', label: 'CUSUM变点', icon: 'fa-chart-area' },
  { key: 'freeze', label: '冻融分析', icon: 'fa-snowflake' },
  { key: 'maturity', label: '养护成熟度', icon: 'fa-flask' },
];

export const AlgorithmInsightsPanel: React.FC<AlgorithmInsightsPanelProps> = ({ sensorId }) => {
  const [activeTab, setActiveTab] = useState<AlgoTab>('stl');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!sensorId) return;
    setLoading(true);
    try {
      const ep = `/temperature/v2/${activeTab === 'freeze' ? 'freeze-thaw' : activeTab}/${sensorId}`;
      const result = await apiGet<any>(ep);
      setData(result);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [sensorId, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const content = !sensorId
    ? <Empty icon="fa-mouse-pointer" text="请先选择一个传感器" />
    : loading
    ? <Empty icon="fa-spinner fa-spin" text="算法计算中..." />
    : !data?.success
    ? <Empty icon="fa-exclamation-triangle" text={data?.message || '数据不足'} color="text-yellow-400" />
    : activeTab === 'stl' ? <STLChart data={data} />
    : activeTab === 'cusum' ? <CUSUMChart data={data} />
    : activeTab === 'freeze' ? <FreezeThawView data={data} />
    : <MaturityChart data={data} />;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex gap-1 px-2 py-2 border-b border-slate-700/50">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-cyan-600 text-white' : 'text-white hover:bg-slate-700'}`}>
            <i className={`fas ${t.icon} mr-1.5`} />{t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">{content}</div>
    </div>
  );
};

const Empty: React.FC<{ icon: string; text: string; color?: string }> = ({ icon, text, color = 'text-cyan-400' }) => (
  <div className="text-center text-slate-200 py-8">
    <i className={`fas ${icon} text-2xl mb-2 block ${color}`} />{text}
  </div>
);

/** STL分解三层图 */
const STLChart: React.FC<{ data: any }> = ({ data }) => {
  const mkAxis = (i: number, name: string) => ({
    gridIndex: i, name, nameTextStyle: { color: '#e2e8f0' },
    axisLabel: { color: '#e2e8f0' }, splitLine: { lineStyle: { color: '#1e293b' } },
  });
  const option = {
    backgroundColor: 'transparent',
    grid: [
      { left: 60, right: 20, top: 30, height: '20%' },
      { left: 60, right: 20, top: '35%', height: '20%' },
      { left: 60, right: 20, top: '62%', height: '20%' },
    ],
    tooltip: { trigger: 'axis' as const },
    xAxis: [0, 1, 2].map(i => ({
      gridIndex: i, type: 'category' as const, data: data.dates,
      axisLabel: { show: i === 2, color: '#e2e8f0', fontSize: 10 },
      axisLine: { lineStyle: { color: '#475569' } },
    })),
    yAxis: [mkAxis(0, '趋势'), mkAxis(1, '季节'), mkAxis(2, '残差')],
    series: [
      { xAxisIndex: 0, yAxisIndex: 0, type: 'line', data: data.trend, lineStyle: { color: '#06b6d4' }, showSymbol: false },
      { xAxisIndex: 1, yAxisIndex: 1, type: 'line', data: data.seasonal, lineStyle: { color: '#a78bfa' }, showSymbol: false },
      { xAxisIndex: 2, yAxisIndex: 2, type: 'bar', data: data.residual,
        itemStyle: { color: (p: any) => Math.abs(p.value) > (data.stats?.residual_std ?? 1) * 2 ? '#ef4444' : '#64748b' } },
    ],
  };
  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-white text-sm font-medium">STL季节性分解</span>
        <span className="text-xs text-slate-200">
          趋势: {data.stats?.trend_direction === 'rising' ? '上升' : data.stats?.trend_direction === 'falling' ? '下降' : '稳定'}
          {' | '}异常: {data.stats?.anomaly_count ?? 0}个
        </span>
      </div>
      <EChartsWrapper option={option as any} style={{ height: 350 }} />
    </div>
  );
};
/** CUSUM变点检测图 */
const CUSUMChart: React.FC<{ data: any }> = ({ data }) => {
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['上侧CUSUM', '下侧CUSUM', '阈值'], textStyle: { color: '#e2e8f0' }, top: 5 },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category' as const, data: data.dates, axisLabel: { color: '#e2e8f0', fontSize: 10 } },
    yAxis: { axisLabel: { color: '#e2e8f0' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: '上侧CUSUM', type: 'line', data: data.cusum_positive, lineStyle: { color: '#ef4444' }, showSymbol: false },
      { name: '下侧CUSUM', type: 'line', data: data.cusum_negative, lineStyle: { color: '#3b82f6' }, showSymbol: false },
      { name: '阈值', type: 'line', data: data.dates?.map(() => data.threshold_h),
        lineStyle: { color: '#f59e0b', type: 'dashed' as const }, showSymbol: false },
    ],
  };
  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-white text-sm font-medium">CUSUM变点检测</span>
        <span className="text-xs text-slate-200">
          基线均值: {data.baseline_mean?.toFixed(1)}°C | 变点: {data.change_points?.length ?? 0}个
        </span>
      </div>
      <EChartsWrapper option={option as any} style={{ height: 280 }} />
      {data.change_points?.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.change_points.map((cp: any, i: number) => (
            <div key={i} className={`text-xs rounded px-2 py-1 ${
              cp.type === 'increase' ? 'bg-red-900/20 text-red-300' : 'bg-blue-900/20 text-blue-300'}`}>
              {cp.date} | {cp.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** 冻融周期视图 */
const FreezeThawView: React.FC<{ data: any }> = ({ data }) => {
  const sevColor = data.severity === 'severe' ? 'text-red-400' : data.severity === 'high' ? 'text-orange-400'
    : data.severity === 'moderate' ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
          <div className="text-2xl font-bold text-white">{data.total_cycles}</div>
          <div className="text-xs text-slate-200">累计冻融周期</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
          <div className={`text-2xl font-bold ${sevColor}`}>{data.annual_rate}</div>
          <div className="text-xs text-slate-200">年化频率(次/年)</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 text-center">
          <div className={`text-lg font-bold ${sevColor}`}>
            {data.severity === 'severe' ? '严重' : data.severity === 'high' ? '较高' : data.severity === 'moderate' ? '中等' : '较低'}
          </div>
          <div className="text-xs text-slate-200">风险等级</div>
        </div>
      </div>
      <div className={`rounded-lg p-3 border ${
        data.severity === 'severe' || data.severity === 'high' ? 'bg-red-900/20 border-red-700/40' : 'bg-slate-800/50 border-slate-700/50'}`}>
        <div className="text-white text-sm font-medium mb-1">
          <i className="fas fa-hard-hat mr-1.5" />施工指导
        </div>
        <p className="text-slate-200 text-sm">{data.guidance}</p>
      </div>
      {data.currently_frozen && (
        <div className="bg-blue-900/30 border border-blue-700/40 rounded-lg p-3 text-center">
          <i className="fas fa-snowflake text-blue-400 mr-1" />
          <span className="text-white text-sm font-medium">当前处于冻结状态</span>
        </div>
      )}
    </div>
  );
};

/** 养护成熟度图 */
const MaturityChart: React.FC<{ data: any }> = ({ data }) => {
  const curve = data.maturity_curve || [];
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const },
    grid: { left: 60, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category' as const, data: curve.map((c: any) => c.date), axisLabel: { color: '#e2e8f0', fontSize: 10 } },
    yAxis: { name: '成熟度(°C·h)', nameTextStyle: { color: '#e2e8f0' }, axisLabel: { color: '#e2e8f0' },
      splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { type: 'line', data: curve.map((c: any) => c.cumulative), areaStyle: { color: 'rgba(6,182,212,0.15)' },
        lineStyle: { color: '#06b6d4' }, showSymbol: false },
      { type: 'line', data: curve.map(() => data.target_maturity),
        lineStyle: { color: '#22c55e', type: 'dashed' as const }, showSymbol: false },
    ],
  };
  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-white text-sm font-medium">养护成熟度追踪</span>
        <span className="text-xs text-slate-200">
          当前: {data.current_maturity}°C·h | 目标: {data.target_maturity}°C·h | 进度: {data.progress_pct}%
        </span>
      </div>
      <EChartsWrapper option={option as any} style={{ height: 250 }} />
      <div className="mt-2">
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div className={`h-3 rounded-full ${data.reached_target ? 'bg-green-500' : 'bg-cyan-500'}`}
            style={{ width: `${Math.min(100, data.progress_pct)}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-200">
          <span>{data.reached_target ? '已达标' : `剩余约${data.estimated_days_remaining ?? '?'}天`}</span>
          <span>{data.progress_pct}%</span>
        </div>
      </div>
    </div>
  );
};

export default AlgorithmInsightsPanel;
