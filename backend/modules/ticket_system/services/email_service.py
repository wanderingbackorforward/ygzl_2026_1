# -*- coding: utf-8 -*-
"""
Email Service Module for Ticket System
Provides SMTP email notification functionality
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from typing import List, Dict, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmailConfig:
    """Email configuration from environment variables"""

    def __init__(self):
        self.smtp_host = os.environ.get('SMTP_HOST', 'smtp.qq.com')
        self.smtp_port = int(os.environ.get('SMTP_PORT', '465'))
        self.smtp_user = os.environ.get('SMTP_USER', '')
        self.smtp_password = os.environ.get('SMTP_PASSWORD', '')
        self.smtp_from = os.environ.get('SMTP_FROM', self.smtp_user)
        self.smtp_from_name = os.environ.get('SMTP_FROM_NAME', 'Ticket System')
        self.use_ssl = os.environ.get('SMTP_USE_SSL', 'true').lower() == 'true'
        self.use_tls = os.environ.get('SMTP_USE_TLS', 'false').lower() == 'true'

    def is_configured(self) -> bool:
        """Check if email is properly configured"""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)


class EmailService:
    """SMTP Email Service for Ticket Notifications"""

    def __init__(self):
        self.config = EmailConfig()
        self._connection = None

    def _get_connection(self):
        """Create SMTP connection"""
        try:
            if self.config.use_ssl:
                server = smtplib.SMTP_SSL(self.config.smtp_host, self.config.smtp_port)
            else:
                server = smtplib.SMTP(self.config.smtp_host, self.config.smtp_port)
                if self.config.use_tls:
                    server.starttls()

            server.login(self.config.smtp_user, self.config.smtp_password)
            return server
        except Exception as e:
            logger.error(f"[ERROR] Failed to connect to SMTP server: {e}")
            raise

    def send_email(self, to: str, subject: str, body: str, html_body: Optional[str] = None) -> bool:
        """
        Send an email

        Args:
            to: Recipient email address
            subject: Email subject
            body: Plain text body
            html_body: Optional HTML body

        Returns:
            bool: True if sent successfully
        """
        if not self.config.is_configured():
            logger.warning("[WARN] Email service not configured, skipping send")
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.config.smtp_from_name} <{self.config.smtp_from}>"
            msg['To'] = to
            msg['Subject'] = Header(subject, 'utf-8')

            # Attach plain text body
            msg.attach(MIMEText(body, 'plain', 'utf-8'))

            # Attach HTML body if provided
            if html_body:
                msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            # Send email
            server = self._get_connection()
            server.sendmail(self.config.smtp_from, [to], msg.as_string())
            server.quit()

            logger.info(f"[OK] Email sent to {to}: {subject}")
            return True

        except Exception as e:
            logger.error(f"[ERROR] Failed to send email to {to}: {e}")
            return False

    def send_batch_emails(self, recipients: List[str], subject: str, body: str, html_body: Optional[str] = None) -> Dict:
        """
        Send emails to multiple recipients

        Returns:
            Dict with success and failed counts
        """
        results = {'success': [], 'failed': []}

        for recipient in recipients:
            if self.send_email(recipient, subject, body, html_body):
                results['success'].append(recipient)
            else:
                results['failed'].append(recipient)

        return results


class TicketEmailNotifier:
    """Ticket-specific email notification templates and logic"""

    def __init__(self):
        self.email_service = EmailService()

    def _get_email_template(self, template_name: str, context: Dict) -> Dict[str, str]:
        """Get email template by name with context variables"""
        templates = {
            'ticket_created': {
                'subject': '[Ticket System] New Ticket Created: {ticket_number}',
                'body': '''
Dear {assignee_name},

A new ticket has been created and assigned to you.

Ticket Details:
- Ticket Number: {ticket_number}
- Title: {title}
- Type: {ticket_type}
- Priority: {priority}
- Creator: {creator_name}
- Due Date: {due_at}

Description:
{description}

Please handle this ticket as soon as possible.

---
Monitoring System - Ticket Notification
''',
                'html_body': '''
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1890ff;">New Ticket Created</h2>
    <p>Dear {assignee_name},</p>
    <p>A new ticket has been created and assigned to you.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">Ticket Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Ticket Number:</strong></td><td>{ticket_number}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Title:</strong></td><td>{title}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Type:</strong></td><td>{ticket_type}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Priority:</strong></td><td style="color: {priority_color};">{priority}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Creator:</strong></td><td>{creator_name}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Due Date:</strong></td><td>{due_at}</td></tr>
        </table>
    </div>
    <div style="background: #fafafa; padding: 15px; border-left: 3px solid #1890ff; margin: 15px 0;">
        <strong>Description:</strong>
        <p>{description}</p>
    </div>
    <p>Please handle this ticket as soon as possible.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Monitoring System - Ticket Notification</p>
</div>
</body>
</html>
'''
            },
            'ticket_assigned': {
                'subject': '[Ticket System] Ticket Assigned to You: {ticket_number}',
                'body': '''
Dear {assignee_name},

Ticket {ticket_number} has been assigned to you.

Ticket Details:
- Title: {title}
- Type: {ticket_type}
- Priority: {priority}
- Due Date: {due_at}

Please take action on this ticket.

---
Monitoring System - Ticket Notification
''',
                'html_body': None
            },
            'ticket_status_changed': {
                'subject': '[Ticket System] Status Changed: {ticket_number}',
                'body': '''
Dear {recipient_name},

The status of ticket {ticket_number} has been changed.

Status Change:
- From: {old_status}
- To: {new_status}
- Changed By: {changed_by}

Ticket Details:
- Title: {title}
- Priority: {priority}

---
Monitoring System - Ticket Notification
''',
                'html_body': None
            },
            'ticket_due_soon': {
                'subject': '[REMINDER] Ticket Due Soon: {ticket_number}',
                'body': '''
Dear {assignee_name},

This is a reminder that ticket {ticket_number} is due soon.

Due Date: {due_at}
Hours Remaining: {hours_remaining}

Ticket Details:
- Title: {title}
- Priority: {priority}
- Status: {status}

Please ensure this ticket is completed before the due date.

---
Monitoring System - Ticket Notification
''',
                'html_body': '''
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #fa8c16;">[REMINDER] Ticket Due Soon</h2>
    <p>Dear {assignee_name},</p>
    <p>This is a reminder that ticket <strong>{ticket_number}</strong> is due soon.</p>
    <div style="background: #fff7e6; padding: 15px; border-radius: 5px; border: 1px solid #ffd591; margin: 15px 0;">
        <p style="margin: 0;"><strong>Due Date:</strong> {due_at}</p>
        <p style="margin: 5px 0 0 0;"><strong>Hours Remaining:</strong> {hours_remaining}</p>
    </div>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">Ticket Details</h3>
        <p><strong>Title:</strong> {title}</p>
        <p><strong>Priority:</strong> {priority}</p>
        <p><strong>Status:</strong> {status}</p>
    </div>
    <p>Please ensure this ticket is completed before the due date.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Monitoring System - Ticket Notification</p>
</div>
</body>
</html>
'''
            },
            'ticket_overdue': {
                'subject': '[URGENT] Ticket Overdue: {ticket_number}',
                'body': '''
URGENT: Ticket Overdue

Dear {assignee_name},

Ticket {ticket_number} is now OVERDUE.

Due Date: {due_at}
Overdue By: {hours_overdue} hours

Ticket Details:
- Title: {title}
- Priority: {priority}
- Status: {status}

Please address this immediately.

---
Monitoring System - Ticket Notification
''',
                'html_body': '''
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #ff4d4f;">[URGENT] Ticket Overdue</h2>
    <p>Dear {assignee_name},</p>
    <p>Ticket <strong>{ticket_number}</strong> is now <strong style="color: #ff4d4f;">OVERDUE</strong>.</p>
    <div style="background: #fff1f0; padding: 15px; border-radius: 5px; border: 1px solid #ffa39e; margin: 15px 0;">
        <p style="margin: 0;"><strong>Due Date:</strong> {due_at}</p>
        <p style="margin: 5px 0 0 0;"><strong>Overdue By:</strong> {hours_overdue} hours</p>
    </div>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">Ticket Details</h3>
        <p><strong>Title:</strong> {title}</p>
        <p><strong>Priority:</strong> {priority}</p>
        <p><strong>Status:</strong> {status}</p>
    </div>
    <p style="color: #ff4d4f; font-weight: bold;">Please address this immediately.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">Monitoring System - Ticket Notification</p>
</div>
</body>
</html>
'''
            }
        }

        template = templates.get(template_name, {})
        if not template:
            return {'subject': '', 'body': '', 'html_body': None}

        # Apply context to template
        result = {}
        for key, value in template.items():
            if value:
                result[key] = value.format(**context)
            else:
                result[key] = None

        return result

    def _get_priority_color(self, priority: str) -> str:
        """Get color for priority display in HTML"""
        colors = {
            'CRITICAL': '#ff4d4f',
            'HIGH': '#fa8c16',
            'MEDIUM': '#1890ff',
            'LOW': '#52c41a'
        }
        return colors.get(priority, '#333')

    def notify_ticket_created(self, ticket: Dict, assignee_email: Optional[str] = None) -> bool:
        """Send notification for newly created ticket"""
        if not assignee_email:
            logger.info("[INFO] No assignee email, skipping ticket created notification")
            return False

        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'ticket_type': ticket.get('ticket_type', ''),
            'priority': ticket.get('priority', 'MEDIUM'),
            'priority_color': self._get_priority_color(ticket.get('priority', 'MEDIUM')),
            'creator_name': ticket.get('creator_name', 'System'),
            'assignee_name': ticket.get('assignee_name', 'Team Member'),
            'due_at': str(ticket.get('due_at', 'Not set')),
            'description': ticket.get('description', 'No description provided')
        }

        template = self._get_email_template('ticket_created', context)
        return self.email_service.send_email(
            assignee_email,
            template['subject'],
            template['body'],
            template['html_body']
        )

    def notify_ticket_assigned(self, ticket: Dict, assignee_email: str) -> bool:
        """Send notification when ticket is assigned"""
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'ticket_type': ticket.get('ticket_type', ''),
            'priority': ticket.get('priority', 'MEDIUM'),
            'assignee_name': ticket.get('assignee_name', 'Team Member'),
            'due_at': str(ticket.get('due_at', 'Not set'))
        }

        template = self._get_email_template('ticket_assigned', context)
        return self.email_service.send_email(
            assignee_email,
            template['subject'],
            template['body'],
            template['html_body']
        )

    def notify_status_changed(self, ticket: Dict, old_status: str, new_status: str,
                             changed_by: str, recipient_email: str) -> bool:
        """Send notification when ticket status changes"""
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'priority': ticket.get('priority', 'MEDIUM'),
            'old_status': old_status,
            'new_status': new_status,
            'changed_by': changed_by,
            'recipient_name': ticket.get('creator_name', 'Team Member')
        }

        template = self._get_email_template('ticket_status_changed', context)
        return self.email_service.send_email(
            recipient_email,
            template['subject'],
            template['body'],
            template['html_body']
        )

    def notify_ticket_due_soon(self, ticket: Dict, assignee_email: str, hours_remaining: float) -> bool:
        """Send reminder for ticket due soon"""
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'priority': ticket.get('priority', 'MEDIUM'),
            'status': ticket.get('status', ''),
            'assignee_name': ticket.get('assignee_name', 'Team Member'),
            'due_at': str(ticket.get('due_at', 'Not set')),
            'hours_remaining': round(hours_remaining, 1)
        }

        template = self._get_email_template('ticket_due_soon', context)
        return self.email_service.send_email(
            assignee_email,
            template['subject'],
            template['body'],
            template['html_body']
        )

    def notify_ticket_overdue(self, ticket: Dict, assignee_email: str, hours_overdue: float) -> bool:
        """Send urgent notification for overdue ticket"""
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'priority': ticket.get('priority', 'MEDIUM'),
            'status': ticket.get('status', ''),
            'assignee_name': ticket.get('assignee_name', 'Team Member'),
            'due_at': str(ticket.get('due_at', 'Not set')),
            'hours_overdue': round(abs(hours_overdue), 1)
        }

        template = self._get_email_template('ticket_overdue', context)
        return self.email_service.send_email(
            assignee_email,
            template['subject'],
            template['body'],
            template['html_body']
        )


# Global singleton instance
email_service = EmailService()
ticket_notifier = TicketEmailNotifier()
