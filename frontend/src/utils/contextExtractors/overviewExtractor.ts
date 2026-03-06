/**
 * 总览页面上下文提取工具
 */

import type { OverviewContext } from '../../types/pageContext';
import { cachePageData } from '../../hooks/usePageContext';

/**
 * 从总览页面数据中提取上下文
 */
export function extractOverviewContext(data: any): OverviewContext {
  const modules = data?.modules || {};

  // 计算安全评分（0-100）
  let safetyScore = 100;
  let totalAnomalies = 0;
  const modulesStatus: Record<string, string> = {};

  // 遍历各模块状态
  Object.keys(modules).forEach((key) => {
    const module = modules[key];
    const anomalyCount = module?.anomalyCount || 0;
    totalAnomalies += anomalyCount;

    // 根据异常数量确定模块状态
    if (anomalyCount === 0) {
      modulesStatus[key] = '正常';
    } else if (anomalyCount < 5) {
      modulesStatus[key] = '轻微异常';
      safetyScore -= 5;
    } else if (anomalyCount < 10) {
      modulesStatus[key] = '中度异常';
      safetyScore -= 10;
    } else {
      modulesStatus[key] = '严重异常';
      safetyScore -= 20;
    }
  });

  safetyScore = Math.max(0, safetyScore);

  // 确定风险等级
  let riskLevel = '正常';
  if (safetyScore < 60) riskLevel = '高风险';
  else if (safetyScore < 80) riskLevel = '中风险';
  else if (safetyScore < 95) riskLevel = '低风险';

  const context: OverviewContext = {
    pagePath: '/overview',
    pageTitle: '数据总览',
    moduleKey: 'overview',
    dataSnapshot: {
      summary: {
        safetyScore,
        riskLevel,
        modulesStatus,
        totalAnomalies,
      },
      selectedItems: [],
      filters: {},
      statistics: {
        totalCount: Object.keys(modules).length,
        anomalyCount: totalAnomalies,
        normalCount: Object.values(modulesStatus).filter((s) => s === '正常').length,
      },
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: '综合数据源',
      recordCount: Object.keys(modules).length,
      hasAnomalies: totalAnomalies > 0,
      anomalyCount: totalAnomalies,
    },
  };

  // 缓存到 localStorage
  cachePageData('overview', context.dataSnapshot);

  return context;
}

/**
 * 格式化总览上下文为文本摘要
 * 用于发送给大模型
 */
export function formatOverviewContextForLLM(context: OverviewContext): string {
  const { summary, statistics } = context.dataSnapshot;

  const moduleStatusText = Object.entries(summary.modulesStatus)
    .map(([key, status]) => `- ${key}: ${status}`)
    .join('\n');

  return `
## 数据总览摘要

**整体状况**：
- 安全评分：${summary.safetyScore} 分
- 风险等级：${summary.riskLevel}
- 总异常数：${summary.totalAnomalies} 个

**各模块状态**：
${moduleStatusText}

**统计信息**：
- 监测模块总数：${statistics?.totalCount || 0} 个
- 正常模块数：${statistics?.normalCount || 0} 个
- 异常模块数：${(statistics?.totalCount || 0) - (statistics?.normalCount || 0)} 个

**数据源**：${context.metadata.dataSource}
**更新时间**：${new Date(context.metadata.lastUpdate).toLocaleString('zh-CN')}
`.trim();
}
