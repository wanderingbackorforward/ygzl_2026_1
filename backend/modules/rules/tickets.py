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
