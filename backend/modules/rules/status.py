# -*- coding: utf-8 -*-
"""系统状态聚合的唯一出处。

把沉降、温度、裂缝、工单四个来源收敛成一个“现在到底什么状态”的结论，
封面、总览、指标页、工单页都只读这里下发的字段。
"""

from datetime import datetime
from typing import Any, Dict, Optional

from .common import level_label, max_level


def build_status(
    settlement: Optional[Dict[str, Any]] = None,
    temperature: Optional[Dict[str, Any]] = None,
    cracks: Optional[Dict[str, Any]] = None,
    tickets: Optional[Dict[str, Any]] = None,
    as_of: Optional[str] = None,
) -> Dict[str, Any]:
    settlement = settlement or {}
    temperature = temperature or {}
    cracks = cracks or {}
    tickets = tickets or {}

    settlement_abnormal = int(settlement.get('abnormal_count') or 0)
    temperature_attention = int(temperature.get('abnormal_count') or 0)
    crack_abnormal = int(cracks.get('abnormal_count') or 0)
    pending_tickets = int(tickets.get('pending') or 0)
    overdue_tickets = int(tickets.get('overdue') or 0)

    overall = max_level([
        settlement.get('level'),
        temperature.get('level'),
        cracks.get('level'),
        'alert' if overdue_tickets > 0 else None,
        'warning' if pending_tickets > 0 else None,
    ])

    parts = []
    if settlement_abnormal > 0:
        parts.append(f'{settlement_abnormal} 个沉降点异常')
    if temperature_attention > 0:
        parts.append(f'{temperature_attention} 个温度点需关注')
    if crack_abnormal > 0:
        parts.append(f'{crack_abnormal} 条裂缝超限')
    if pending_tickets > 0:
        parts.append(f'{pending_tickets} 张工单待处理')

    if not parts:
        headline = '各项监测指标正常，无待处理工单。'
    else:
        prefix = '存在报警：' if overall == 'alert' else '存在预警：'
        headline = prefix + '、'.join(parts) + '。'

    return {
        'level': overall,
        'level_cn': level_label(overall),
        'headline': headline,
        'as_of': as_of or datetime.now().isoformat(timespec='seconds'),
        'counts': {
            'settlement_total': int(settlement.get('total_points') or 0),
            'settlement_abnormal': settlement_abnormal,
            'settlement_alert': int(settlement.get('alert_count') or 0),
            'settlement_warning': int(settlement.get('warning_count') or 0),
            'temperature_total': int(temperature.get('total_points') or 0),
            'temperature_attention': temperature_attention,
            'temperature_alert': int(temperature.get('alert_count') or 0),
            'crack_total': int(cracks.get('total_points') or 0),
            'crack_abnormal': crack_abnormal,
            'pending_tickets': pending_tickets,
            'overdue_tickets': overdue_tickets,
            'monitoring_abnormal': settlement_abnormal + temperature_attention + crack_abnormal,
        },
        'max_settlement': settlement.get('max_settlement'),
        'max_settlement_point': settlement.get('max_settlement_point'),
        'sources': {
            'settlement': settlement.get('level'),
            'temperature': temperature.get('level'),
            'cracks': cracks.get('level'),
            'tickets': 'alert' if overdue_tickets else ('warning' if pending_tickets else 'normal'),
        },
    }
