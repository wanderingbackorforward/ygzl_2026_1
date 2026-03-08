# -*- coding: utf-8 -*-
"""
悬浮小助手 - 数据库服务层
提供对话和消息的 CRUD 操作
"""
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..database.db_config import get_db_cursor


def generate_id(prefix: str = "") -> str:
    """生成唯一 ID"""
    return f"{prefix}{uuid.uuid4().hex[:12]}"


class ConversationService:
    """对话管理服务"""

    @staticmethod
    def create_conversation(title: str = "新对话", role: str = "researcher") -> Dict[str, Any]:
        """创建新对话"""
        conv_id = generate_id("conv_")
        now = datetime.now()

        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO assistant_conversations (id, title, role, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (conv_id, title, role, now, now),
            )

        return {
            "id": conv_id,
            "title": title,
            "role": role,
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
            "messageCount": 0,
        }

    @staticmethod
    def get_conversations(limit: int = 100) -> List[Dict[str, Any]]:
        """获取对话列表（按更新时间倒序）"""
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    c.id,
                    c.title,
                    c.role,
                    c.created_at,
                    c.updated_at,
                    COUNT(m.id) as message_count,
                    (SELECT content FROM assistant_messages
                     WHERE conversation_id = c.id
                     ORDER BY created_at DESC LIMIT 1) as last_message
                FROM assistant_conversations c
                LEFT JOIN assistant_messages m ON c.id = m.conversation_id
                WHERE c.deleted_at IS NULL
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cursor.fetchall()

        conversations = []
        for row in rows:
            conversations.append(
                {
                    "id": row["id"],
                    "title": row["title"],
                    "role": row["role"],
                    "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
                    "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
                    "messageCount": row["message_count"] or 0,
                    "lastMessage": (row["last_message"] or "")[:100] if row["last_message"] else None,
                }
            )

        return conversations

    @staticmethod
    def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
        """获取单个对话详情（包含所有消息）"""
        with get_db_cursor() as cursor:
            # 获取对话基本信息
            cursor.execute(
                """
                SELECT id, title, role, created_at, updated_at
                FROM assistant_conversations
                WHERE id = %s AND deleted_at IS NULL
                """,
                (conv_id,),
            )
            conv_row = cursor.fetchone()

            if not conv_row:
                return None

            # 获取消息列表
            cursor.execute(
                """
                SELECT id, role, content, content_type, metadata, created_at
                FROM assistant_messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC
                """,
                (conv_id,),
            )
            message_rows = cursor.fetchall()

        messages = []
        for msg_row in message_rows:
            metadata = None
            if msg_row["metadata"]:
                try:
                    metadata = json.loads(msg_row["metadata"]) if isinstance(msg_row["metadata"], str) else msg_row["metadata"]
                except Exception:
                    metadata = None

            messages.append(
                {
                    "id": msg_row["id"],
                    "role": msg_row["role"],
                    "content": msg_row["content"],
                    "contentType": msg_row["content_type"],
                    "metadata": metadata,
                    "createdAt": msg_row["created_at"].isoformat() if msg_row["created_at"] else None,
                }
            )

        return {
            "id": conv_row["id"],
            "title": conv_row["title"],
            "role": conv_row["role"],
            "createdAt": conv_row["created_at"].isoformat() if conv_row["created_at"] else None,
            "updatedAt": conv_row["updated_at"].isoformat() if conv_row["updated_at"] else None,
            "messages": messages,
        }

    @staticmethod
    def update_conversation(conv_id: str, title: Optional[str] = None, role: Optional[str] = None) -> bool:
        """更新对话信息"""
        updates = []
        params = []

        if title is not None:
            updates.append("title = %s")
            params.append(title)

        if role is not None:
            updates.append("role = %s")
            params.append(role)

        if not updates:
            return True

        updates.append("updated_at = %s")
        params.append(datetime.now())
        params.append(conv_id)

        with get_db_cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE assistant_conversations
                SET {', '.join(updates)}
                WHERE id = %s AND deleted_at IS NULL
                """,
                tuple(params),
            )
            return cursor.rowcount > 0

    @staticmethod
    def delete_conversation(conv_id: str) -> bool:
        """软删除对话"""
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                UPDATE assistant_conversations
                SET deleted_at = %s
                WHERE id = %s AND deleted_at IS NULL
                """,
                (datetime.now(), conv_id),
            )
            return cursor.rowcount > 0

    @staticmethod
    def add_message(
        conv_id: str,
        role: str,
        content: str,
        content_type: str = "markdown",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """添加消息到对话"""
        msg_id = generate_id("msg_")
        now = datetime.now()

        metadata_json = json.dumps(metadata, ensure_ascii=False) if metadata else None

        with get_db_cursor() as cursor:
            # 插入消息
            cursor.execute(
                """
                INSERT INTO assistant_messages (id, conversation_id, role, content, content_type, metadata, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (msg_id, conv_id, role, content, content_type, metadata_json, now),
            )

            # 更新对话的 updated_at
            cursor.execute(
                """
                UPDATE assistant_conversations
                SET updated_at = %s
                WHERE id = %s
                """,
                (now, conv_id),
            )

        return {
            "id": msg_id,
            "conversationId": conv_id,
            "role": role,
            "content": content,
            "contentType": content_type,
            "metadata": metadata,
            "createdAt": now.isoformat(),
        }
