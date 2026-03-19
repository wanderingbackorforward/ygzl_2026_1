/**
 * 诊断引擎 — 项目体检报告生成器
 *
 * 原创设计：不是数据展示，是替用户思考。
 * 综合沉降/裂缝/温度/地质/施工事件，输出：
 *   1. 一句话诊断（0.5秒理解）
 *   2. 证据链（因果关系）
 *   3. 行动指令（角色定制）
 *
 * 纯规则引擎，零网络依赖，零LLM调用。
 */

// ── 输入类型 ──────────────────────────────────
export interface DiagnosisInput {
  points: {
    point_id: string;
    alert_level: string;       // 'normal' | 'warning' | 'alert'
    total_change: number;      // mm, 负值=沉降
    trend_slope: number;       // mm/d
    trend_type: string;        // 'stable' | 'increasing' | 'decreasing'
    predicted_change_30d: number;
  }[];
  anomalies: {
    point_id: string;
    type: string;
    severity: string;          // 'critical' | 'high' | 'medium' | 'low'
    value: number;
    threshold: number;
    description: string;
  }[];
  recommendations: {
    type: string;
    priority: string;
    title: string;
    description: string;
    action: string;
    affected_points?: string[];
  }[];
}

// ── 输出类型 ──────────────────────────────────
export type HealthLevel = 'healthy' | 'watch' | 'warn' | 'danger';

export interface EvidenceNode {
  id: string;
  category: 'settlement' | 'crack' | 'temperature' | 'geology' | 'construction';
  label: string;
  detail: string;
  severity: number;           // 0-1, 用于节点大小
}

export interface EvidenceLink {
  source: string;
  target: string;
  relation: string;           // 因果描述
  strength: number;           // 0-1, 用于连线粗细
}

export interface ActionItem {
  role: 'engineer' | 'researcher' | 'manager';
  urgency: 'now' | 'today' | 'week';
  instruction: string;
  reason: string;
  relatedPoints: string[];
}

export interface DiagnosisResult {
  // 第一层：一句话
  sentence: string;
  level: HealthLevel;
  score: number;              // 0-100

  // 第二层：证据网络
  evidenceNodes: EvidenceNode[];
  evidenceLinks: EvidenceLink[];

  // 第三层：行动指令
  actions: ActionItem[];

  // 元数据
  timestamp: string;
  dataQuality: number;        // 0-1, 数据完整度
}

// ── 诊断引擎 ──────────────────────────────────
export function diagnose(input: DiagnosisInput): DiagnosisResult {
  const { points, anomalies, recommendations } = input;
  const now = new Date().toISOString();

  // 数据完整度
  const dataQuality = points.length > 0 ? Math.min(1, points.length / 26) : 0;

  // ── 安全评分 ──
  const score = computeScore(points, anomalies);
  const level = scoreToLevel(score);

  // ── 证据网络 ──
  const { nodes, links } = buildEvidenceNetwork(points, anomalies);

  // ── 行动指令 ──
  const actions = generateActions(points, anomalies, recommendations);

  // ── 诊断句 ──
  const sentence = composeSentence(points, anomalies, score, level);

  return {
    sentence,
    level,
    score,
    evidenceNodes: nodes,
    evidenceLinks: links,
    actions,
    timestamp: now,
    dataQuality,
  };
}

