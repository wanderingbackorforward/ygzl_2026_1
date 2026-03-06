/**
 * 温度页面上下文提取工具
 */

import type { TemperatureContext } from '../../types/pageContext';
import { cachePageData } from '../../hooks/usePageContext';

/**
 * 从温度页面数据中提取上下文
 */
export function extractTemperatureContext(data: any): TemperatureContext {
  const sensors = data?.sensors || [];
  const temperatures = sensors
    .map((s: any) => s.temperature)
    .filter((t: any) => typeof t === 'number' && isFinite(t));

  const totalSensors = sensors.length;
  const avgTemperature = temperatures.length > 0
    ? temperatures.reduce((sum: number, t: number) => sum + t, 0) / temperatures.length
    : 0;
  const maxTemperature = temperatures.length > 0 ? Math.max(...temperatures) : 0;
  const minTemperature = temperatures.length > 0 ? Math.min(...temperatures) : 0;

  // 统计异常点（温度超过阈值）
  const highTempThreshold = 35; // 摄氏度
  const lowTempThreshold = -10; // 摄氏度
  const anomalies = temperatures.filter((t: number) => t > highTempThreshold || t < lowTempThreshold);

  const context: TemperatureContext = {
    pagePath: '/temperature',
    pageTitle: '温度监测',
    moduleKey: 'temperature',
    dataSnapshot: {
      summary: {
        totalSensors,
        avgTemperature: Number(avgTemperature.toFixed(2)),
        maxTemperature: Number(maxTemperature.toFixed(2)),
        minTemperature: Number(minTemperature.toFixed(2)),
        temperatureRange: [minTemperature, maxTemperature],
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
      dataSource: '温度传感器',
      recordCount: totalSensors,
      hasAnomalies: anomalies.length > 0,
      anomalyCount: anomalies.length,
    },
  };

  // 缓存到 localStorage
  cachePageData('temperature', context.dataSnapshot);

  return context;
}

/**
 * 格式化温度上下文为文本摘要
 * 用于发送给大模型
 */
export function formatTemperatureContextForLLM(context: TemperatureContext): string {
  const { summary, statistics } = context.dataSnapshot;

  return `
## 温度监测数据摘要

**数据概况**：
- 传感器总数：${summary.totalSensors} 个
- 平均温度：${summary.avgTemperature} °C
- 温度范围：${summary.minTemperature} ~ ${summary.maxTemperature} °C

**异常情况**：
- 异常点数量：${statistics?.anomalyCount || 0} 个（温度 > 35°C 或 < -10°C）
- 正常点数量：${statistics?.normalCount || 0} 个

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
