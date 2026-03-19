/**
 * 温度V2 VitalSignsStrip — 2秒扫描层
 * 6个关键指标: 当前温度 | 日温差 | 趋势 | 冻融周期 | 施工状态 | 传感器数
 */
import React from 'react';

interface VitalCardProps {
  label: string;
  value: string;
  status: 'green' | 'yellow' | 'red';
  subtitle?: string;
}

const STATUS_BG: Record<string, string> = {
  green: 'bg-green-900/40 border-green-700/50',
  yellow: 'bg-yellow-900/40 border-yellow-700/50',
  red: 'bg-red-900/40 border-red-700/50',
};

const DOT_COLOR: Record<string, string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

const VitalCard: React.FC<VitalCardProps> = ({ label, value, status, subtitle }) => (
  <div className={`rounded-lg border p-3 ${STATUS_BG[status]} flex flex-col items-center justify-center`}>
    <div className="flex items-center gap-1.5 mb-1">
      <div className={`w-2 h-2 rounded-full ${DOT_COLOR[status]}`} />
      <span className="text-xs text-slate-200 font-medium">{label}</span>
    </div>
    <span className="text-xl font-bold text-white">{value}</span>
    {subtitle && <span className="text-xs text-slate-200 mt-0.5">{subtitle}</span>}
  </div>
);

interface TempVitalSignsProps {
  stats: any;
  assessment: any;
  sensorCount: number;
}

export const TempVitalSignsStrip: React.FC<TempVitalSignsProps> = ({ stats, assessment, sensorCount }) => {
  const currentAvg = stats?.current_avg ?? stats?.avg_temperature;
  const avgRange = stats?.avg_range;
  const trendType = stats?.dominant_trend;
  const freezeThaw = stats?.freeze_thaw_cycles ?? 0;
  const displaySensorCount = stats?.sensor_count ?? sensorCount;
  const overallStatus = assessment?.overall_status ?? 'green';

  // 温度状态
  const tempStatus = currentAvg == null ? 'green'
    : currentAvg > 35 || currentAvg < 0 ? 'red'
    : currentAvg > 30 || currentAvg < 5 ? 'yellow' : 'green';

  // 日温差状态
  const rangeStatus = avgRange == null ? 'green'
    : avgRange > 20 ? 'red' : avgRange > 15 ? 'yellow' : 'green';

  // 趋势状态
  const trendLabel = trendType === 'rising_fast' ? '快速升温'
    : trendType === 'rising' ? '缓慢升温'
    : trendType === 'falling_fast' ? '快速降温'
    : trendType === 'falling' ? '缓慢降温'
    : trendType ? String(trendType).slice(0, 6) : '稳定';
  const trendStatus = (trendType === 'rising_fast' || trendType === 'falling_fast') ? 'red'
    : (trendType === 'rising' || trendType === 'falling') ? 'yellow' : 'green';

  // 冻融状态
  const ftStatus = freezeThaw > 30 ? 'red' : freezeThaw > 10 ? 'yellow' : 'green';

  return (
    <div className="shrink-0 px-4 py-3">
      <div className="grid grid-cols-6 gap-3">
        <VitalCard
          label="当前温度"
          value={currentAvg != null ? `${Number(currentAvg).toFixed(1)}°C` : '--'}
          status={tempStatus}
          subtitle="站点均值"
        />
        <VitalCard
          label="日温差"
          value={avgRange != null ? `${Number(avgRange).toFixed(1)}°C` : '--'}
          status={rangeStatus}
          subtitle="平均日较差"
        />
        <VitalCard
          label="温度趋势"
          value={trendLabel}
          status={trendStatus}
          subtitle="主导趋势"
        />
        <VitalCard
          label="冻融周期"
          value={`${freezeThaw}`}
          status={ftStatus}
          subtitle="累计次数"
        />
        <VitalCard
          label="施工状态"
          value={overallStatus === 'red' ? '禁止' : overallStatus === 'yellow' ? '注意' : '正常'}
          status={overallStatus as 'green' | 'yellow' | 'red'}
          subtitle={assessment?.summary?.slice(0, 8) ?? '条件评估'}
        />
        <VitalCard
          label="传感器"
          value={`${displaySensorCount}`}
          status="green"
          subtitle="个监测点"
        />
      </div>
    </div>
  );
};

export default TempVitalSignsStrip;
