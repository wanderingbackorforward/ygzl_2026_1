# -*- coding: utf-8 -*-
"""工单状态与逾期的唯一出处。

口径：
- 未解决 = PENDING / IN_PROGRESS / SUSPENDED；
- 逾期 = 未解决、未归档，且已过 due_at（SLA 截止时间）；
- 状态接口、工单统计、逾期列表都只调用本模块，不再各算一遍。
"""

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

UNRESOLVED_STATUSES = ('PENDING', 'IN_PROGRESS', 'SUSPENDED')
CLOSED_STATUSES = ('CLOSED', 'RESOLVED', 'REJECTED')


def _status(ticket: Dict[str, Any]) -> str:
    return str(ticket.get('status') or '').strip().upper()


def parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    text = text.replace('Z', '+00:00')
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        try:
            return datetime.fromisoformat(text.split('.')[0])
        except ValueError:
            return None


def _comparable(value: datetime, now: datetime):
    """把 aware / naive 统一到同一基准，避免直接比较抛 TypeError。"""
    if value.tzinfo is not None and now.tzinfo is None:
        return value.replace(tzinfo=None), now
    if value.tzinfo is None and now.tzinfo is not None:
        return value, now.replace(tzinfo=None)
    return value, now


def is_unresolved(ticket: Dict[str, Any]) -> bool:
    return _status(ticket) in UNRESOLVED_STATUSES


