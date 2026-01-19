/**
 * 二级数据分析类型定义
 * Analysis V2 Types
 */

// 严重程度等级
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'normal';

// 异常类型
export type AnomalyType =
  | 'threshold_exceeded'      // 超过阈值
  | 'rate_abnormal'           // 变化率异常
  | 'trend_abnormal'          // 趋势异常
  | 'prediction_warning'      // 预测预警
  | 'correlation_anomaly'     // 关联异常
  | 'pattern_detected';       // 检测到特殊模式

// 建议优先级
export type RecommendationPriority = 'urgent' | 'high' | 'medium' | 'low';

// 数据类型
export type DataType = 'settlement' | 'temperature' | 'crack' | 'vibration';

// 异常项
export interface AnomalyItem {
  id: string;                           // 唯一标识
  point_id: string;                     // 监测点ID
  anomaly_type: AnomalyType;            // 异常类型
  severity: SeverityLevel;              // 严重程度
  title: string;                        // 标题
  description: string;                  // 详细描述
  detected_at: string;                  // 检测时间
  data_time?: string;                   // 数据时间
  current_value?: number;               // 当前值
  threshold?: number;                   // 阈值
  deviation?: number;                   // 偏差值
  trend?: 'up' | 'down' | 'stable';     // 趋势方向
  related_points?: string[];            // 关联监测点
  metadata?: Record<string, unknown>;   // 额外元数据
}

// 处置建议
export interface Recommendation {
  id: string;                           // 唯一标识
  priority: RecommendationPriority;     // 优先级
  title: string;                        // 标题
  description: string;                  // 详细描述
  action_type: string;                  // 行动类型 (inspect/repair/monitor/report)
  target_points?: string[];             // 目标监测点
  estimated_urgency?: string;           // 预估紧急程度
  reference_anomalies?: string[];       // 关联的异常ID
  metadata?: Record<string, unknown>;
}

// 分析统计
export interface AnalysisStats {
  total_points: number;                 // 总监测点数
  analyzed_points: number;              // 已分析点数
  anomaly_count: number;                // 异常数量
  critical_count: number;               // 严重异常数
  high_count: number;                   // 高风险数
  medium_count: number;                 // 中等风险数
  low_count: number;                    // 低风险数
  normal_count: number;                 // 正常数
}

// 汇总信息
export interface AnalysisSummary {
  total_points: number;
  anomaly_points: number;
  trend_distribution: Record<string, number>;
  alert_distribution: Record<string, number>;
  avg_daily_rate: number;
  max_cumulative_settlement?: number;
  critical_count: number;
  high_count: number;
  current_avg_temperature?: number;
  current_max_temperature?: number;
  current_min_temperature?: number;
  avg_daily_range?: number;
}

// 分析结果
export interface AnalysisResult {
  data_type: DataType;                  // 数据类型
  analysis_time: string;                // 分析时间
  stats: AnalysisStats;                 // 统计信息
  anomalies: AnomalyItem[];             // 异常列表
  recommendations: Recommendation[];     // 建议列表
  summary: AnalysisSummary;             // 汇总信息
  metadata?: Record<string, unknown>;
}

// API 响应类型
export interface AnalysisV2Response extends AnalysisResult {
  error?: string;
}

export interface AnomaliesResponse {
  count: number;
  anomalies: AnomalyItem[];
  error?: string;
}

export interface RecommendationsResponse {
  count: number;
  recommendations: Recommendation[];
  error?: string;
}

// 严重程度对应的颜色配置
export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#ff4d4f',    // 红色
  high: '#ff7a45',        // 橙色
  medium: '#ffc53d',      // 黄色
  low: '#73d13d',         // 绿色
  normal: '#1890ff',      // 蓝色
};

// 严重程度对应的中文标签
export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  normal: '正常',
};

// 优先级对应的颜色
export const PRIORITY_COLORS: Record<RecommendationPriority, string> = {
  urgent: '#ff4d4f',
  high: '#ff7a45',
  medium: '#ffc53d',
  low: '#73d13d',
};

// 优先级对应的中文标签
export const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

// 异常类型对应的中文标签
export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  threshold_exceeded: '超过阈值',
  rate_abnormal: '变化率异常',
  trend_abnormal: '趋势异常',
  prediction_warning: '预测预警',
  correlation_anomaly: '关联异常',
  pattern_detected: '特殊模式',
};
