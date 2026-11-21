/**
 * 沉降页面上下文提取工具
 */

import type { SettlementContext } from '../../types/pageContext';
import { cachePageData } from '../../hooks/usePageContext';

/**
 * 从沉降页面数据中提取上下文
 */
export function extractSettlementContext(data: any): SettlementContext {
  const points = data?.points || [];
  const settlements = points
    .map((p: any) => p.total_change)
    .filter((s: any) => typeof s === 'number' && isFinite(s));

  const totalPoints = points.length;
  const avgSettlement = settlements.length > 0
    ? settlements.reduce((sum: number, s: number) => sum + s, 0) / settlements.length
    : 0;
  const maxSettlement = settlements.length > 0 ? Math.min(...settlements) : 0;

  // 分级只读后端结论（level / trend），前端不再自设阈值
  const levels = points.map((p: any) => p.level).filter((l: any) => typeof l === 'string');
  const alertCount = levels.filter((l: string) => l === 'alert').length;
  const warningCount = levels.filter((l: string) => l === 'warning').length;
  const anomalyCount = alertCount + warningCount;

  const downCount = points.filter((p: any) => p.trend === 'down').length;
  const upCount = points.filter((p: any) => p.trend === 'up').length;
  const trendType = downCount > upCount ? '持续沉降' : upCount > downCount ? '持续抬升' : '稳定';
  const riskLevel = alertCount > 0 ? '高风险' : warningCount > 0 ? '中风险' : '正常';

  const context: SettlementContext = {
    pagePath: '/settlement',
    pageTitle: '沉降监测',
    moduleKey: 'settlement',
    dataSnapshot: {
      summary: {
        totalPoints,
        avgSettlement: Number(avgSettlement.toFixed(2)),
        maxSettlement: Number(maxSettlement.toFixed(2)),
        trendType,
        riskLevel,
      },
      selectedItems: [],
      filters: {},
      statistics: {
        totalCount: totalPoints,
        anomalyCount,
        normalCount: totalPoints - anomalyCount,
      },
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: '沉降监测传感器',
      recordCount: totalPoints,
      hasAnomalies: anomalyCount > 0,
      anomalyCount,
    },
  };

  // 缓存到 localStorage
  cachePageData('settlement', context.dataSnapshot);

  return context;
}

/**
 * 格式化沉降上下文为文本摘要
 * 用于发送给大模型
 */
export function formatSettlementContextForLLM(context: SettlementContext): string {
  const { summary, statistics } = context.dataSnapshot;

  return `
## 沉降监测数据摘要

**数据概况**：
- 监测点位总数：${summary.totalPoints} 个
- 平均沉降量：${summary.avgSettlement} mm
- 最大沉降量：${summary.maxSettlement} mm
- 趋势类型：${summary.trendType}
- 风险等级：${summary.riskLevel}

**异常情况**：
- 异常点数量：${statistics?.anomalyCount || 0} 个（由后端分级判定）
- 正常点数量：${statistics?.normalCount || 0} 个

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
