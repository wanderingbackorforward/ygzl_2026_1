# -*- coding: utf-8 -*-
"""裂缝分级与聚合的唯一出处。

分级依据 GB 50292-2015（与前端 gb50292.ts 同一阈值）：
- A 级 完好：宽度 <= 0.05 mm
- B 级 轻微：<= 0.20 mm
- C 级 明显：<= 1.00 mm
- D 级 严重：> 1.00 mm

口径：
- 宽度取监测点最终值（last_value）；
- 超限 = C / D 级；
- 只有 A/B 级为正常，C 级预警，D 级报警。
"""

from typing import Any, Dict, Iterable, List, Optional

from .common import LEVEL_LABELS, level_label

GRADE_MAX = {'a': 0.05, 'b': 0.20, 'c': 1.00}
GRADE_ORDER = ('a', 'b', 'c', 'd')
GRADE_LEVEL = {'a': 'normal', 'b': 'normal', 'c': 'warning', 'd': 'alert'}
GRADE_LABELS = {'a': 'A级 完好', 'b': 'B级 轻微', 'c': 'C级 明显', 'd': 'D级 严重'}


def _to_float(value: Any) -> Optional[float]:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def classify_width(width_mm: Any) -> Optional[str]:
    """按 GB 50292 返回 a/b/c/d；宽度缺失返回 None。"""
    width = _to_float(width_mm)
    if width is None:
        return None
    if width <= GRADE_MAX['a']:
        return 'a'
    if width <= GRADE_MAX['b']:
        return 'b'
    if width <= GRADE_MAX['c']:
        return 'c'
    return 'd'


def enrich_point(point: Dict[str, Any]) -> Dict[str, Any]:
    """给单点补 grade / level / level_cn / reason，原字段保持不变。"""
    width = _to_float(point.get('last_value'))
    grade = classify_width(width)
    result = dict(point)
    result['width_mm'] = width
    result['grade'] = grade
    if grade is None:
        result.update({
            'level': None,
            'level_cn': '未评估',
            'reason': '缺少裂缝宽度数据',
        })
        return result
    level = GRADE_LEVEL[grade]
    result.update({
        'level': level,
        'level_cn': LEVEL_LABELS[level],
        'reason': f'裂缝宽度 {width:.2f} mm，GB 50292 {GRADE_LABELS[grade]}',
    })
    return result


def summarize_points(points: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """裂缝的唯一聚合出口。"""
    rows: List[Dict[str, Any]] = [enrich_point(p) for p in (points or [])]
    grades = {grade: 0 for grade in GRADE_ORDER}
    unknown = 0
    expanding = 0
    stable = 0
    widest: Optional[Dict[str, Any]] = None

    for row in rows:
        grade = row.get('grade')
        if grade is None:
            unknown += 1
        else:
            grades[grade] += 1
        change_type = str(row.get('change_type') or '').strip()
        if change_type == '扩展':
            expanding += 1
        elif change_type == '稳定':
            stable += 1
        width = row.get('width_mm')
        if width is not None and (widest is None or width > widest['width_mm']):
            widest = {'point_id': row.get('point_id'), 'width_mm': width}

    abnormal = grades['c'] + grades['d']
    if grades['d']:
        overall = 'alert'
    elif grades['c']:
        overall = 'warning'
    else:
        overall = 'normal'

    return {
        'total_points': len(rows),
        'abnormal_count': abnormal,
        'unknown_count': unknown,
        'grade_distribution': dict(grades),
        'expanding_count': expanding,
        'stable_count': stable,
        'max_width': round(widest['width_mm'], 2) if widest else None,
        'max_width_point': widest['point_id'] if widest else None,
        'level': overall,
        'level_cn': level_label(overall),
    }
