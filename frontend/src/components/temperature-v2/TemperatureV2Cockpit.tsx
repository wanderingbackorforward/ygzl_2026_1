/**
 * 温度V2 驾驶舱 — 乔布斯级极简 + 工程指导 + 科研算法
 * 三层架构: VitalSigns(2秒扫描) → 主面板(分析) → 算法洞察(深度)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import { PageHeader, StateView } from '../common/ui';
import { PointSelector } from '../shared/PointSelector';
import { TempVitalSignsStrip } from './TempVitalSignsStrip';
import { ConstructionGuidePanel } from './ConstructionGuidePanel';
import { AlgorithmInsightsPanel } from './AlgorithmInsightsPanel';
import { TemperatureIntelligencePanel } from './TemperatureIntelligencePanel';
import { TemperatureSeriesChart } from '../charts/temperature/TemperatureSeriesChart';

export const TemperatureV2Cockpit: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pointParam = searchParams.get('point');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [intelLoading, setIntelLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [riskItems, setRiskItems] = useState<any[]>([]);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [sensors, setSensors] = useState<string[]>([]);
  const [problemIds, setProblemIds] = useState<string[]>([]);
  const [sensorNames, setSensorNames] = useState<Record<string, string>>({});
  const [selectedSensor, setSelectedSensor] = useState<string | null>(pointParam);
  const [seriesData, setSeriesData] = useState<any>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<'guide' | 'algo' | 'intel'>('intel');

  // 加载总览数据
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<any>('/temperature/summary?view=overview');
      const payload = result?.data && result?.success !== undefined ? result.data : result;
      setOverview(payload);
      const summary = payload?.summary || [];
      const ids: string[] = summary.map((r: any) => String(r.sensor_id || r.SID || '')).filter((s: string) => s);
      // 后端 alert_level 为中文（正常 / 需关注），旧逻辑把"正常"也当成异常
      const names: Record<string, string> = {};
      summary.forEach((r: any) => {
        const id = String(r.sensor_id || r.SID || '');
        if (id) names[id] = String(r.sensor_name || r.point_name || id);
      });
      const problems: string[] = summary
        .filter((r: any) => r.level === 'warning' || r.level === 'alert')
        .map((r: any) => String(r.sensor_id || r.SID || ''));
      setSensors([...new Set(ids)] as string[]);
      setSensorNames(names);
      setProblemIds([...new Set(problems)] as string[]);
      if (ids.length > 0 && !selectedSensor) setSelectedSensor(ids[0]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedSensor]);

  const fetchIntelligence = useCallback(async () => {
    setIntelLoading(true);
    try {
      const [snapshotResult, riskResult, actionResult] = await Promise.all([
        apiGet<any>('/temperature/v2/intelligence/snapshot'),
        apiGet<any>('/temperature/v2/intelligence/risk-evaluation'),
        apiGet<any>('/temperature/v2/intelligence/actions'),
      ]);
      // snapshot 接口返回裸对象，不包 success；只认实际数据体
      const snapshotPayload = snapshotResult?.data ?? snapshotResult;
      setSnapshot(snapshotPayload && Object.keys(snapshotPayload).length > 0 ? snapshotPayload : null);
      setRiskItems(Array.isArray(riskResult?.items) ? riskResult.items : []);
      setActionPlans(Array.isArray(actionResult?.plans) ? actionResult.plans : []);
    } catch {
      setSnapshot(null);
      setRiskItems([]);
      setActionPlans([]);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchOverview(), fetchIntelligence()]);
  }, [fetchOverview, fetchIntelligence]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

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

  const riskBySensor = riskItems.reduce((acc: Record<string, any>, item: any) => {
    const sensorId = String(item?.sensor_id || '');
    if (sensorId) acc[sensorId] = item;
    return acc;
  }, {});

  const actionBySensor = actionPlans.reduce((acc: Record<string, any>, plan: any) => {
    const sensorId = String(plan?.sensor_id || '');
    if (sensorId) acc[sensorId] = plan;
    return acc;
  }, {});

  const orderedSensors = [...sensors].sort((left, right) => {
    const leftScore = Number(riskBySensor[left]?.risk_score || 0);
    const rightScore = Number(riskBySensor[right]?.risk_score || 0);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.localeCompare(right, 'zh-CN');
  });

  const selectedRisk = selectedSensor ? riskBySensor[selectedSensor] : null;
  const selectedActionPlan = selectedSensor ? actionBySensor[selectedSensor] : null;
  const riskStatusMap = Object.fromEntries(
    orderedSensors.map(sensorId => {
      const item = riskBySensor[sensorId];
      return [sensorId, {
        status: item?.risk_level || 'normal',
        score: item?.risk_score,
      }];
    }),
  );

  if (loading) {
    return (
      <div className="ds-page">
        <StateView kind="loading" title="加载温度数据…" />
      </div>
    );
  }

  return (
    <div className="ds-page">
      <PageHeader
        eyebrow="温度 · 哪个点不对"
        title="温度监测"
        description="台账 320 个传感器，251 个有分析数据；选中后查看时间序列，异常点可进入高级分析"
        meta={
          <span className={`ds-chip ${problemIds.length > 0 ? 'ds-chip--warn' : 'ds-chip--ok'}`}>
            {problemIds.length} 个需关注 / 有数据 {sensors.length} 个
          </span>
        }
        actions={
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={!selectedSensor}
            onClick={() => {
              if (!selectedSensor) return;
              const pointId = sensorNames[selectedSensor] || selectedSensor;
              navigate(`/advanced?point=${encodeURIComponent(pointId)}&metric=temperature&from=temperature`);
            }}
          >
            分析该点 →
          </button>
        }
      />

      {/* Layer 1: VitalSigns 顶栏 */}
      <TempVitalSignsStrip
        stats={overview?.stats || {}}
        assessment={overview?.construction_assessment}
        sensorCount={sensors.length}
        riskItem={selectedRisk || riskItems[0]}
      />

      {/* Layer 2: 主面板 — 三栏布局 */}
      <div className="flex-1 min-h-0 flex gap-3 px-4 py-3">
        {/* 左栏: 传感器列表 */}
        <div className="w-48 shrink-0 flex flex-col">
          <PointSelector
            cardId="temp-v2-selector"
            points={orderedSensors}
            selectedPoint={selectedSensor}
            onSelectPoint={setSelectedSensor}
            loading={false}
            problemPointIds={problemIds}
            labelMap={sensorNames}
            itemStatusMap={riskStatusMap}
          />
        </div>

        {/* 中栏: 时间序列图 */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0 ds-panel p-3">
            <TemperatureSeriesChart
              cardId="temp-v2-series"
              sensorId={selectedSensor}
              data={seriesData}
              loading={seriesLoading}
            />
          </div>
        </div>

        {/* 右栏: 智能处置 / 施工指导 / 算法洞察 切换 */}
        <div className="w-96 shrink-0 flex flex-col ds-panel">
          {/* 切换按钮 */}
          <div className="shrink-0 flex border-b border-slate-700/50">
            <button onClick={() => setActivePanel('intel')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activePanel === 'intel' ? 'bg-cyan-600/20 text-white border-b-2 border-cyan-400' : 'text-white hover:bg-slate-800'}`}>
              <i className="fas fa-shield-halved mr-1.5" />智能处置
            </button>
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
            {activePanel === 'intel' ? (
              <TemperatureIntelligencePanel
                sensorId={selectedSensor}
                snapshot={snapshot}
                riskItem={selectedRisk}
                actionPlan={selectedActionPlan}
                loading={intelLoading}
                onRefresh={refreshAll}
              />
            ) : activePanel === 'algo' ? (
              <AlgorithmInsightsPanel sensorId={selectedSensor} />
            ) : (
              <ConstructionGuidePanel assessment={selectedRisk?.construction_assessment || overview?.construction_assessment} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemperatureV2Cockpit;
