# -*- coding: utf-8 -*-
import os
import uuid
import json
import requests
from typing import Any, Dict, List, Optional


def _headers():
    """Supabase HTTP headers"""
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h


def _url(path):
    """Supabase URL"""
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


class ConversationService:
    @staticmethod
    def create_conversation(title: str = "新对话", role: str = "researcher", page_path: Optional[str] = None) -> Dict[str, Any]:
        conv_id = str(uuid.uuid4())
        payload = {
            'id': conv_id,
            'title': title,
            'role': role,
            'page_path': page_path
        }

        r = requests.post(
            _url('/rest/v1/assistant_conversations'),
            headers=_headers(),
            json=payload
        )
        r.raise_for_status()

        result = r.json()
        if isinstance(result, list) and len(result) > 0:
            row = result[0]
        else:
            row = result

        return {
            'id': row['id'],
            'title': row['title'],
            'role': row['role'],
            'pagePath': row.get('page_path'),
            'createdAt': row.get('created_at'),
            'updatedAt': row.get('updated_at'),
            'messageCount': 0,
            'messages': []
        }

    @staticmethod
    def get_conversations(limit: int = 100, page_path: Optional[str] = None) -> List[Dict[str, Any]]:
        # Build query URL with optional page_path filter
        query_parts = ['select=*', 'deleted_at=is.null', f'order=updated_at.desc', f'limit={limit}']
        if page_path:
            query_parts.append(f'page_path=eq.{page_path}')

        query_string = '&'.join(query_parts)

        # Get conversations (deleted_at is null)
        r = requests.get(
            _url(f'/rest/v1/assistant_conversations?{query_string}'),
            headers=_headers()
        )
        r.raise_for_status()
        conversations = r.json()

        result = []
        for conv in conversations:
            # Get message count and last message for each conversation
            msg_r = requests.get(
                _url(f'/rest/v1/assistant_messages?select=id,content&conversation_id=eq.{conv["id"]}&order=created_at.desc'),
                headers=_headers()
            )
            msg_r.raise_for_status()
            messages = msg_r.json()

            result.append({
                'id': conv['id'],
                'title': conv['title'],
                'role': conv['role'],
                'pagePath': conv.get('page_path'),
                'createdAt': conv.get('created_at'),
                'updatedAt': conv.get('updated_at'),
                'messageCount': len(messages),
                'lastMessage': messages[0]['content'] if messages else None
            })

        return result

    @staticmethod
    def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
        # Get conversation
        r = requests.get(
            _url(f'/rest/v1/assistant_conversations?select=*&id=eq.{conv_id}&deleted_at=is.null'),
            headers=_headers()
        )
        r.raise_for_status()
        conversations = r.json()

        if not conversations:
            return None

        conv = conversations[0]

        # Get messages
        msg_r = requests.get(
            _url(f'/rest/v1/assistant_messages?select=*&conversation_id=eq.{conv_id}&order=created_at.asc'),
            headers=_headers()
        )
        msg_r.raise_for_status()
        messages = msg_r.json()

        return {
            'id': conv['id'],
            'title': conv['title'],
            'role': conv['role'],
            'pagePath': conv.get('page_path'),
            'createdAt': conv.get('created_at'),
            'updatedAt': conv.get('updated_at'),
            'messages': [
                {
                    'id': msg['id'],
                    'role': msg['role'],
                    'content': msg['content'],
                    'contentType': msg.get('content_type', 'markdown'),
                    'metadata': msg.get('metadata'),
                    'createdAt': msg.get('created_at')
                }
                for msg in messages
            ]
        }

    @staticmethod
    def update_conversation(conv_id: str, title: Optional[str] = None, role: Optional[str] = None) -> bool:
        payload = {}
        if title is not None:
            payload['title'] = title
        if role is not None:
            payload['role'] = role

        if not payload:
            return True

        r = requests.patch(
            _url(f'/rest/v1/assistant_conversations?id=eq.{conv_id}'),
            headers=_headers(),
            json=payload
        )
        r.raise_for_status()
        return True

    @staticmethod
    def delete_conversation(conv_id: str) -> bool:
        from datetime import datetime

        r = requests.patch(
            _url(f'/rest/v1/assistant_conversations?id=eq.{conv_id}'),
            headers=_headers(),
            json={'deleted_at': datetime.utcnow().isoformat()}
        )
        r.raise_for_status()
        return True

    @staticmethod
    def add_message(
        conv_id: str,
        role: str,
        content: str,
        content_type: str = "markdown",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())

        payload = {
            'id': msg_id,
            'conversation_id': conv_id,
            'role': role,
            'content': content,
            'content_type': content_type,
            'metadata': metadata
        }

        r = requests.post(
            _url('/rest/v1/assistant_messages'),
            headers=_headers(),
            json=payload
        )
        r.raise_for_status()

        result = r.json()
        if isinstance(result, list) and len(result) > 0:
            row = result[0]
        else:
            row = result

        return {
            'id': row['id'],
            'role': row['role'],
            'content': row['content'],
            'contentType': row.get('content_type', 'markdown'),
            'metadata': row.get('metadata'),
            'createdAt': row.get('created_at')
        }
