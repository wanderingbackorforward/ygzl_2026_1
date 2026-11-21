# -*- coding: utf-8 -*-
"""沉降分级与聚合的唯一出处。

口径：
- 历史分析结论（settlement_analysis.alert_level）优先，保证既有 12/25 口径不变；
- 无历史结论时，才用本模块阈值实时判定；
- 聚合只输出一个“最大累计沉降”字段（total_change，负值=沉降）。
"""

from typing import Any, Dict, Iterable, List, Optional

from .common import LEVEL_LABELS, LEVEL_ORDER, level_label, max_level, normalize_level

# 沉降阈值（mm、mm/day）：与既有 /api/summary 判定一致
THRESHOLDS = {
    'cumulative_alert': 5.0,
    'cumulative_warning': 3.0,
    'rate_alert': 0.15,
    'rate_warning': 0.08,
    'rate_notice': 0.03,
    'rate_observe': 0.01,
    'rate_fast': 0.10,
    'prediction_30d_alert': 5.0,
    'prediction_30d_warning': 3.0,
    'prediction_notice': 1.5,
    'prediction_observe': 0.5,
}

# 速率 -> 风险等级/分值，唯一实现（门面查询与预测汇总共用）
_RISK_TIERS = (
    ('rate_alert', 'critical', 90),
    ('rate_warning', 'high', 70),
    ('rate_notice', 'medium', 50),
    ('rate_observe', 'low', 30),
)


def risk_from_rate(slope: Any, thresholds: Optional[Dict[str, float]] = None) -> tuple:
    """按日沉降速率映射 (risk_level, risk_score)，保持既有分档不变。"""
    limits = thresholds or THRESHOLDS
    rate = abs(_to_float(slope) or 0.0)
    for key, level, score in _RISK_TIERS:
        if rate > limits[key]:
            return level, score
    return 'normal', 10


def _to_float(value: Any) -> Optional[float]:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _first_value(row: Dict[str, Any], *keys: str) -> Any:
    """按顺序取第一个非 None 的字段，避免 dict.get 默认值掩盖空值。"""
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


TREND_DOWN_TYPES = {'显著下沉', '持续下沉', '加速下沉', '下沉'}
TREND_UP_TYPES = {'显著隆起', '持续隆起', '加速隆起', '隆起'}
TREND_STABLE_TYPES = {'无显著趋势', '稳定', '温度稳定', '轻微变化'}


def trend_direction(trend_type: Any = None, trend_slope: Any = None) -> str:
    """统一趋势方向：down=下沉，up=隆起，stable=稳定。"""
    text = str(trend_type).strip() if trend_type is not None else ''
    if text in TREND_DOWN_TYPES:
        return 'down'
    if text in TREND_UP_TYPES:
        return 'up'
    if text in TREND_STABLE_TYPES:
        return 'stable'
    slope = _to_float(trend_slope)
    if slope is None:
        return 'stable'
    if slope <= -0.05:
        return 'down'
    if slope >= 0.05:
        return 'up'
    return 'stable'


def classify_point(
    total_change: Any = None,
    trend_slope: Any = None,
    stored_level: Any = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """返回单点结论：level / level_cn / value / reason。"""
    limits = thresholds or THRESHOLDS
    change = _to_float(total_change)
    slope = _to_float(trend_slope)

    stored = normalize_level(stored_level)
    if stored:
        return {
            'level': stored,
            'level_cn': LEVEL_LABELS[stored],
            'value': change,
            'reason': f'历史分析结论：{str(stored_level).strip()}',
        }

    abs_change = abs(change) if change is not None else None
    abs_rate = abs(slope) if slope is not None else None

    if abs_change is None and abs_rate is None:
        return {
            'level': None,
            'level_cn': '未评估',
            'value': None,
            'reason': '缺少累计沉降与速率数据',
        }

    if (abs_change is not None and abs_change >= limits['cumulative_alert']) or (
        abs_rate is not None and abs_rate >= limits['rate_alert']
    ):
        if abs_change is not None and abs_change >= limits['cumulative_alert']:
            reason = f'累计沉降 {change:.2f} mm，超过报警阈值 {limits["cumulative_alert"]:.2f} mm'
        else:
            reason = f'日沉降速率 {slope:.4f} mm/d，超过报警阈值 {limits["rate_alert"]:.2f} mm/d'
        return {'level': 'alert', 'level_cn': LEVEL_LABELS['alert'], 'value': change, 'reason': reason}

    if (abs_change is not None and abs_change >= limits['cumulative_warning']) or (
        abs_rate is not None and abs_rate >= limits['rate_warning']
    ):
        if abs_change is not None and abs_change >= limits['cumulative_warning']:
            reason = f'累计沉降 {change:.2f} mm，超过预警阈值 {limits["cumulative_warning"]:.2f} mm'
        else:
            reason = f'日沉降速率 {slope:.4f} mm/d，超过预警阈值 {limits["rate_warning"]:.2f} mm/d'
        return {'level': 'warning', 'level_cn': LEVEL_LABELS['warning'], 'value': change, 'reason': reason}

    if change is None:
        reason = f'日沉降速率 {slope:.4f} mm/d，未超过预警阈值 {limits["rate_warning"]:.2f} mm/d'
    else:
        reason = f'累计沉降 {change:.2f} mm，未超过预警阈值 {limits["cumulative_warning"]:.2f} mm'
    return {'level': 'normal', 'level_cn': LEVEL_LABELS['normal'], 'value': change, 'reason': reason}


def enrich_point(row: Dict[str, Any]) -> Dict[str, Any]:
    """给 /api/summary 的单点补 level / level_cn / reason，原字段保持不变。"""
    result = dict(row)
    info = classify_point(
        total_change=_first_value(row, 'total_change', 'cumulative_change'),
        trend_slope=_first_value(row, 'trend_slope', 'avg_daily_rate'),
        stored_level=row.get('alert_level'),
    )
    result.update(info)
    result['trend'] = trend_direction(
        row.get('trend_type'),
        _first_value(row, 'trend_slope', 'avg_daily_rate'),
    )
    return result


def summarize_points(points: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """沉降的唯一聚合出口。"""
    rows: List[Dict[str, Any]] = list(points or [])
    counts = {'normal': 0, 'warning': 0, 'alert': 0}
    unknown = 0
    values: List[Dict[str, Any]] = []

    for row in rows:
        level = normalize_level(row.get('level')) or normalize_level(row.get('alert_level'))
        if level is None:
            unknown += 1
            continue
        counts[level] += 1
        change = _to_float(_first_value(row, 'total_change', 'cumulative_change'))
        if change is not None:
            values.append({'point_id': row.get('point_id'), 'total_change': change})

    max_point = min(values, key=lambda item: item['total_change']) if values else None
    overall = max_level(
        ['alert'] * counts['alert'] + ['warning'] * counts['warning'] + ['normal'] * counts['normal']
    )
    return {
        'total_points': counts['normal'] + counts['warning'] + counts['alert'],
        'normal_count': counts['normal'],
        'warning_count': counts['warning'],
        'alert_count': counts['alert'],
        'abnormal_count': counts['warning'] + counts['alert'],
        'unknown_count': unknown,
        'max_settlement': round(max_point['total_change'], 2) if max_point else None,
        'max_settlement_point': max_point['point_id'] if max_point else None,
        'level': overall,
        'level_cn': level_label(overall),
        'distribution': dict(counts),
    }
