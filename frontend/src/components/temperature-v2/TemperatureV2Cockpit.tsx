/**
 * 温度V2 驾驶舱 — 乔布斯级极简 + 工程指导 + 科研算法
 * 三层架构: VitalSigns(2秒扫描) → 主面板(分析) → 算法洞察(深度)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../lib/api';
import { PointSelector } from '../shared/PointSelector';
import { TempVitalSignsStrip } from './TempVitalSignsStrip';
import { ConstructionGuidePanel } from './ConstructionGuidePanel';
import { AlgorithmInsightsPanel } from './AlgorithmInsightsPanel';
import { TemperatureSeriesChart } from '../charts/temperature/TemperatureSeriesChart';

export const TemperatureV2Cockpit: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sensors, setSensors] = useState<string[]>([]);
  const [problemIds, setProblemIds] = useState<string[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [seriesData, setSeriesData] = useState<any>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'guide' | 'algo'>('algo');

  // 加载总览数据
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<any>('/temperature/v2/overview');
      if (result?.success) {
        setOverview(result.data);
        const summary = result.data?.summary || [];
        const ids: string[] = summary.map((r: any) => String(r.sensor_id || r.SID || '')).filter((s: string) => s);
        const problems: string[] = summary.filter((r: any) => {
          const a = r.alert_level || r.alert_status || '';
          return a && a !== 'normal' && a !== 'ok';
        }).map((r: any) => String(r.sensor_id || r.SID || ''));
        setSensors([...new Set(ids)] as string[]);
        setProblemIds([...new Set(problems)] as string[]);
        if (ids.length > 0 && !selectedSensor) setSelectedSensor(ids[0]);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedSensor]);

  useEffect(() => { fetchOverview(); }, []);

  // 加载选中传感器的时间序列
  useEffect(() => {
    if (!selectedSensor) return;
    setSeriesLoading(true);
    apiGet<any>(`/temperature/data/${selectedSensor}`)
      .then(result => {
        const rows = Array.isArray(result) ? result : result?.timeSeriesData || [];
        setSeriesData(rows);
      })
      .catch(() => setSeriesData(null))
      .finally(() => setSeriesLoading(false));
  }, [selectedSensor]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-cyan-400 mb-3 block" />
          <span className="text-white text-sm">加载温度数据...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Layer 1: VitalSigns 顶栏 */}
      <TempVitalSignsStrip
        stats={overview?.stats || {}}
        assessment={overview?.construction_assessment}
        sensorCount={sensors.length}
      />

      {/* Layer 2: 主面板 — 三栏布局 */}
      <div className="flex-1 min-h-0 flex gap-3 px-4 pb-4">
        {/* 左栏: 传感器列表 */}
        <div className="w-48 shrink-0 flex flex-col">
          <PointSelector
            cardId="temp-v2-selector"
            points={sensors}
            selectedPoint={selectedSensor}
            onSelectPoint={setSelectedSensor}
            loading={false}
            problemPointIds={problemIds}
          />
        </div>

        {/* 中栏: 时间序列图 */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0 bg-slate-900/50 rounded-lg border border-slate-700/50 p-3">
            <TemperatureSeriesChart
              cardId="temp-v2-series"
              sensorId={selectedSensor}
              data={seriesData}
              loading={seriesLoading}
            />
          </div>
        </div>

        {/* 右栏: 施工指导 / 算法洞察 切换 */}
        <div className="w-96 shrink-0 flex flex-col bg-slate-900/50 rounded-lg border border-slate-700/50">
          {/* 切换按钮 */}
          <div className="shrink-0 flex border-b border-slate-700/50">
            <button onClick={() => setActivePanel('algo')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activePanel === 'algo' ? 'bg-cyan-600/20 text-white border-b-2 border-cyan-400' : 'text-white hover:bg-slate-800'}`}>
              <i className="fas fa-brain mr-1.5" />科研算法
            </button>
            <button onClick={() => setActivePanel('guide')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activePanel === 'guide' ? 'bg-cyan-600/20 text-white border-b-2 border-cyan-400' : 'text-white hover:bg-slate-800'}`}>
              <i className="fas fa-hard-hat mr-1.5" />施工指导
            </button>
          </div>
          {/* 面板内容 */}
          <div className="flex-1 min-h-0 p-3">
            {activePanel === 'algo'
              ? <AlgorithmInsightsPanel sensorId={selectedSensor} />
              : <ConstructionGuidePanel assessment={overview?.construction_assessment} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemperatureV2Cockpit;
