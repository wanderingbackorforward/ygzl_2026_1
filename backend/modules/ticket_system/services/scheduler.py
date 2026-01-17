# -*- coding: utf-8 -*-
"""
Ticket Scheduler Service
Handles periodic tasks: due date reminders, overdue notifications, and auto-archiving
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
    """Scheduler for periodic ticket tasks"""

    def __init__(self, check_interval_seconds: int = 3600):
        """
        Initialize scheduler

        Args:
            check_interval_seconds: How often to check for due/overdue tickets (default: 1 hour)
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
        """Set email address for a user (manual override)"""
        self._user_emails[user_id] = email

    def get_user_email(self, user_id: str) -> Optional[str]:
        """Get email address for a user (from cache or database)"""
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
            logger.warning(f"[WARN] Failed to get email for user {user_id} from database: {e}")

        return None

    def load_user_emails_from_database(self):
        """Load all user emails from database"""
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
            logger.info(f"[OK] Loaded {count} user emails from database")
            return count
        except Exception as e:
            logger.warning(f"[WARN] Failed to load user emails from database: {e}")
            return 0

    def load_user_emails_from_env(self):
        """Load user emails from environment variables (fallback, format: USER_EMAIL_xxx=email)"""
        import os
        count = 0
        for key, value in os.environ.items():
            if key.startswith('USER_EMAIL_'):
                user_id = key.replace('USER_EMAIL_', '').lower()
                self._user_emails[user_id] = value
                count += 1
                logger.info(f"[OK] Loaded email for user from env: {user_id}")
        return count

    def refresh_user_emails(self):
        """Refresh user email cache if expired"""
        if self._email_cache_time is None:
            self.load_user_emails_from_database()
            return

        elapsed = (datetime.now() - self._email_cache_time).total_seconds()
        if elapsed > self._email_cache_ttl:
            self.load_user_emails_from_database()

    def _check_due_soon_tickets(self):
        """Check for tickets due within 24 hours and send reminders"""
        try:
            repo = get_repo()
            due_soon = repo.tickets_get_due_soon(hours=24)

            if not due_soon:
                logger.info("[INFO] No tickets due soon")
                return

            logger.info(f"[INFO] Found {len(due_soon)} tickets due soon")

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
                    logger.warning(f"[WARN] No email for assignee {assignee_id}")
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
                    logger.info(f"[OK] Sent due soon notification for ticket {ticket.get('ticket_number')}")

        except Exception as e:
            logger.error(f"[ERROR] Error checking due soon tickets: {e}")

    def _check_overdue_tickets(self):
        """Check for overdue tickets and send notifications"""
        try:
            repo = get_repo()
            overdue = repo.tickets_get_overdue()

            if not overdue:
                logger.info("[INFO] No overdue tickets")
                return

            logger.info(f"[INFO] Found {len(overdue)} overdue tickets")

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
                    logger.warning(f"[WARN] No email for assignee {assignee_id}")
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
                    logger.info(f"[OK] Sent overdue notification for ticket {ticket.get('ticket_number')}")

        except Exception as e:
            logger.error(f"[ERROR] Error checking overdue tickets: {e}")

    def _auto_archive_tickets(self):
        """Auto archive eligible tickets (closed/rejected > 7 days)"""
        try:
            repo = get_repo()
            result = repo.tickets_auto_archive()

            archived_count = result.get('archived_count', 0)
            if archived_count > 0:
                logger.info(f"[OK] Auto-archived {archived_count} tickets")
            else:
                logger.info("[INFO] No tickets to archive")

            return result

        except Exception as e:
            logger.error(f"[ERROR] Error auto-archiving tickets: {e}")
            return {'archived_count': 0, 'error': str(e)}

    def _run_scheduled_tasks(self):
        """Main scheduler loop"""
        logger.info("[OK] Ticket scheduler started")

        while not self._stop_event.is_set():
            try:
                logger.info("[INFO] Running scheduled ticket tasks...")

                # Refresh user emails from database
                self.refresh_user_emails()

                # Check due soon tickets
                self._check_due_soon_tickets()

                # Check overdue tickets
                self._check_overdue_tickets()

                # Auto archive eligible tickets
                self._auto_archive_tickets()

                logger.info(f"[OK] Scheduled tasks completed. Next run in {self.check_interval} seconds")

            except Exception as e:
                logger.error(f"[ERROR] Scheduler error: {e}")

            # Wait for next interval or stop signal
            self._stop_event.wait(self.check_interval)

        logger.info("[INFO] Ticket scheduler stopped")

    def start(self):
        """Start the scheduler in a background thread"""
        if self._is_running:
            logger.warning("[WARN] Scheduler already running")
            return

        self._stop_event.clear()
        self._scheduler_thread = threading.Thread(target=self._run_scheduled_tasks, daemon=True)
        self._scheduler_thread.start()
        self._is_running = True
        logger.info("[OK] Scheduler thread started")

    def stop(self):
        """Stop the scheduler"""
        if not self._is_running:
            return

        logger.info("[INFO] Stopping scheduler...")
        self._stop_event.set()

        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)

        self._is_running = False
        logger.info("[OK] Scheduler stopped")

    def run_once(self):
        """Run all scheduled tasks once (for manual trigger or testing)"""
        logger.info("[INFO] Running scheduled tasks (manual trigger)...")

        results = {
            'due_soon_check': self._check_due_soon_tickets(),
            'overdue_check': self._check_overdue_tickets(),
            'auto_archive': self._auto_archive_tickets()
        }

        logger.info("[OK] Manual scheduled tasks completed")
        return results

    def get_status(self) -> Dict:
        """Get scheduler status"""
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
    """Convenience function to start the global scheduler"""
    # First try to load from database, then fall back to environment variables
    db_count = ticket_scheduler.load_user_emails_from_database()
    if db_count == 0:
        ticket_scheduler.load_user_emails_from_env()
    ticket_scheduler.start()


def stop_scheduler():
    """Convenience function to stop the global scheduler"""
    ticket_scheduler.stop()
