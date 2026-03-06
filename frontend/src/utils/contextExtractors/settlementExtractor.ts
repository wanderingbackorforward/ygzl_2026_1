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
    .map((p: any) => p.settlement)
    .filter((s: any) => typeof s === 'number' && isFinite(s));

  const totalPoints = points.length;
  const avgSettlement = settlements.length > 0
    ? settlements.reduce((sum: number, s: number) => sum + s, 0) / settlements.length
    : 0;
  const maxSettlement = settlements.length > 0 ? Math.max(...settlements) : 0;

  // 判断趋势类型
  let trendType = '稳定';
  if (avgSettlement < -5) trendType = '持续沉降';
  else if (avgSettlement > 5) trendType = '持续抬升';

  // 判断风险等级
  let riskLevel = '正常';
  if (Math.abs(maxSettlement) > 20) riskLevel = '高风险';
  else if (Math.abs(maxSettlement) > 10) riskLevel = '中风险';

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
        anomalyCount: settlements.filter((s: number) => Math.abs(s) > 10).length,
        normalCount: totalPoints - settlements.filter((s: number) => Math.abs(s) > 10).length,
      },
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: '沉降监测传感器',
      recordCount: totalPoints,
      hasAnomalies: Math.abs(maxSettlement) > 10,
      anomalyCount: settlements.filter((s: number) => Math.abs(s) > 10).length,
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
- 异常点数量：${statistics?.anomalyCount || 0} 个（沉降量绝对值 > 10 mm）
- 正常点数量：${statistics?.normalCount || 0} 个

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
