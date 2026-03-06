/**
 * InSAR 页面上下文提取工具
 */

import type { InsarContext } from '../../types/pageContext';
import { cachePageData } from '../../hooks/usePageContext';

/**
 * 从 InSAR 页面数据中提取上下文
 */
export function extractInsarContext(data: any): InsarContext {
  const features = data?.features || [];
  const velocities = features
    .map((f: any) => f.properties?.velocity)
    .filter((v: any) => typeof v === 'number' && isFinite(v));

  const totalPoints = features.length;
  const avgVelocity = velocities.length > 0
    ? velocities.reduce((sum: number, v: number) => sum + v, 0) / velocities.length
    : 0;
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;
  const minVelocity = velocities.length > 0 ? Math.min(...velocities) : 0;

  // 统计异常点（速率超过阈值）
  const anomalyThreshold = 10; // mm/年
  const anomalies = velocities.filter((v: number) => Math.abs(v) > anomalyThreshold);

  const context: InsarContext = {
    pagePath: '/insar',
    pageTitle: 'InSAR 监测',
    moduleKey: 'insar',
    dataSnapshot: {
      summary: {
        totalPoints,
        avgVelocity: Number(avgVelocity.toFixed(2)),
        maxVelocity: Number(maxVelocity.toFixed(2)),
        minVelocity: Number(minVelocity.toFixed(2)),
        velocityRange: [minVelocity, maxVelocity],
      },
      selectedItems: [],
      filters: {},
      statistics: {
        totalCount: totalPoints,
        anomalyCount: anomalies.length,
        normalCount: totalPoints - anomalies.length,
      },
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: 'Sentinel-1 SAR',
      recordCount: totalPoints,
      hasAnomalies: anomalies.length > 0,
      anomalyCount: anomalies.length,
    },
  };

  // 缓存到 localStorage
  cachePageData('insar', context.dataSnapshot);

  return context;
}

/**
 * 格式化 InSAR 上下文为文本摘要
 * 用于发送给大模型
 */
export function formatInsarContextForLLM(context: InsarContext): string {
  const { summary, statistics } = context.dataSnapshot;

  return `
## InSAR 监测数据摘要

**数据概况**：
- 监测点位总数：${summary.totalPoints} 个
- 平均沉降速率：${summary.avgVelocity} mm/年
- 速率范围：${summary.minVelocity} ~ ${summary.maxVelocity} mm/年

**异常情况**：
- 异常点数量：${statistics?.anomalyCount || 0} 个（速率绝对值 > 10 mm/年）
- 正常点数量：${statistics?.normalCount || 0} 个

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