// ── 评分算法 ──────────────────────────────────
function computeScore(
  points: DiagnosisInput['points'],
  anomalies: DiagnosisInput['anomalies'],
): number {
  if (points.length === 0) return 100;

  let score = 100;

  // 报警/预警扣分
  for (const p of points) {
    if (p.alert_level === 'alert') score -= 12;
    if (p.alert_level === 'warning') score -= 4;

    // 加速沉降额外扣分
    if (p.trend_type === 'increasing' && p.trend_slope < -0.5) {
      score -= 6;
    }

    // 超大沉降量扣分
    if (p.total_change < -30) score -= 8;
    else if (p.total_change < -20) score -= 4;
  }

  // 严重异常扣分
  for (const a of anomalies) {
    if (a.severity === 'critical') score -= 10;
    else if (a.severity === 'high') score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToLevel(score: number): HealthLevel {
  if (score >= 85) return 'healthy';
  if (score >= 65) return 'watch';
  if (score >= 40) return 'warn';
  return 'danger';
}

// ── 证据网络构建 ──────────────────────────────
function buildEvidenceNetwork(
  points: DiagnosisInput['points'],
  anomalies: DiagnosisInput['anomalies'],
): { nodes: EvidenceNode[]; links: EvidenceLink[] } {
  const nodes: EvidenceNode[] = [];
  const links: EvidenceLink[] = [];

  // 找出最严重的几个点作为核心节点
  const alertPoints = points
    .filter(p => p.alert_level !== 'normal')
    .sort((a, b) => a.total_change - b.total_change)
    .slice(0, 6);

  for (const p of alertPoints) {
    const sev = p.alert_level === 'alert' ? 0.9 : 0.5;
    nodes.push({
      id: p.point_id,
      category: 'settlement',
      label: p.point_id,
      detail: `累计沉降 ${p.total_change.toFixed(1)}mm，速率 ${p.trend_slope.toFixed(2)}mm/d`,
      severity: sev,
    });
  }

  // 异常作为关联节点
  const seenTypes = new Set<string>();
  for (const a of anomalies) {
    const typeKey = a.type;
    if (seenTypes.has(typeKey)) continue;
    seenTypes.add(typeKey);

    const nodeId = `anomaly-${typeKey}`;
    nodes.push({
      id: nodeId,
      category: a.type.includes('crack') ? 'crack' : a.type.includes('temp') ? 'temperature' : 'settlement',
      label: anomalyTypeLabel(typeKey),
      detail: a.description,
      severity: a.severity === 'critical' ? 1 : a.severity === 'high' ? 0.7 : 0.4,
    });

    // 连接到受影响的点
    const affectedPoints = anomalies
      .filter(x => x.type === typeKey)
      .map(x => x.point_id)
      .filter(pid => alertPoints.some(p => p.point_id === pid));

    for (const pid of affectedPoints) {
      links.push({
        source: nodeId,
        target: pid,
        relation: `${anomalyTypeLabel(typeKey)}影响`,
        strength: a.severity === 'critical' ? 0.9 : 0.5,
      });
    }
  }

  // 如果有加速沉降的点群，它们之间可能存在空间关联
  const accelerating = alertPoints.filter(p => p.trend_type === 'increasing');
  for (let i = 0; i < accelerating.length - 1; i++) {
    for (let j = i + 1; j < accelerating.length; j++) {
      links.push({
        source: accelerating[i].point_id,
        target: accelerating[j].point_id,
        relation: '同步加速（疑似空间关联）',
        strength: 0.6,
      });
    }
  }

  return { nodes, links };
}

function anomalyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    threshold_exceeded: '超限',
    rate_abnormal: '速率异常',
    trend_abnormal: '趋势异常',
    prediction_warning: '预测预警',
  };
  return map[type] || type;
}

