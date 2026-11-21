"""
工单系统数据模型
"""

from .ticket import TicketModel
from .comment import CommentModel

# 创建全局实例
ticket_model = TicketModel()
comment_model = CommentModel()

__all__ = ['ticket_model', 'comment_model']