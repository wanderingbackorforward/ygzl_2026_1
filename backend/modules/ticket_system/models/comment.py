"""
工单评论数据模型
"""

import datetime
from typing import Dict, List, Optional, Any
import json

from modules.db.vendor import get_repo


class CommentModel:
    """工单评论数据模型"""

    def __init__(self):
        self.table_name = "ticket_comments"
        pass

    def _ensure_table_exists(self):
        return

    def add_comment(self, ticket_id: int, author_id: str, author_name: str,
                   content: str, comment_type: str = 'COMMENT',
                   attachment_paths: Optional[List[str]] = None,
                   metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            insert_data = {
                'ticket_id': ticket_id,
                'author_id': author_id,
                'author_name': author_name,
                'content': content,
                'comment_type': comment_type,
                'attachment_paths': attachment_paths or [],
                'metadata': metadata or {}
            }
            repo = get_repo()
            created = repo.ticket_comment_add(insert_data)
            return created

        except Exception as e:
            print(f" 添加评论失败: {e}")
            raise

    def get_comments(self, ticket_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            repo = get_repo()
            comments = repo.ticket_comments_get(ticket_id, limit)
            return comments

        except Exception as e:
            print(f" 获取评论列表失败: {e}")
            return []

    def update_comment(self, comment_id: int, content: str,
                      author_id: str) -> bool:
        try:
            repo = get_repo()
            ok = repo.ticket_comment_update(comment_id, author_id, content)
            return ok

        except Exception as e:
            print(f" 更新评论失败: {e}")
            return False

    def delete_comment(self, comment_id: int, author_id: str,
                      is_admin: bool = False) -> bool:
        try:
            repo = get_repo()
            ok = repo.ticket_comment_delete(comment_id, author_id, is_admin)
            return ok

        except Exception as e:
            print(f" 删除评论失败: {e}")
            return False
