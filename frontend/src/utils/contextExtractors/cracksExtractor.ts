/**
 * 裂缝页面上下文提取工具
 */

import type { CracksContext } from '../../types/pageContext';
import { cachePageData } from '../../hooks/usePageContext';

/**
 * 从裂缝页面数据中提取上下文
 */
export function extractCracksContext(data: any): CracksContext {
  const cracks = data?.cracks || [];
  const widths = cracks
    .map((c: any) => c.width)
    .filter((w: any) => typeof w === 'number' && isFinite(w));

  const totalCracks = cracks.length;
  const avgWidth = widths.length > 0
    ? widths.reduce((sum: number, w: number) => sum + w, 0) / widths.length
    : 0;
  const maxWidth = widths.length > 0 ? Math.max(...widths) : 0;

  // 计算增长率（如果有历史数据）
  let growthRate = 0;
  if (cracks.length > 0 && cracks[0].history) {
    const recentWidths = cracks.map((c: any) => {
      const history = c.history || [];
      if (history.length >= 2) {
        const latest = history[history.length - 1].width;
        const previous = history[history.length - 2].width;
        return ((latest - previous) / previous) * 100;
      }
      return 0;
    });
    growthRate = recentWidths.reduce((sum: number, r: number) => sum + r, 0) / recentWidths.length;
  }

  // 统计异常点（裂缝宽度超过阈值）
  const widthThreshold = 2.0; // mm
  const anomalies = widths.filter((w: number) => w > widthThreshold);

  const context: CracksContext = {
    pagePath: '/cracks',
    pageTitle: '裂缝监测',
    moduleKey: 'cracks',
    dataSnapshot: {
      summary: {
        totalCracks,
        avgWidth: Number(avgWidth.toFixed(2)),
        maxWidth: Number(maxWidth.toFixed(2)),
        growthRate: Number(growthRate.toFixed(2)),
      },
      selectedItems: [],
      filters: {},
      statistics: {
        totalCount: totalCracks,
        anomalyCount: anomalies.length,
        normalCount: totalCracks - anomalies.length,
      },
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: '裂缝监测仪',
      recordCount: totalCracks,
      hasAnomalies: anomalies.length > 0,
      anomalyCount: anomalies.length,
    },
  };

  // 缓存到 localStorage
  cachePageData('cracks', context.dataSnapshot);

  return context;
}

/**
 * 格式化裂缝上下文为文本摘要
 * 用于发送给大模型
 */
export function formatCracksContextForLLM(context: CracksContext): string {
  const { summary, statistics } = context.dataSnapshot;

  return `
## 裂缝监测数据摘要

**数据概况**：
- 裂缝总数：${summary.totalCracks} 条
- 平均宽度：${summary.avgWidth} mm
- 最大宽度：${summary.maxWidth} mm
- 增长率：${summary.growthRate}%

**异常情况**：
- 异常裂缝数量：${statistics?.anomalyCount || 0} 条（宽度 > 2.0 mm）
- 正常裂缝数量：${statistics?.normalCount || 0} 条

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
