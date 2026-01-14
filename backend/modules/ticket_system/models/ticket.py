"""
工单数据模型
定义工单相关的数据库表结构和操作
"""

import datetime
from typing import Dict, List, Optional, Any
import json

from ...database.db_config import get_db_connection
from ..config import (
    TICKET_TYPES, TICKET_STATUS, TICKET_PRIORITY,
    generate_ticket_number, calculate_sla, get_priority
)


class TicketModel:
    """工单数据模型"""

    def __init__(self):
        self.table_name = "tickets"
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        """确保工单表存在"""
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {self.table_name} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_number VARCHAR(50) UNIQUE NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            ticket_type VARCHAR(50) NOT NULL,
            sub_type VARCHAR(100),
            priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            creator_id VARCHAR(50),
            creator_name VARCHAR(100),
            assignee_id VARCHAR(50),
            assignee_name VARCHAR(100),
            monitoring_point_id VARCHAR(50),
            location_info TEXT,
            equipment_id VARCHAR(50),
            threshold_value DECIMAL(10,3),
            current_value DECIMAL(10,3),
            alert_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            due_at TIMESTAMP NULL,
            resolved_at TIMESTAMP NULL,
            closed_at TIMESTAMP NULL,
            resolution TEXT,
            rejection_reason TEXT,
            attachment_paths JSON,
            metadata JSON,
            INDEX idx_ticket_number (ticket_number),
            INDEX idx_status (status),
            INDEX idx_type (ticket_type),
            INDEX idx_priority (priority),
            INDEX idx_creator (creator_id),
            INDEX idx_assignee (assignee_id),
            INDEX idx_created_at (created_at),
            INDEX idx_monitoring_point (monitoring_point_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(create_table_sql)
                conn.commit()
                print(f"工单表 {self.table_name} 创建成功或已存在")
        except Exception as e:
            print(f"创建工单表失败: {e}")
            raise

    def create_ticket(self, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建新工单"""
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
                due_at = datetime.datetime.now() + datetime.timedelta(hours=sla_hours)

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
                'alert_data': json.dumps(ticket_data.get('alert_data', {})),
                'due_at': due_at,
                'attachment_paths': json.dumps(ticket_data.get('attachment_paths', [])),
                'metadata': json.dumps(ticket_data.get('metadata', {}))
            }

            # 构建SQL语句
            columns = list(insert_data.keys())
            placeholders = ', '.join(['%s'] * len(columns))
            values = list(insert_data.values())

            sql = f"""
            INSERT INTO {self.table_name} ({', '.join(columns)})
            VALUES ({placeholders})
            """

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, values)
                ticket_id = cursor.lastrowid
                conn.commit()

            # 返回创建的工单信息
            result = insert_data.copy()
            result['id'] = ticket_id
            result['created_at'] = datetime.datetime.now()

            print(f"工单创建成功: {ticket_number}")
            return result

        except Exception as e:
            print(f"创建工单失败: {e}")
            raise

    def get_tickets(self, filters: Optional[Dict[str, Any]] = None,
                   limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """获取工单列表"""
        try:
            where_conditions = []
            params = []

            if filters:
                if 'status' in filters:
                    where_conditions.append("status = %s")
                    params.append(filters['status'])

                if 'ticket_type' in filters:
                    where_conditions.append("ticket_type = %s")
                    params.append(filters['ticket_type'])

                if 'priority' in filters:
                    where_conditions.append("priority = %s")
                    params.append(filters['priority'])

                if 'creator_id' in filters:
                    where_conditions.append("creator_id = %s")
                    params.append(filters['creator_id'])

                if 'assignee_id' in filters:
                    where_conditions.append("assignee_id = %s")
                    params.append(filters['assignee_id'])

                if 'monitoring_point_id' in filters:
                    where_conditions.append("monitoring_point_id = %s")
                    params.append(filters['monitoring_point_id'])

                if 'search_keyword' in filters:
                    where_conditions.append("(title LIKE %s OR description LIKE %s)")
                    keyword = f"%{filters['search_keyword']}%"
                    params.extend([keyword, keyword])

            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""

            sql = f"""
            SELECT * FROM {self.table_name}
            {where_clause}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """

            params.extend([limit, offset])

            with get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                tickets = cursor.fetchall()

            # 处理JSON字段
            for ticket in tickets:
                if ticket.get('alert_data'):
                    ticket['alert_data'] = json.loads(ticket['alert_data'])
                if ticket.get('attachment_paths'):
                    ticket['attachment_paths'] = json.loads(ticket['attachment_paths'])
                if ticket.get('metadata'):
                    ticket['metadata'] = json.loads(ticket['metadata'])

            return tickets

        except Exception as e:
            print(f"获取工单列表失败: {e}")
            return []

    def get_ticket_by_id(self, ticket_id: int) -> Optional[Dict[str, Any]]:
        """根据ID获取工单详情"""
        try:
            sql = f"SELECT * FROM {self.table_name} WHERE id = %s"

            with get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, (ticket_id,))
                ticket = cursor.fetchone()

            if ticket:
                # 处理JSON字段
                if ticket.get('alert_data'):
                    ticket['alert_data'] = json.loads(ticket['alert_data'])
                if ticket.get('attachment_paths'):
                    ticket['attachment_paths'] = json.loads(ticket['attachment_paths'])
                if ticket.get('metadata'):
                    ticket['metadata'] = json.loads(ticket['metadata'])

            return ticket

        except Exception as e:
            print(f"获取工单详情失败: {e}")
            return None

    def get_ticket_by_number(self, ticket_number: str) -> Optional[Dict[str, Any]]:
        """根据工单编号获取工单详情"""
        try:
            sql = f"SELECT * FROM {self.table_name} WHERE ticket_number = %s"

            with get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, (ticket_number,))
                ticket = cursor.fetchone()

            if ticket:
                # 处理JSON字段
                if ticket.get('alert_data'):
                    ticket['alert_data'] = json.loads(ticket['alert_data'])
                if ticket.get('attachment_paths'):
                    ticket['attachment_paths'] = json.loads(ticket['attachment_paths'])
                if ticket.get('metadata'):
                    ticket['metadata'] = json.loads(ticket['metadata'])

            return ticket

        except Exception as e:
            print(f"获取工单详情失败: {e}")
            return None

    def update_ticket(self, ticket_id: int, update_data: Dict[str, Any]) -> bool:
        """更新工单信息"""
        try:
            # 处理JSON字段
            if 'alert_data' in update_data:
                update_data['alert_data'] = json.dumps(update_data['alert_data'])
            if 'attachment_paths' in update_data:
                update_data['attachment_paths'] = json.dumps(update_data['attachment_paths'])
            if 'metadata' in update_data:
                update_data['metadata'] = json.dumps(update_data['metadata'])

            # 构建SET语句
            set_clauses = []
            params = []

            for key, value in update_data.items():
                set_clauses.append(f"{key} = %s")
                params.append(value)

            params.append(ticket_id)

            sql = f"""
            UPDATE {self.table_name}
            SET {', '.join(set_clauses)}
            WHERE id = %s
            """

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                conn.commit()

            print(f" 工单更新成功: ID {ticket_id}")
            return True

        except Exception as e:
            print(f" 更新工单失败: {e}")
            return False

    def update_ticket_status(self, ticket_id: int, new_status: str,
                           user_id: str, comment: Optional[str] = None) -> bool:
        """更新工单状态"""
        try:
            update_data = {
                'status': new_status,
                'updated_at': datetime.datetime.now()
            }

            # 根据状态设置相应的时间字段
            if new_status == 'RESOLVED':
                update_data['resolved_at'] = datetime.datetime.now()
            elif new_status == 'CLOSED':
                update_data['closed_at'] = datetime.datetime.now()

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
        """分配工单"""
        try:
            update_data = {
                'assignee_id': assignee_id,
                'assignee_name': assignee_name,
                'status': 'IN_PROGRESS',
                'updated_at': datetime.datetime.now()
            }

            return self.update_ticket(ticket_id, update_data)

        except Exception as e:
            print(f" 分配工单失败: {e}")
            return False

    def get_ticket_statistics(self) -> Dict[str, Any]:
        """获取工单统计信息"""
        try:
            stats = {}

            # 总体统计
            total_sql = f"SELECT COUNT(*) as total FROM {self.table_name}"
            with get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(total_sql)
                result = cursor.fetchone()
                stats['total'] = result['total']

            # 按状态统计
            status_sql = f"""
            SELECT status, COUNT(*) as count
            FROM {self.table_name}
            GROUP BY status
            """
            cursor.execute(status_sql)
            status_results = cursor.fetchall()
            stats['by_status'] = {row['status']: row['count'] for row in status_results}

            # 按类型统计
            type_sql = f"""
            SELECT ticket_type, COUNT(*) as count
            FROM {self.table_name}
            GROUP BY ticket_type
            """
            cursor.execute(type_sql)
            type_results = cursor.fetchall()
            stats['by_type'] = {row['ticket_type']: row['count'] for row in type_results}

            # 按优先级统计
            priority_sql = f"""
            SELECT priority, COUNT(*) as count
            FROM {self.table_name}
            GROUP BY priority
            """
            cursor.execute(priority_sql)
            priority_results = cursor.fetchall()
            stats['by_priority'] = {row['priority']: row['count'] for row in priority_results}

            # 今日创建
            today_sql = f"""
            SELECT COUNT(*) as today_count
            FROM {self.table_name}
            WHERE DATE(created_at) = CURDATE()
            """
            cursor.execute(today_sql)
            today_result = cursor.fetchone()
            stats['today_created'] = today_result['today_count']

            # 逾期工单
            overdue_sql = f"""
            SELECT COUNT(*) as overdue_count
            FROM {self.table_name}
            WHERE status NOT IN ('CLOSED', 'REJECTED')
            AND due_at < NOW()
            """
            cursor.execute(overdue_sql)
            overdue_result = cursor.fetchone()
            stats['overdue'] = overdue_result['overdue_count']

            return stats

        except Exception as e:
            print(f" 获取工单统计失败: {e}")
            return {}

    def delete_ticket(self, ticket_id: int) -> bool:
        """删除工单（软删除，仅管理员可用）"""
        try:
            # 这里可以实现软删除，比如添加is_deleted字段
            # 暂时使用物理删除
            sql = f"DELETE FROM {self.table_name} WHERE id = %s"

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, (ticket_id,))
                conn.commit()

            print(f" 工单删除成功: ID {ticket_id}")
            return True

        except Exception as e:
            print(f" 删除工单失败: {e}")
            return False