// ── 行动指令生成 ──────────────────────────────
function generateActions(
  points: DiagnosisInput['points'],
  anomalies: DiagnosisInput['anomalies'],
  recommendations: DiagnosisInput['recommendations'],
): ActionItem[] {
  const actions: ActionItem[] = [];

  // 工程师行动：基于异常和报警点
  const criticalPoints = points.filter(p => p.alert_level === 'alert');
  if (criticalPoints.length > 0) {
    const ids = criticalPoints.map(p => p.point_id);
    actions.push({
      role: 'engineer',
      urgency: 'now',
      instruction: `立即复测 ${ids.join('、')}，确认数据真实性`,
      reason: `${ids.length} 个监测点触发报警阈值`,
      relatedPoints: ids,
    });
  }

  // 加速沉降 → 工程师需加密监测
  const accelerating = points.filter(p => p.trend_slope < -0.5 && p.trend_type === 'increasing');
  if (accelerating.length > 0) {
    const ids = accelerating.map(p => p.point_id);
    actions.push({
      role: 'engineer',
      urgency: 'today',
      instruction: `加密监测频次至每日一次：${ids.join('、')}`,
      reason: '沉降速率加速，需密切跟踪',
      relatedPoints: ids,
    });
  }

  // 科研人员行动：需要分析的异常模式
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
  if (criticalAnomalies.length > 0) {
    actions.push({
      role: 'researcher',
      urgency: 'today',
      instruction: '运行空间自相关分析（Moran\'s I），排查异常是否具有空间聚集性',
      reason: `检测到 ${criticalAnomalies.length} 处高严重度异常，需判断是局部还是系统性问题`,
      relatedPoints: [...new Set(criticalAnomalies.map(a => a.point_id))],
    });
  }

  // 管理者行动：趋势预测
  const deteriorating = points.filter(p => p.predicted_change_30d < p.total_change - 5);
  if (deteriorating.length > 0) {
    actions.push({
      role: 'manager',
      urgency: 'week',
      instruction: `关注 ${deteriorating.length} 个点的30天预测趋势，评估是否需要调整施工方案`,
      reason: '模型预测未来30天沉降将进一步发展',
      relatedPoints: deteriorating.map(p => p.point_id),
    });
  }

  // 从后端建议中补充
  for (const rec of recommendations.slice(0, 3)) {
    const existing = actions.find(a => a.instruction.includes(rec.title));
    if (!existing) {
      actions.push({
        role: rec.priority === 'CRITICAL' || rec.priority === 'HIGH' ? 'engineer' : 'manager',
        urgency: rec.priority === 'CRITICAL' ? 'now' : rec.priority === 'HIGH' ? 'today' : 'week',
        instruction: rec.action || rec.title,
        reason: rec.description,
        relatedPoints: rec.affected_points || [],
      });
    }
  }

  return actions;
}

// ── 诊断句合成 ──────────────────────────────
function composeSentence(
  points: DiagnosisInput['points'],
  anomalies: DiagnosisInput['anomalies'],
  score: number,
  level: HealthLevel,
): string {
  if (points.length === 0) return '暂无监测数据，无法生成诊断。';

  const totalPoints = points.length;
  const alertCount = points.filter(p => p.alert_level === 'alert').length;
  const warnCount = points.filter(p => p.alert_level === 'warning').length;
  const maxSett = Math.min(...points.map(p => p.total_change));
  const worstPoint = points.find(p => p.total_change === maxSett);

  if (level === 'healthy') {
    return `${totalPoints} 个监测点全部正常，项目整体安全稳定。`;
  }

  if (level === 'danger') {
    const critAnom = anomalies.filter(a => a.severity === 'critical');
    return `${alertCount} 个监测点报警！${worstPoint?.point_id || ''} 累计沉降 ${maxSett.toFixed(1)}mm，` +
      (critAnom.length > 0 ? `检测到 ${critAnom.length} 处严重异常，` : '') +
      '建议立即启动应急预案。';
  }

  // watch 或 warn
  const parts: string[] = [];
  if (alertCount > 0) parts.push(`${alertCount} 个报警`);
  if (warnCount > 0) parts.push(`${warnCount} 个预警`);

  const accelerating = points.filter(p => p.trend_type === 'increasing' && p.trend_slope < -0.3);
  if (accelerating.length > 0) {
    parts.push(`${accelerating.length} 个点沉降加速`);
  }

  const statusStr = parts.join('、');

  if (level === 'warn') {
    return `项目存在风险：${statusStr}。最大沉降 ${worstPoint?.point_id || ''} 达 ${maxSett.toFixed(1)}mm，建议48小时内复测确认。`;
  }

  return `项目基本稳定，需关注：${statusStr}。持续监测中。`;
}

// ── 辅助：健康等级显示 ──────────────────────
export const LEVEL_CONFIG: Record<HealthLevel, { label: string; color: string; bg: string }> = {
  healthy: { label: '健康', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  watch:   { label: '关注', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  warn:    { label: '预警', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  danger:  { label: '危险', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};
