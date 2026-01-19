# -*- coding: utf-8 -*-
"""
工单定时任务服务
处理周期任务：到期提醒、超期通知、自动归档
"""

import threading
import time
import logging
from datetime import datetime
from typing import Dict, List, Optional

from modules.db.vendor import get_repo
from .email_service import ticket_notifier

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TicketScheduler:
    """工单周期任务调度器"""

    def __init__(self, check_interval_seconds: int = 3600):
        """
        初始化调度器

        Args:
            check_interval_seconds: 检查即将到期/已超期工单的间隔秒数（默认：1小时）
        """
        self.check_interval = check_interval_seconds
        self._stop_event = threading.Event()
        self._scheduler_thread = None
        self._is_running = False

        # Track sent notifications to avoid duplicates
        self._sent_due_soon_notifications = set()
        self._sent_overdue_notifications = set()

        # User email cache (loaded from database)
        self._user_emails = {}
        self._email_cache_time = None
        self._email_cache_ttl = 300  # Cache TTL: 5 minutes

    def set_user_email(self, user_id: str, email: str):
        """设置用户邮箱（手动覆盖）"""
        self._user_emails[user_id] = email

    def get_user_email(self, user_id: str) -> Optional[str]:
        """获取用户邮箱（优先缓存，否则查数据库）"""
        # First check cache
        if user_id in self._user_emails:
            return self._user_emails.get(user_id)

        # Try to get from database
        try:
            repo = get_repo()
            email = repo.user_get_email(user_id)
            if email:
                self._user_emails[user_id] = email
                return email
        except Exception as e:
            logger.warning(f"[WARN] 从数据库获取用户邮箱失败 {user_id}: {e}")

        return None

    def load_user_emails_from_database(self):
        """从数据库加载所有用户邮箱"""
        try:
            repo = get_repo()
            users = repo.users_get_with_email()
            count = 0
            for user in users:
                user_id = user.get('user_id')
                email = user.get('notification_email') or user.get('email')
                if user_id and email:
                    self._user_emails[user_id] = email
                    count += 1
            self._email_cache_time = datetime.now()
            logger.info(f"[OK] 已从数据库加载 {count} 个用户邮箱")
            return count
        except Exception as e:
            logger.warning(f"[WARN] 从数据库加载用户邮箱失败: {e}")
            return 0

    def load_user_emails_from_env(self):
        """从环境变量加载用户邮箱（兜底，格式：USER_EMAIL_xxx=email）"""
        import os
        count = 0
        for key, value in os.environ.items():
            if key.startswith('USER_EMAIL_'):
                user_id = key.replace('USER_EMAIL_', '').lower()
                self._user_emails[user_id] = value
                count += 1
                logger.info(f"[OK] 已从环境变量加载用户邮箱: {user_id}")
        return count

    def refresh_user_emails(self):
        """邮箱缓存过期时刷新"""
        if self._email_cache_time is None:
            self.load_user_emails_from_database()
            return

        elapsed = (datetime.now() - self._email_cache_time).total_seconds()
        if elapsed > self._email_cache_ttl:
            self.load_user_emails_from_database()

    def _check_due_soon_tickets(self):
        """检查 24 小时内即将到期工单并发送提醒"""
        try:
            repo = get_repo()
            due_soon = repo.tickets_get_due_soon(hours=24)

            if not due_soon:
                logger.info("[INFO] 暂无即将到期工单")
                return

            logger.info(f"[INFO] 发现 {len(due_soon)} 个即将到期工单")

            for ticket in due_soon:
                ticket_id = ticket.get('id')

                # Skip if already notified
                if ticket_id in self._sent_due_soon_notifications:
                    continue

                assignee_id = ticket.get('assignee_id')
                if not assignee_id:
                    continue

                assignee_email = self.get_user_email(assignee_id)
                if not assignee_email:
                    logger.warning(f"[WARN] 处理人未配置邮箱: {assignee_id}")
                    continue

                # Calculate hours remaining
                due_at = ticket.get('due_at')
                if due_at:
                    if isinstance(due_at, str):
                        due_at = datetime.fromisoformat(due_at.replace('Z', '+00:00'))
                    hours_remaining = (due_at - datetime.now(due_at.tzinfo)).total_seconds() / 3600
                else:
                    hours_remaining = 24

                # Send notification
                success = ticket_notifier.notify_ticket_due_soon(ticket, assignee_email, hours_remaining)
                if success:
                    self._sent_due_soon_notifications.add(ticket_id)
                    logger.info(f"[OK] 已发送即将到期提醒: {ticket.get('ticket_number')}")

        except Exception as e:
            logger.error(f"[ERROR] 检查即将到期工单时出错: {e}")

    def _check_overdue_tickets(self):
        """检查已超期工单并发送通知"""
        try:
            repo = get_repo()
            overdue = repo.tickets_get_overdue()

            if not overdue:
                logger.info("[INFO] 暂无超期工单")
                return

            logger.info(f"[INFO] 发现 {len(overdue)} 个超期工单")

            for ticket in overdue:
                ticket_id = ticket.get('id')

                # Skip if already notified (within last check interval)
                notification_key = f"{ticket_id}_{datetime.now().strftime('%Y%m%d%H')}"
                if notification_key in self._sent_overdue_notifications:
                    continue

                assignee_id = ticket.get('assignee_id')
                if not assignee_id:
                    continue

                assignee_email = self.get_user_email(assignee_id)
                if not assignee_email:
                    logger.warning(f"[WARN] 处理人未配置邮箱: {assignee_id}")
                    continue

                # Calculate hours overdue
                due_at = ticket.get('due_at')
                if due_at:
                    if isinstance(due_at, str):
                        due_at = datetime.fromisoformat(due_at.replace('Z', '+00:00'))
                    hours_overdue = (datetime.now(due_at.tzinfo) - due_at).total_seconds() / 3600
                else:
                    hours_overdue = 0

                # Send notification
                success = ticket_notifier.notify_ticket_overdue(ticket, assignee_email, hours_overdue)
                if success:
                    self._sent_overdue_notifications.add(notification_key)
                    logger.info(f"[OK] 已发送超期通知: {ticket.get('ticket_number')}")

        except Exception as e:
            logger.error(f"[ERROR] 检查超期工单时出错: {e}")

    def _auto_archive_tickets(self):
        """自动归档符合条件的工单（已关闭/已拒绝超过 7 天）"""
        try:
            repo = get_repo()
            result = repo.tickets_auto_archive()

            archived_count = result.get('archived_count', 0)
            if archived_count > 0:
                logger.info(f"[OK] 已自动归档 {archived_count} 条工单")
            else:
                logger.info("[INFO] 暂无可归档工单")

            return result

        except Exception as e:
            logger.error(f"[ERROR] 自动归档工单时出错: {e}")
            return {'archived_count': 0, 'error': str(e)}

    def _run_scheduled_tasks(self):
        """调度主循环"""
        logger.info("[OK] 工单定时任务已启动")

        while not self._stop_event.is_set():
            try:
                logger.info("[INFO] 正在执行工单定时任务...")

                # Refresh user emails from database
                self.refresh_user_emails()

                # Check due soon tickets
                self._check_due_soon_tickets()

                # Check overdue tickets
                self._check_overdue_tickets()

                # Auto archive eligible tickets
                self._auto_archive_tickets()

                logger.info(f"[OK] 定时任务执行完成，下次执行间隔 {self.check_interval} 秒")

            except Exception as e:
                logger.error(f"[ERROR] 定时任务异常: {e}")

            # Wait for next interval or stop signal
            self._stop_event.wait(self.check_interval)

        logger.info("[INFO] 工单定时任务已停止")

    def start(self):
        """后台线程启动调度器"""
        if self._is_running:
            logger.warning("[WARN] 调度器已在运行")
            return

        self._stop_event.clear()
        self._scheduler_thread = threading.Thread(target=self._run_scheduled_tasks, daemon=True)
        self._scheduler_thread.start()
        self._is_running = True
        logger.info("[OK] 调度线程已启动")

    def stop(self):
        """停止调度器"""
        if not self._is_running:
            return

        logger.info("[INFO] 正在停止调度器...")
        self._stop_event.set()

        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)

        self._is_running = False
        logger.info("[OK] 调度器已停止")

    def run_once(self):
        """执行一次所有定时任务（用于手动触发或测试）"""
        logger.info("[INFO] 正在执行定时任务（手动触发）...")

        results = {
            'due_soon_check': self._check_due_soon_tickets(),
            'overdue_check': self._check_overdue_tickets(),
            'auto_archive': self._auto_archive_tickets()
        }

        logger.info("[OK] 手动定时任务执行完成")
        return results

    def get_status(self) -> Dict:
        """获取调度器状态"""
        return {
            'is_running': self._is_running,
            'check_interval_seconds': self.check_interval,
            'due_soon_notifications_sent': len(self._sent_due_soon_notifications),
            'overdue_notifications_sent': len(self._sent_overdue_notifications),
            'registered_user_emails': len(self._user_emails)
        }


# Global singleton instance
ticket_scheduler = TicketScheduler()


def start_scheduler():
    """便捷方法：启动全局调度器"""
    # First try to load from database, then fall back to environment variables
    db_count = ticket_scheduler.load_user_emails_from_database()
    if db_count == 0:
        ticket_scheduler.load_user_emails_from_env()
    ticket_scheduler.start()


def stop_scheduler():
    """便捷方法：停止全局调度器"""
    ticket_scheduler.stop()
