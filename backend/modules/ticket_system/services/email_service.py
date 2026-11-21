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

from ..config import TICKET_PRIORITY, TICKET_STATUS, TICKET_TYPES

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
        self.smtp_from_name = os.environ.get('SMTP_FROM_NAME', '工单系统')
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
            logger.error(f"[ERROR] 连接 SMTP 服务器失败: {e}")
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
            logger.warning("[WARN] 邮件服务未配置，已跳过发送")
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

            logger.info(f"[OK] 邮件已发送至 {to}: {subject}")
            return True

        except Exception as e:
            logger.error(f"[ERROR] 发送邮件失败 {to}: {e}")
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

    def _norm(self, value: Optional[str]) -> str:
        return str(value or '').strip().upper()

    def _to_ticket_type_name(self, value: Optional[str]) -> str:
        code = self._norm(value)
        if not code:
            return ''
        return TICKET_TYPES.get(code, {}).get('name') or '未知类型'

    def _to_priority_name(self, value: Optional[str]) -> str:
        code = self._norm(value)
        if not code:
            return ''
        return TICKET_PRIORITY.get(code, {}).get('name') or '未知优先级'

    def _to_status_name(self, value: Optional[str]) -> str:
        code = self._norm(value)
        if not code:
            return ''
        return TICKET_STATUS.get(code, {}).get('name') or '未知状态'

    def _get_email_template(self, template_name: str, context: Dict) -> Dict[str, str]:
        """Get email template by name with context variables"""
        templates = {
            'ticket_created': {
                'subject': '[工单系统] 新工单已创建：{ticket_number}',
                'body': '''
{assignee_name} 您好，

系统已创建新的工单并分配给您。

工单信息：
- 工单编号：{ticket_number}
- 标题：{title}
- 类型：{ticket_type}
- 优先级：{priority}
- 创建人：{creator_name}
- 到期时间：{due_at}

描述：
{description}

请尽快处理该工单。

---
沉降监测系统 - 工单通知
''',
                'html_body': '''
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1890ff;">新工单已创建</h2>
    <p>{assignee_name} 您好，</p>
    <p>系统已创建新的工单并分配给您。</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">工单信息</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>工单编号：</strong></td><td>{ticket_number}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>标题：</strong></td><td>{title}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>类型：</strong></td><td>{ticket_type}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>优先级：</strong></td><td style="color: {priority_color};">{priority}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>创建人：</strong></td><td>{creator_name}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>到期时间：</strong></td><td>{due_at}</td></tr>
        </table>
    </div>
    <div style="background: #fafafa; padding: 15px; border-left: 3px solid #1890ff; margin: 15px 0;">
        <strong>描述：</strong>
        <p>{description}</p>
    </div>
    <p>请尽快处理该工单。</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">沉降监测系统 - 工单通知</p>
</div>
</body>
</html>
'''
            },
            'ticket_assigned': {
                'subject': '[工单系统] 工单已分配给您：{ticket_number}',
                'body': '''
{assignee_name} 您好，

工单 {ticket_number} 已分配给您。

工单信息：
- 标题：{title}
- 类型：{ticket_type}
- 优先级：{priority}
- 到期时间：{due_at}

请及时处理该工单。

---
沉降监测系统 - 工单通知
''',
                'html_body': None
            },
            'ticket_status_changed': {
                'subject': '[工单系统] 工单状态已变更：{ticket_number}',
                'body': '''
{recipient_name} 您好，

工单 {ticket_number} 的状态已变更。

状态变更：
- 从：{old_status}
- 到：{new_status}
- 变更人：{changed_by}

工单信息：
- 标题：{title}
- 优先级：{priority}

---
沉降监测系统 - 工单通知
''',
                'html_body': None
            },
            'ticket_due_soon': {
                'subject': '[提醒] 工单即将到期：{ticket_number}',
                'body': '''
{assignee_name} 您好，

提醒：工单 {ticket_number} 即将到期。

到期时间：{due_at}
剩余小时：{hours_remaining}

工单信息：
- 标题：{title}
- 优先级：{priority}
- 状态：{status}

请在到期前完成该工单处理。

---
沉降监测系统 - 工单通知
''',
                'html_body': '''
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #fa8c16;">提醒：工单即将到期</h2>
    <p>{assignee_name} 您好，</p>
    <p>提醒：工单 <strong>{ticket_number}</strong> 即将到期。</p>
    <div style="background: #fff7e6; padding: 15px; border-radius: 5px; border: 1px solid #ffd591; margin: 15px 0;">
        <p style="margin: 0;"><strong>到期时间：</strong> {due_at}</p>
        <p style="margin: 5px 0 0 0;"><strong>剩余小时：</strong> {hours_remaining}</p>
    </div>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">工单信息</h3>
        <p><strong>标题：</strong> {title}</p>
        <p><strong>优先级：</strong> {priority}</p>
        <p><strong>状态：</strong> {status}</p>
    </div>
    <p>请在到期前完成该工单处理。</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">沉降监测系统 - 工单通知</p>
</div>
</body>
</html>
'''
            },
            'ticket_overdue': {
                'subject': '[紧急] 工单已超期：{ticket_number}',
                'body': '''
紧急：工单已超期

{assignee_name} 您好，

工单 {ticket_number} 已超期。

到期时间：{due_at}
超期时长：{hours_overdue} 小时

工单信息：
- 标题：{title}
- 优先级：{priority}
- 状态：{status}

请立即处理该工单。

---
沉降监测系统 - 工单通知
''',
                'html_body': '''
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #ff4d4f;">紧急：工单已超期</h2>
    <p>{assignee_name} 您好，</p>
    <p>工单 <strong>{ticket_number}</strong> 已<strong style="color: #ff4d4f;">超期</strong>。</p>
    <div style="background: #fff1f0; padding: 15px; border-radius: 5px; border: 1px solid #ffa39e; margin: 15px 0;">
        <p style="margin: 0;"><strong>到期时间：</strong> {due_at}</p>
        <p style="margin: 5px 0 0 0;"><strong>超期时长：</strong> {hours_overdue} 小时</p>
    </div>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">工单信息</h3>
        <p><strong>标题：</strong> {title}</p>
        <p><strong>优先级：</strong> {priority}</p>
        <p><strong>状态：</strong> {status}</p>
    </div>
    <p style="color: #ff4d4f; font-weight: bold;">请立即处理该工单。</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">沉降监测系统 - 工单通知</p>
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
            logger.info("[INFO] 未配置处理人邮箱，已跳过新工单通知")
            return False

        ticket_type_code = self._norm(ticket.get('ticket_type', ''))
        priority_code = self._norm(ticket.get('priority', 'MEDIUM'))

        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'ticket_type': self._to_ticket_type_name(ticket_type_code),
            'priority': self._to_priority_name(priority_code),
            'priority_color': self._get_priority_color(priority_code),
            'creator_name': ticket.get('creator_name', '系统'),
            'assignee_name': ticket.get('assignee_name', '团队成员'),
            'due_at': str(ticket.get('due_at', '未设置')),
            'description': ticket.get('description', '暂无描述')
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
        ticket_type_code = self._norm(ticket.get('ticket_type', ''))
        priority_code = self._norm(ticket.get('priority', 'MEDIUM'))
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'ticket_type': self._to_ticket_type_name(ticket_type_code),
            'priority': self._to_priority_name(priority_code),
            'assignee_name': ticket.get('assignee_name', '团队成员'),
            'due_at': str(ticket.get('due_at', '未设置'))
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
        priority_code = self._norm(ticket.get('priority', 'MEDIUM'))
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'priority': self._to_priority_name(priority_code),
            'old_status': self._to_status_name(old_status),
            'new_status': self._to_status_name(new_status),
            'changed_by': changed_by,
            'recipient_name': ticket.get('creator_name', '团队成员')
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
        priority_code = self._norm(ticket.get('priority', 'MEDIUM'))
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'priority': self._to_priority_name(priority_code),
            'status': self._to_status_name(ticket.get('status', '')),
            'assignee_name': ticket.get('assignee_name', '团队成员'),
            'due_at': str(ticket.get('due_at', '未设置')),
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
        priority_code = self._norm(ticket.get('priority', 'MEDIUM'))
        context = {
            'ticket_number': ticket.get('ticket_number', ''),
            'title': ticket.get('title', ''),
            'priority': self._to_priority_name(priority_code),
            'status': self._to_status_name(ticket.get('status', '')),
            'assignee_name': ticket.get('assignee_name', '团队成员'),
            'due_at': str(ticket.get('due_at', '未设置')),
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
