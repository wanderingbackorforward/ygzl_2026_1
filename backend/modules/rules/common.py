# -*- coding: utf-8 -*-
"""统一风险分级词表（后端唯一出处）。

Canonical levels: normal / warning / alert
所有接口只下发这三个值，页面不再自行判断中文词或英文词。
"""

from typing import Any, Iterable, Optional

LEVELS = ('normal', 'warning', 'alert')
LEVEL_ORDER = {'normal': 0, 'warning': 1, 'alert': 2}
LEVEL_LABELS = {'normal': '正常', 'warning': '预警', 'alert': '报警'}

_ALERT_TOKENS = {
    'alert', 'critical', 'high', 'severe',
    '报警', '高风险', '危急', '严重', '红色',
}
_WARNING_TOKENS = {
    'warning', 'medium', 'low',
    '预警', '中风险', '低风险', '需关注', '黄色', '橙色',
}
_NORMAL_TOKENS = {
    'normal', 'ok', 'none', 'info', '0',
    '正常', '无', '绿色',
}


def normalize_level(raw: Any) -> Optional[str]:
    """把任意历史写法归一到 normal/warning/alert；无法识别返回 None。"""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    lower = text.lower()
    if lower in _ALERT_TOKENS or text in _ALERT_TOKENS:
        return 'alert'
    if lower in _WARNING_TOKENS or text in _WARNING_TOKENS:
        return 'warning'
    if lower in _NORMAL_TOKENS or text in _NORMAL_TOKENS:
        return 'normal'
    return None


def level_label(level: Optional[str]) -> str:
    return LEVEL_LABELS.get(level or '', '未评估')


def max_level(levels: Iterable[Optional[str]]) -> str:
    """取最严重级别；全部为空时按正常处理。"""
    worst = 'normal'
    for level in levels:
        if level in LEVEL_ORDER and LEVEL_ORDER[level] > LEVEL_ORDER[worst]:
            worst = level
    return worst


def conclusion(level: Optional[str], value: Any, reason: str) -> dict:
    """统一结论字段：level / level_cn / value / reason。"""
    canonical = level if level in LEVEL_ORDER else 'normal'
    return {
        'level': canonical,
        'level_cn': LEVEL_LABELS[canonical],
        'value': value,
        'reason': reason,
    }
