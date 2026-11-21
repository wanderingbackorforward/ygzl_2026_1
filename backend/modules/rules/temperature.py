# -*- coding: utf-8 -*-
"""温度分级与聚合的唯一出处。

口径：
- 历史分析结论（temperature_analysis.alert_level）优先，保证既有 250+1/251 口径不变；
- 无历史结论时，才用本模块阈值实时判定。
"""

from typing import Any, Dict, Iterable, List, Optional

from .common import LEVEL_LABELS, level_label, max_level, normalize_level

THRESHOLDS = {
    'temp_high_critical': 45.0,
    'temp_high_warning': 38.0,
    'temp_low_critical': -10.0,
    'temp_low_warning': 0.0,
    'daily_range_critical': 25.0,
    'daily_range_warning': 18.0,
    'rate_change_critical': 5.0,
    'rate_change_warning': 3.0,
}


def _to_float(value: Any) -> Optional[float]:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def classify_sensor(
    current_max: Any = None,
    current_min: Any = None,
    current_range: Any = None,
    stored_level: Any = None,
) -> Dict[str, Any]:
    stored = normalize_level(stored_level)
    if stored:
        return {
            'level': stored,
            'level_cn': LEVEL_LABELS[stored],
            'reason': f'历史分析结论：{str(stored_level).strip()}',
        }

    t_max = _to_float(current_max)
    t_min = _to_float(current_min)
    t_range = _to_float(current_range)

    if t_max is None and t_min is None and t_range is None:
        return {'level': None, 'level_cn': '未评估', 'reason': '暂无温度数据'}

    if (t_max is not None and t_max >= THRESHOLDS['temp_high_critical']) or (
        t_min is not None and t_min <= THRESHOLDS['temp_low_critical']
    ) or (t_range is not None and t_range >= THRESHOLDS['daily_range_critical']):
        return {
            'level': 'alert',
            'level_cn': LEVEL_LABELS['alert'],
            'reason': '温度超过严重阈值',
        }

    if (t_max is not None and t_max >= THRESHOLDS['temp_high_warning']) or (
        t_min is not None and t_min <= THRESHOLDS['temp_low_warning']
    ) or (t_range is not None and t_range >= THRESHOLDS['daily_range_warning']):
        return {
            'level': 'warning',
            'level_cn': LEVEL_LABELS['warning'],
            'reason': '温度超过警戒阈值',
        }

    return {
        'level': 'normal',
        'level_cn': LEVEL_LABELS['normal'],
        'reason': '温度在正常范围内',
    }


def enrich_point(row: Dict[str, Any]) -> Dict[str, Any]:
    result = dict(row)
    result.update(
        classify_sensor(
            current_max=row.get('max_temperature', row.get('current_max')),
            current_min=row.get('min_temperature', row.get('current_min')),
            current_range=row.get('avg_daily_range', row.get('current_range')),
            stored_level=row.get('alert_level'),
        )
    )
    return result


def summarize_points(points: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """温度的唯一聚合出口；空分级（未评估）不计入有效点。"""
    counts = {'normal': 0, 'warning': 0, 'alert': 0}
    unknown = 0

    for row in points or []:
        level = normalize_level(row.get('level')) or normalize_level(row.get('alert_level'))
        if level is None:
            unknown += 1
            continue
        counts[level] += 1

    overall = max_level(
        ['alert'] * counts['alert'] + ['warning'] * counts['warning'] + ['normal'] * counts['normal']
    )
    total = counts['normal'] + counts['warning'] + counts['alert']
    return {
        'total_points': total,
        'normal_count': counts['normal'],
        'warning_count': counts['warning'],
        'alert_count': counts['alert'],
        'abnormal_count': counts['warning'] + counts['alert'],
        'unknown_count': unknown,
        'level': overall,
        'level_cn': level_label(overall),
        'distribution': dict(counts),
    }
