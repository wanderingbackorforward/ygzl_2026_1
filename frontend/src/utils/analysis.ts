// 高级分析模块工具函数

import type { Anomaly, AnomalySortBy, SortOrder, Recommendation } from '../types/analysis';

/**
 * 严重程度文本映射
 */
export const severityText: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * 严重程度颜色映射
 */
export const severityColor: Record<string, string> = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#ffa940',
  low: '#ffc53d',
};

/**
 * 严重程度背景色映射
 */
export const severityBgColor: Record<string, string> = {
  critical: 'rgba(255, 77, 79, 0.1)',
  high: 'rgba(255, 122, 69, 0.1)',
  medium: 'rgba(255, 169, 64, 0.1)',
  low: 'rgba(255, 197, 61, 0.1)',
};

/**
 * 异常类型文本映射
 */
export const anomalyTypeText: Record<string, string> = {
  spike: '突变',
  acceleration: '加速',
  fluctuation: '波动',
  trend: '趋势异常',
  unknown: '未知',
};

/**
 * 异常类型图标映射
 */
export const anomalyTypeIcon: Record<string, string> = {
  spike: 'bolt',
  acceleration: 'arrow-up',
  fluctuation: 'wave-square',
  trend: 'chart-line',
  unknown: 'question-circle',
};

/**
 * 处置建议优先级文本映射
 */
export const priorityText: Record<string, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

/**
 * 处置建议优先级颜色映射
 */
export const priorityColor: Record<string, string> = {
  urgent: '#ff4d4f',
  high: '#ff7a45',
  medium: '#ffa940',
  low: '#52c41a',
};

/**
 * 行动方案文本映射
 */
export const actionText: Record<string, string> = {
  inspect: '立即巡检',
  monitor: '加密监测',
  repair: '维修加固',
  report: '上报处理',
};

/**
 * 行动方案图标映射
 */
export const actionIcon: Record<string, string> = {
  inspect: 'search',
  monitor: 'eye',
  repair: 'tools',
  report: 'file-alt',
};

/**
 * 排序异常列表
 */
export function sortAnomalies(
  anomalies: Anomaly[],
  sortBy: AnomalySortBy,
  order: SortOrder
): Anomaly[] {
  const sorted = [...anomalies];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'severity':
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        comparison = severityOrder[a.severity] - severityOrder[b.severity];
        break;
      case 'score':
        comparison = a.anomaly_score - b.anomaly_score;
        break;
      case 'point_id':
        comparison = a.point_id.localeCompare(b.point_id);
        break;
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * 筛选异常列表
 */
export function filterAnomalies(
  anomalies: Anomaly[],
  filter: {
    severity?: string[];
    anomaly_type?: string[];
    point_ids?: string[];
  }
): Anomaly[] {
  return anomalies.filter(anomaly => {
    if (filter.severity && filter.severity.length > 0) {
      if (!filter.severity.includes(anomaly.severity)) {
        return false;
      }
    }

    if (filter.anomaly_type && filter.anomaly_type.length > 0) {
      if (!filter.anomaly_type.includes(anomaly.anomaly_type)) {
        return false;
      }
    }

    if (filter.point_ids && filter.point_ids.length > 0) {
      if (!filter.point_ids.includes(anomaly.point_id)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 根据异常生成处置建议
 */
export function generateRecommendations(anomalies: Anomaly[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 按严重程度分组
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
  const highAnomalies = anomalies.filter(a => a.severity === 'high');
  const mediumAnomalies = anomalies.filter(a => a.severity === 'medium');

  // 严重异常：立即巡检
  if (criticalAnomalies.length > 0) {
    recommendations.push({
      id: 'rec-critical-inspect',
      priority: 'urgent',
      action: 'inspect',
      title: '立即巡检严重异常点位',
      reason: `发现 ${criticalAnomalies.length} 个严重异常点位，需要立即现场巡检确认情况`,
      related_anomalies: criticalAnomalies.map(a => `${a.point_id}-${a.date}`),
      estimated_time: '2小时内',
      point_ids: criticalAnomalies.map(a => a.point_id),
    });
  }

  // 高级异常：加密监测
  if (highAnomalies.length > 0) {
    recommendations.push({
      id: 'rec-high-monitor',
      priority: 'high',
      action: 'monitor',
      title: '加密监测高风险点位',
      reason: `发现 ${highAnomalies.length} 个高风险异常点位，建议增加监测频率`,
      related_anomalies: highAnomalies.map(a => `${a.point_id}-${a.date}`),
      estimated_time: '24小时内',
      point_ids: highAnomalies.map(a => a.point_id),
    });
  }

  // 中级异常：持续关注
  if (mediumAnomalies.length > 0) {
    recommendations.push({
      id: 'rec-medium-monitor',
      priority: 'medium',
      action: 'monitor',
      title: '持续关注中等异常点位',
      reason: `发现 ${mediumAnomalies.length} 个中等异常点位，建议持续关注变化趋势`,
      related_anomalies: mediumAnomalies.map(a => `${a.point_id}-${a.date}`),
      estimated_time: '3天内',
      point_ids: mediumAnomalies.map(a => a.point_id),
    });
  }

  // 突变类型：维修加固
  const spikeAnomalies = anomalies.filter(
    a => a.anomaly_type === 'spike' && (a.severity === 'critical' || a.severity === 'high')
  );
  if (spikeAnomalies.length > 0) {
    recommendations.push({
      id: 'rec-spike-repair',
      priority: 'high',
      action: 'repair',
      title: '评估突变点位结构安全',
      reason: `发现 ${spikeAnomalies.length} 个突变异常点位，建议评估结构安全性并考虑加固措施`,
      related_anomalies: spikeAnomalies.map(a => `${a.point_id}-${a.date}`),
      estimated_time: '1周内',
      point_ids: spikeAnomalies.map(a => a.point_id),
    });
  }

  // 加速类型：上报处理
  const accelerationAnomalies = anomalies.filter(
    a => a.anomaly_type === 'acceleration' && a.severity === 'critical'
  );
  if (accelerationAnomalies.length > 0) {
    recommendations.push({
      id: 'rec-acceleration-report',
      priority: 'urgent',
      action: 'report',
      title: '上报沉降加速异常',
      reason: `发现 ${accelerationAnomalies.length} 个沉降加速异常点位，建议上报并制定应急预案`,
      related_anomalies: accelerationAnomalies.map(a => `${a.point_id}-${a.date}`),
      estimated_time: '立即',
      point_ids: accelerationAnomalies.map(a => a.point_id),
    });
  }

  return recommendations;
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

/**
 * 计算异常统计
 */
export function calculateAnomalyStatistics(anomalies: Anomaly[]) {
  const stats = {
    total: anomalies.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    by_type: {} as Record<string, number>,
    by_point: {} as Record<string, number>,
  };

  anomalies.forEach(anomaly => {
    // 按严重程度统计
    stats[anomaly.severity]++;

    // 按类型统计
    if (!stats.by_type[anomaly.anomaly_type]) {
      stats.by_type[anomaly.anomaly_type] = 0;
    }
    stats.by_type[anomaly.anomaly_type]++;

    // 按点位统计
    if (!stats.by_point[anomaly.point_id]) {
      stats.by_point[anomaly.point_id] = 0;
    }
    stats.by_point[anomaly.point_id]++;
  });

  return stats;
}
