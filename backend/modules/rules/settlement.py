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
}


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


def classify_point(
    total_change: Any = None,
    trend_slope: Any = None,
    stored_level: Any = None,
) -> Dict[str, Any]:
    """返回单点结论：level / level_cn / value / reason。"""
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

    if (abs_change is not None and abs_change >= THRESHOLDS['cumulative_alert']) or (
        abs_rate is not None and abs_rate >= THRESHOLDS['rate_alert']
    ):
        if abs_change is not None and abs_change >= THRESHOLDS['cumulative_alert']:
            reason = f'累计沉降 {change:.2f} mm，超过报警阈值 {THRESHOLDS["cumulative_alert"]:.2f} mm'
        else:
            reason = f'日沉降速率 {slope:.4f} mm/d，超过报警阈值 {THRESHOLDS["rate_alert"]:.2f} mm/d'
        return {'level': 'alert', 'level_cn': LEVEL_LABELS['alert'], 'value': change, 'reason': reason}

    if (abs_change is not None and abs_change >= THRESHOLDS['cumulative_warning']) or (
        abs_rate is not None and abs_rate >= THRESHOLDS['rate_warning']
    ):
        if abs_change is not None and abs_change >= THRESHOLDS['cumulative_warning']:
            reason = f'累计沉降 {change:.2f} mm，超过预警阈值 {THRESHOLDS["cumulative_warning"]:.2f} mm'
        else:
            reason = f'日沉降速率 {slope:.4f} mm/d，超过预警阈值 {THRESHOLDS["rate_warning"]:.2f} mm/d'
        return {'level': 'warning', 'level_cn': LEVEL_LABELS['warning'], 'value': change, 'reason': reason}

    if change is None:
        reason = f'日沉降速率 {slope:.4f} mm/d，未超过预警阈值 {THRESHOLDS["rate_warning"]:.2f} mm/d'
    else:
        reason = f'累计沉降 {change:.2f} mm，未超过预警阈值 {THRESHOLDS["cumulative_warning"]:.2f} mm'
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
