# -*- coding: utf-8 -*-
"""
Agent 认知表达层 — 地质直觉人格
它不观察隧道——它就是隧道的感知系统。
所有面向用户的文本都从预审模板中选择，100%确定性输出。
"""

# === 巡检标题模板（地质直觉人格） ===

PATROL_TEMPLATES = {
    # ---- 稳定态 ----
    'all_normal': '地下稳定',
    'all_normal_improving': '整体趋于稳定，{n}个断面变形正在收敛',

    # ---- 单点异常 ----
    'single_warning': '感知到{point}处轻微扰动（{reason}）',
    'single_critical': '{point}处变形加剧，需要关注（{reason}）',

    # ---- 多点异常 ----
    'multi_warning': '感知到{n}个断面扰动，{point}最为明显',
    'multi_critical': '{n_crit}个断面变形加剧，{n_warn}个需留意',

    # ---- 特殊状态 ----
    'data_missing': '{n}个监测点超过{hours}小时未感知到信号',
    'mixed': '{point}变形加剧；另有{n_missing}个点信号中断',
    'new_anomaly': '{point}开始出现扰动（上次感知时尚属稳定）',
    'resolved': '{point}变形已收敛，地层恢复稳定',
    'worsening': '{point}扰动加剧：速率从{prev}升至{curr}mm/d',
    'unchanged': '{point}扰动持续（态势未变化）',
    'initializing': '感知系统启动中，首次认知将在15分钟内完成',
}

# === 信任锚（持续时态） ===

TRUST_ANCHOR = '正在感知 {checked}/{total} 个点 \u00b7 沉降场{field_status}'
TRUST_ANCHOR_MISSING = '正在感知 {checked}/{total} 个点 \u00b7 {missing}个点信号中断'

# === 原因模板（机理导向） ===

REASON_TEMPLATES = {
    'threshold_exceeded': '累计变形{value}mm，土体承压接近极限',
    'accelerating': '变形持续加速，地层尚未找到新的平衡',
    'not_converging': '变形未见收敛，扰动影响仍在扩展',
    'accel_and_not_converging': '变形加速且未收敛，地层应力持续释放',
    'rate_high': '变形速率{rate}mm/d，地层应力释放加速',
    'data_stale': '超过{hours}小时未感知到信号',
}

# === 建议模板（认知引导） ===

SUGGESTION_TEMPLATES = {
    'critical': '建议24小时内现场确认，注浆加固优先',
    'high': '建议加密监测频率，3天内现场确认',
    'medium': '持续关注，我会跟踪趋势变化',
    'prediction': '趋势接近临界，建议提前准备防控措施',
    'normal': '常规态势，无需额外操作',
    'converging': '措施开始生效，我会持续观察',
}


def select_headline(point_stats, anomalies_by_severity):
    """
    根据巡检结果选择一句话标题（地质直觉人格）。

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


def format_trust_anchor(checked, total, latest_time=None, missing=0):
    """格式化信任锚（持续时态：正在感知）"""
    if missing > 0:
        return TRUST_ANCHOR_MISSING.format(
            checked=checked, total=total, missing=missing)
    # 沉降场状态判定
    field_status = '稳定' if checked == total else '部分可用'
    return TRUST_ANCHOR.format(
        checked=checked, total=total, field_status=field_status)


def build_insight_body(anomaly_item, curve_health=None):
    """
    为单个异常点生成解释文本（机理导向）。

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
    """根据严重程度返回建议文本（认知引导风格）"""
    mapping = {
        'critical': SUGGESTION_TEMPLATES['critical'],
        'high': SUGGESTION_TEMPLATES['high'],
        'medium': SUGGESTION_TEMPLATES['medium'],
        'low': SUGGESTION_TEMPLATES['normal'],
        'normal': SUGGESTION_TEMPLATES['normal'],
    }
    return mapping.get(severity_str, SUGGESTION_TEMPLATES['normal'])