def is_overdue(ticket: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    if not is_unresolved(ticket):
        return False
    if ticket.get('is_archived'):
        return False
    due_at = parse_datetime(ticket.get('due_at'))
    if due_at is None:
        return False
    due_at, now = _comparable(due_at, now or datetime.now())
    return due_at < now


def overdue_days(ticket: Dict[str, Any], now: Optional[datetime] = None) -> Optional[int]:
    due_at = parse_datetime(ticket.get('due_at'))
    if due_at is None:
        return None
    due_at, now = _comparable(due_at, now or datetime.now())
    return max(0, int((now - due_at).total_seconds() // 86400))


def summarize(tickets: Iterable[Dict[str, Any]], now: Optional[datetime] = None) -> Dict[str, Any]:
    """工单的唯一聚合出口：总数、待处理、未解决、逾期。"""
    now = now or datetime.now()
    rows: List[Dict[str, Any]] = list(tickets or [])
    pending = unresolved = overdue = 0
    for ticket in rows:
        status = _status(ticket)
        if status == 'PENDING':
            pending += 1
        if is_unresolved(ticket):
            unresolved += 1
        if is_overdue(ticket, now):
            overdue += 1
    return {
        'total': len(rows),
        'pending': pending,
        'unresolved': unresolved,
        'overdue': overdue,
    }


# ============================================================
# 建单口径（唯一出处）：类型 / 优先级 / 子类型 / 默认处理人
# ============================================================

SEVERITY_TO_PRIORITY = {
    'critical': 'CRITICAL',
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW',
    'normal': 'LOW',
}

TICKET_TYPE_BY_DATA_TYPE = {
    'settlement': 'SETTLEMENT_ALERT',
    'temperature': 'TEMPERATURE_ALERT',
    'crack': 'CRACK_ALERT',
}

ANOMALY_SUBTYPES = {
    'settlement': {
        'threshold_exceeded': '沉降量超限',
        'rate_abnormal': '沉降速率异常',
        'trend_abnormal': '差异沉降过大',
        'prediction_warning': '监测点数据异常',
    },
    'temperature': {
        'threshold_exceeded': '温度超限',
        'rate_abnormal': '温度变化率异常',
        'trend_abnormal': '温度趋势异常',
        'temperature_range_abnormal': '日温差异常',
    },
}

DEFAULT_SUBTYPES = {
    'settlement': '监测点数据异常',
    'temperature': '温度监测异常',
}

# 自动建单的默认处理人；与 ticket_system.config.AUTO_ASSIGN_RULES 保持一致
DEFAULT_ASSIGNEES = {
    'SETTLEMENT_ALERT': 'monitoring_engineer',
    'TEMPERATURE_ALERT': 'monitoring_engineer',
    'CRACK_ALERT': 'monitoring_engineer',
    'EQUIPMENT_FAULT': 'field_technician',
}


def severity_to_priority(severity: Any, default: str = 'MEDIUM') -> str:
    return SEVERITY_TO_PRIORITY.get(str(severity or '').strip().lower(), default)


def ticket_type_for_data_type(data_type: Any) -> Optional[str]:
    return TICKET_TYPE_BY_DATA_TYPE.get(str(data_type or '').strip().lower())


def anomaly_subtype(data_type: Any, anomaly_type: Any) -> Optional[str]:
    key = str(data_type or '').strip().lower()
    mapping = ANOMALY_SUBTYPES.get(key)
    if mapping is None:
        return None
    return mapping.get(str(anomaly_type or '').strip(), DEFAULT_SUBTYPES.get(key))


def default_assignee(ticket_type: Optional[str]) -> Optional[str]:
    return DEFAULT_ASSIGNEES.get(str(ticket_type or '').strip().upper())


def resolve_creation_fields(payload: Dict[str, Any]) -> Dict[str, Any]:
    """把前端提交的原始语义（data_type / severity / anomaly_type）解析成入库字段。

    显式传入的 ticket_type / priority / sub_type 优先，不做覆盖。
    """
    data = payload or {}
    sub_type = data.get('sub_type')
    if not sub_type:
        sub_type = anomaly_subtype(data.get('data_type'), data.get('anomaly_type'))
    return {
        'ticket_type': data.get('ticket_type') or ticket_type_for_data_type(data.get('data_type')),
        'priority': data.get('priority') or severity_to_priority(data.get('severity'), 'MEDIUM'),
        'sub_type': sub_type,
    }


def priority_from_risk_score(score: Any) -> str:
    value = float(score or 0)
    if value >= 85:
        return 'CRITICAL'
    if value >= 70:
        return 'HIGH'
    if value >= 50:
        return 'MEDIUM'
    return 'LOW'


def subtype_from_settlement_metrics(max_abs_current_value: Any, max_abs_change_rate: Any) -> str:
    if max_abs_current_value is not None and max_abs_current_value >= 10:
        return '沉降量超限'
    if max_abs_change_rate is not None and max_abs_change_rate >= 1:
        return '沉降速率异常'
    return '监测点数据异常'


# ============================================================
# 状态机（唯一出处）：从哪个状态可以改到哪个状态、谁有权改
# ============================================================

STATUS_FLOW = {
    'PENDING': ['IN_PROGRESS', 'REJECTED'],
    'IN_PROGRESS': ['SUSPENDED', 'RESOLVED'],
    'SUSPENDED': ['IN_PROGRESS'],
    'RESOLVED': ['CLOSED', 'IN_PROGRESS'],
    'CLOSED': [],
    'REJECTED': [],
}

TRANSITION_ROLES = {
    'PENDING -> IN_PROGRESS': ['admin', 'monitoring_engineer', 'field_technician'],
    'PENDING -> REJECTED': ['admin', 'monitoring_engineer'],
    'IN_PROGRESS -> SUSPENDED': ['field_technician', 'admin'],
    'IN_PROGRESS -> RESOLVED': ['field_technician', 'admin', 'monitoring_engineer'],
    'SUSPENDED -> IN_PROGRESS': ['field_technician', 'admin'],
    'RESOLVED -> CLOSED': ['creator', 'admin', 'monitoring_engineer'],
    'RESOLVED -> IN_PROGRESS': ['creator', 'admin', 'monitoring_engineer'],
}


def transition_targets(status: Any) -> List[str]:
    """状态机允许的下一状态（不看角色），用于展示配置。"""
    return list(STATUS_FLOW.get(str(status or '').strip().upper(), []))


def allowed_transitions(status: Any, user_role: Any = 'admin') -> List[str]:
    """当前角色实际可执行的下一状态，前端按钮直接消费。"""
    current = str(status or '').strip().upper()
    role = str(user_role or '').strip().lower()
    return [
        target for target in transition_targets(current)
        if role == 'admin' or role in TRANSITION_ROLES.get(f'{current} -> {target}', [])
    ]


def collect_overdue(tickets: Iterable[Dict[str, Any]], now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """逾期工单列表，按超期天数从大到小排序。"""
    now = now or datetime.now()
    rows = []
    for ticket in tickets or []:
        if not is_overdue(ticket, now):
            continue
        rows.append({
            'id': ticket.get('id'),
            'ticket_number': ticket.get('ticket_number'),
            'title': ticket.get('title'),
            'status': ticket.get('status'),
            'priority': ticket.get('priority'),
            'assignee_name': ticket.get('assignee_name'),
            'created_at': ticket.get('created_at'),
            'due_at': ticket.get('due_at'),
            'age_days': overdue_days(ticket, now),
        })
    rows.sort(key=lambda x: (x.get('age_days') is None, -(x.get('age_days') or 0), str(x.get('created_at') or '')))
    return rows
