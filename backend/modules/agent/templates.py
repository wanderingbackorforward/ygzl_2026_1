# -*- coding: utf-8 -*-
"""
Agent 一句话模板体系
所有面向用户的文本都从预审模板中选择，100%确定性输出。
"""

# === 巡检一句话模板 ===

PATROL_TEMPLATES = {
    'all_normal': '所有监测点状态正常',
    'all_normal_improving': '整体趋势向好，{n}个点沉降趋于收敛',
    'single_warning': '{point} 需要关注（{reason}）',
    'single_critical': '{point} 需要立即处理（{reason}）',
    'multi_warning': '{n}个监测点需要关注，其中 {point} 最为突出',
    'multi_critical': '{n_crit}个红色预警 + {n_warn}个黄色关注',
    'data_missing': '{n}个监测点超过{hours}小时未上传数据',
    'mixed': '{point} 需要处理；另有{n_missing}个点数据缺失',
    'new_anomaly': '新发现：{point} 沉降加速（上次巡检时正常）',
    'resolved': '{point} 已恢复正常',
    'worsening': '{point} 情况恶化：速率从{prev}升至{curr}mm/d',
    'unchanged': '{point} 仍需关注（状态未变化）',
    'initializing': '巡检服务已启动，首次分析将在15分钟内完成',
}

TRUST_ANCHOR = '已检查 {checked}/{total} 个点 \u00b7 数据截至 {latest_time}'
TRUST_ANCHOR_MISSING = '已检查 {checked}/{total} 个点 \u00b7 {missing}个点数据缺失'

# === 原因模板 ===

REASON_TEMPLATES = {
    'threshold_exceeded': '累计沉降{value}mm，超过预警值{threshold}mm',
    'accelerating': '沉降速率加快，近期加速度{accel}',
    'not_converging': '沉降未见收敛趋势，持续下沉中',
    'accel_and_not_converging': '沉降加速且未见收敛，需重点关注',
    'rate_high': '日沉降速率{rate}mm/d，超过阈值{threshold}mm/d',
    'data_stale': '超过{hours}小时未收到新数据',
}

# === 建议模板 ===

SUGGESTION_TEMPLATES = {
    'critical': '建议24小时内现场巡查，检查该点位及周边结构安全',
    'high': '建议加密该点位监测频率，3天内安排现场确认',
    'medium': '建议持续关注，维持当前监测频率',
    'prediction': '预测值接近预警线，建议提前准备防控措施',
    'normal': '维持常规监测即可',
}


def select_headline(point_stats, anomalies_by_severity):
    """
    根据巡检结果选择一句话标题。

    Args:
        point_stats: list of {point_id, alert_level, ...}
        anomalies_by_severity: {critical: [...], warning: [...]}

    Returns:
        str: 一句话标题
    """
    n_crit = len(anomalies_by_severity.get('critical', []))
    n_warn = len(anomalies_by_severity.get('warning', []))
    total_anomalies = n_crit + n_warn

    if total_anomalies == 0:
        converging = [p for p in point_stats
                      if p.get('curve_health', {}).get('converging')]
        if len(converging) > len(point_stats) * 0.3:
            return PATROL_TEMPLATES['all_normal_improving'].format(
                n=len(converging))
        return PATROL_TEMPLATES['all_normal']

    if n_crit > 0 and n_warn > 0:
        return PATROL_TEMPLATES['multi_critical'].format(
            n_crit=n_crit, n_warn=n_warn)

    if total_anomalies == 1:
        items = (anomalies_by_severity.get('critical', [])
                 + anomalies_by_severity.get('warning', []))
        item = items[0]
        tpl_key = 'single_critical' if n_crit else 'single_warning'
        reason = item.get('reason_short', item.get('description', ''))
        return PATROL_TEMPLATES[tpl_key].format(
            point=item.get('point_id', '?'), reason=reason)

    # 多个同级别
    items = (anomalies_by_severity.get('critical', [])
             + anomalies_by_severity.get('warning', []))
    worst = items[0]
    return PATROL_TEMPLATES['multi_warning'].format(
        n=total_anomalies, point=worst.get('point_id', '?'))


def format_trust_anchor(checked, total, latest_time, missing=0):
    """格式化信任锚"""
    if missing > 0:
        return TRUST_ANCHOR_MISSING.format(
            checked=checked, total=total, missing=missing)
    return TRUST_ANCHOR.format(
        checked=checked, total=total, latest_time=latest_time)


def build_insight_body(anomaly_item, curve_health=None):
    """
    为单个异常点生成解释文本。

    Args:
        anomaly_item: AnomalyItem.to_dict() 结果
        curve_health: curve_health 分析结果（可选）

    Returns:
        str: 一段话解释
    """
    parts = []

    # 已有分析引擎的描述
    desc = anomaly_item.get('description', '')
    if desc:
        parts.append(desc)

    # 叠加形态分析
    if curve_health:
        health_desc = curve_health.get('description', '')
        if health_desc and health_desc not in desc:
            parts.append(health_desc)

    return '。'.join(parts) + '。' if parts else ''


def get_suggestion(severity_str):
    """根据严重程度返回建议文本"""
    mapping = {
        'critical': SUGGESTION_TEMPLATES['critical'],
        'high': SUGGESTION_TEMPLATES['high'],
        'medium': SUGGESTION_TEMPLATES['medium'],
        'low': SUGGESTION_TEMPLATES['normal'],
        'normal': SUGGESTION_TEMPLATES['normal'],
    }
    return mapping.get(severity_str, SUGGESTION_TEMPLATES['normal'])
