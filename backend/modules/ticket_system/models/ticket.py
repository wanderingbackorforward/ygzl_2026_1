"""
工单数据模型
定义工单相关的数据库表结构和操作
"""

import datetime
from typing import Dict, List, Optional, Any
import json

from modules.db.vendor import get_repo
from ..config import (
    TICKET_TYPES, TICKET_STATUS, TICKET_PRIORITY,
    generate_ticket_number, calculate_sla, get_priority
)


class TicketModel:
    """工单数据模型"""

    def __init__(self):
        self.table_name = "tickets"
        pass

    def _ensure_table_exists(self):
        return

    def create_ticket(self, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # 生成工单编号
            ticket_number = generate_ticket_number()

            # 计算SLA截止时间
            sla_hours = calculate_sla(
                ticket_data.get('ticket_type'),
                ticket_data.get('priority', 'MEDIUM')
            )

            due_at = None
            if sla_hours:
                due_at = (datetime.datetime.now() + datetime.timedelta(hours=sla_hours)).isoformat()

            # 准备插入数据
            insert_data = {
                'ticket_number': ticket_number,
                'title': ticket_data.get('title', ''),
                'description': ticket_data.get('description', ''),
                'ticket_type': ticket_data.get('ticket_type'),
                'sub_type': ticket_data.get('sub_type'),
                'priority': ticket_data.get('priority', 'MEDIUM'),
                'status': ticket_data.get('status', 'PENDING'),
                'creator_id': ticket_data.get('creator_id'),
                'creator_name': ticket_data.get('creator_name'),
                'assignee_id': ticket_data.get('assignee_id'),
                'assignee_name': ticket_data.get('assignee_name'),
                'monitoring_point_id': ticket_data.get('monitoring_point_id'),
                'location_info': ticket_data.get('location_info'),
                'equipment_id': ticket_data.get('equipment_id'),
                'threshold_value': ticket_data.get('threshold_value'),
                'current_value': ticket_data.get('current_value'),
                'alert_data': ticket_data.get('alert_data', {}),
                'due_at': due_at,
                'attachment_paths': ticket_data.get('attachment_paths', []),
                'metadata': ticket_data.get('metadata', {})
            }
            repo = get_repo()
            created = repo.ticket_create(insert_data)
            return created

        except Exception as e:
            print(f"创建工单失败: {e}")
            raise

    def get_tickets(self, filters: Optional[Dict[str, Any]] = None,
                   limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            repo = get_repo()
            tickets = repo.tickets_get(filters or {}, limit, offset)
            return tickets

        except Exception as e:
            print(f"获取工单列表失败: {e}")
            return []

    def get_ticket_by_id(self, ticket_id: int) -> Optional[Dict[str, Any]]:
        try:
            repo = get_repo()
            ticket = repo.ticket_get_by_id(ticket_id)
            return ticket

        except Exception as e:
            print(f"获取工单详情失败: {e}")
            return None

    def get_ticket_by_number(self, ticket_number: str) -> Optional[Dict[str, Any]]:
        try:
            repo = get_repo()
            ticket = repo.ticket_get_by_number(ticket_number)
            return ticket

        except Exception as e:
            print(f"获取工单详情失败: {e}")
            return None

    def update_ticket(self, ticket_id: int, update_data: Dict[str, Any]) -> bool:
        try:
            if 'alert_data' in update_data:
                pass
            if 'attachment_paths' in update_data:
                pass
            if 'metadata' in update_data:
                pass
            repo = get_repo()
            updated = repo.ticket_update(ticket_id, update_data)
            return bool(updated)

        except Exception as e:
            print(f" 更新工单失败: {e}")
            return False

    def update_ticket_status(self, ticket_id: int, new_status: str,
                           user_id: str, comment: Optional[str] = None) -> bool:
        try:
            update_data = {
                'status': new_status,
                'updated_at': datetime.datetime.now().isoformat()
            }

            # 根据状态设置相应的时间字段
            if new_status == 'RESOLVED':
                update_data['resolved_at'] = datetime.datetime.now().isoformat()
            elif new_status == 'CLOSED':
                update_data['closed_at'] = datetime.datetime.now().isoformat()

            # 添加评论到元数据
            ticket = self.get_ticket_by_id(ticket_id)
            if ticket:
                metadata = ticket.get('metadata', {})
                if 'status_history' not in metadata:
                    metadata['status_history'] = []

                status_change = {
                    'from_status': ticket['status'],
                    'to_status': new_status,
                    'changed_by': user_id,
                    'changed_at': datetime.datetime.now().isoformat(),
                    'comment': comment
                }
                metadata['status_history'].append(status_change)
                update_data['metadata'] = metadata

            return self.update_ticket(ticket_id, update_data)

        except Exception as e:
            print(f" 更新工单状态失败: {e}")
            return False

    def assign_ticket(self, ticket_id: int, assignee_id: str,
                     assignee_name: str) -> bool:
        try:
            update_data = {
                'assignee_id': assignee_id,
                'assignee_name': assignee_name,
                'status': 'IN_PROGRESS',
                'updated_at': datetime.datetime.now().isoformat()
            }

            return self.update_ticket(ticket_id, update_data)

        except Exception as e:
            print(f" 分配工单失败: {e}")
            return False

    def get_ticket_statistics(self) -> Dict[str, Any]:
        try:
            repo = get_repo()
            stats = repo.tickets_statistics()
            return stats

        except Exception as e:
            print(f" 获取工单统计失败: {e}")
            return {}

    def delete_ticket(self, ticket_id: int) -> bool:
        try:
            repo = get_repo()
            ok = repo.ticket_delete(ticket_id)
            return ok

        except Exception as e:
            print(f" 删除工单失败: {e}")
            return False
