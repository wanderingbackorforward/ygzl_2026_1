"""
工单评论数据模型
"""

import datetime
from typing import Dict, List, Optional, Any
import json

from ...database.db_config import get_db_connection


class CommentModel:
    """工单评论数据模型"""

    def __init__(self):
        self.table_name = "ticket_comments"
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        """确保评论表存在"""
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {self.table_name} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ticket_id INT NOT NULL,
            author_id VARCHAR(50) NOT NULL,
            author_name VARCHAR(100) NOT NULL,
            content TEXT NOT NULL,
            comment_type VARCHAR(20) DEFAULT 'COMMENT',
            attachment_paths JSON,
            metadata JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ticket_id (ticket_id),
            INDEX idx_author_id (author_id),
            INDEX idx_created_at (created_at),
            FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(create_table_sql)
                conn.commit()
                print(f" 工单评论表 {self.table_name} 创建成功或已存在")
        except Exception as e:
            print(f" 创建工单评论表失败: {e}")
            raise

    def add_comment(self, ticket_id: int, author_id: str, author_name: str,
                   content: str, comment_type: str = 'COMMENT',
                   attachment_paths: Optional[List[str]] = None,
                   metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """添加评论"""
        try:
            insert_data = {
                'ticket_id': ticket_id,
                'author_id': author_id,
                'author_name': author_name,
                'content': content,
                'comment_type': comment_type,
                'attachment_paths': json.dumps(attachment_paths or []),
                'metadata': json.dumps(metadata or {})
            }

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
                comment_id = cursor.lastrowid
                conn.commit()

            # 返回创建的评论信息
            result = insert_data.copy()
            result['id'] = comment_id
            result['created_at'] = datetime.datetime.now()

            print(f" 评论添加成功: 工单ID {ticket_id}")
            return result

        except Exception as e:
            print(f" 添加评论失败: {e}")
            raise

    def get_comments(self, ticket_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """获取工单评论列表"""
        try:
            sql = f"""
            SELECT * FROM {self.table_name}
            WHERE ticket_id = %s
            ORDER BY created_at ASC
            LIMIT %s
            """

            with get_db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, (ticket_id, limit))
                comments = cursor.fetchall()

            # 处理JSON字段
            for comment in comments:
                if comment.get('attachment_paths'):
                    comment['attachment_paths'] = json.loads(comment['attachment_paths'])
                if comment.get('metadata'):
                    comment['metadata'] = json.loads(comment['metadata'])

            return comments

        except Exception as e:
            print(f" 获取评论列表失败: {e}")
            return []

    def update_comment(self, comment_id: int, content: str,
                      author_id: str) -> bool:
        """更新评论（仅作者可编辑）"""
        try:
            sql = f"""
            UPDATE {self.table_name}
            SET content = %s, updated_at = NOW()
            WHERE id = %s AND author_id = %s
            """

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, (content, comment_id, author_id))
                conn.commit()

            success = cursor.rowcount > 0
            if success:
                print(f" 评论更新成功: ID {comment_id}")

            return success

        except Exception as e:
            print(f" 更新评论失败: {e}")
            return False

    def delete_comment(self, comment_id: int, author_id: str,
                      is_admin: bool = False) -> bool:
        """删除评论"""
        try:
            if is_admin:
                sql = f"DELETE FROM {self.table_name} WHERE id = %s"
                params = (comment_id,)
            else:
                sql = f"DELETE FROM {self.table_name} WHERE id = %s AND author_id = %s"
                params = (comment_id, author_id)

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                conn.commit()

            success = cursor.rowcount > 0
            if success:
                print(f" 评论删除成功: ID {comment_id}")

            return success

        except Exception as e:
            print(f" 删除评论失败: {e}")
            return False