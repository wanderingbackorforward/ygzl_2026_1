/**
 * 振动页面上下文提取工具
 */

import type { VibrationContext } from '../../types/pageContext';
import { cachePageData } from '../../hooks/usePageContext';

/**
 * 从振动页面数据中提取上下文
 */
export function extractVibrationContext(data: any): VibrationContext {
  const sensors = data?.sensors || [];
  const amplitudes = sensors
    .map((s: any) => s.amplitude)
    .filter((a: any) => typeof a === 'number' && isFinite(a));

  const totalSensors = sensors.length;
  const avgAmplitude = amplitudes.length > 0
    ? amplitudes.reduce((sum: number, a: number) => sum + a, 0) / amplitudes.length
    : 0;
  const maxAmplitude = amplitudes.length > 0 ? Math.max(...amplitudes) : 0;

  // 计算平均频率
  const frequencies = sensors
    .map((s: any) => s.frequency)
    .filter((f: any) => typeof f === 'number' && isFinite(f));
  const avgFrequency = frequencies.length > 0
    ? frequencies.reduce((sum: number, f: number) => sum + f, 0) / frequencies.length
    : 0;

  // 统计异常点（振幅超过阈值）
  const amplitudeThreshold = 5.0; // mm/s
  const anomalies = amplitudes.filter((a: number) => a > amplitudeThreshold);

  const context: VibrationContext = {
    pagePath: '/vibration',
    pageTitle: '振动监测',
    moduleKey: 'vibration',
    dataSnapshot: {
      summary: {
        totalSensors,
        avgAmplitude: Number(avgAmplitude.toFixed(2)),
        maxAmplitude: Number(maxAmplitude.toFixed(2)),
        frequency: Number(avgFrequency.toFixed(2)),
      },
      selectedItems: [],
      filters: {},
      statistics: {
        totalCount: totalSensors,
        anomalyCount: anomalies.length,
        normalCount: totalSensors - anomalies.length,
      },
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: '振动传感器',
      recordCount: totalSensors,
      hasAnomalies: anomalies.length > 0,
      anomalyCount: anomalies.length,
    },
  };

  // 缓存到 localStorage
  cachePageData('vibration', context.dataSnapshot);

  return context;
}

/**
 * 格式化振动上下文为文本摘要
 * 用于发送给大模型
 */
export function formatVibrationContextForLLM(context: VibrationContext): string {
  const { summary, statistics } = context.dataSnapshot;

  return `
## 振动监测数据摘要

**数据概况**：
- 传感器总数：${summary.totalSensors} 个
- 平均振幅：${summary.avgAmplitude} mm/s
- 最大振幅：${summary.maxAmplitude} mm/s
- 平均频率：${summary.frequency} Hz

**异常情况**：
- 异常点数量：${statistics?.anomalyCount || 0} 个（振幅 > 5.0 mm/s）
- 正常点数量：${statistics?.normalCount || 0} 个

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
