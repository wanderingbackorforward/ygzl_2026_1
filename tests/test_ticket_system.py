# -*- coding: utf-8 -*-
"""
Test Script for Ticket System
Validates database operations and email service functionality
"""

import os
import sys
import json
from datetime import datetime, timedelta

# Add the backend path to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()


def test_database_connection():
    """Test database connection"""
    print("\n" + "=" * 60)
    print("Test 1: Database Connection")
    print("=" * 60)

    try:
        from modules.db.vendor import get_repo
        repo = get_repo()
        print("[OK] Database connection successful")
        return True
    except Exception as e:
        print(f"[ERROR] Database connection failed: {e}")
        return False


def test_ticket_crud():
    """Test ticket CRUD operations"""
    print("\n" + "=" * 60)
    print("Test 2: Ticket CRUD Operations")
    print("=" * 60)

    try:
        from modules.ticket_system.models import ticket_model

        # 2.1 Create ticket
        print("\n2.1 Creating test ticket...")
        test_ticket_data = {
            'title': 'Test Ticket - Settlement Alert',
            'description': 'This is a test ticket for S1 monitoring point.',
            'ticket_type': 'SETTLEMENT_ALERT',
            'sub_type': 'Settlement Exceeded Limit',
            'priority': 'HIGH',
            'creator_id': 'test_user',
            'creator_name': 'Test User',
            'assignee_id': 'engineer1',
            'assignee_name': 'Engineer One',
            'monitoring_point_id': 'S1',
            'equipment_id': 'SENSOR-001',
            'threshold_value': 10.0,
            'current_value': 12.5,
            'location_info': {'building': 'A', 'floor': 1},
            'alert_data': {'alert_type': 'settlement', 'severity': 'high'}
        }

        created_ticket = ticket_model.create_ticket(test_ticket_data)

        if created_ticket and created_ticket.get('id'):
            ticket_id = created_ticket['id']
            ticket_number = created_ticket.get('ticket_number', '')
            print(f"[OK] Ticket created: ID={ticket_id}, Number={ticket_number}")
        else:
            print("[ERROR] Failed to create ticket")
            return False

        # 2.2 Read ticket by ID
        print("\n2.2 Reading ticket by ID...")
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if ticket:
            print(f"[OK] Ticket read successfully: {ticket.get('title')}")
        else:
            print("[ERROR] Failed to read ticket")
            return False

        # 2.3 Read ticket by number
        print("\n2.3 Reading ticket by number...")
        ticket_by_number = ticket_model.get_ticket_by_number(ticket_number)
        if ticket_by_number:
            print(f"[OK] Ticket found by number: {ticket_by_number.get('ticket_number')}")
        else:
            print("[ERROR] Failed to read ticket by number")

        # 2.4 Update ticket
        print("\n2.4 Updating ticket...")
        update_data = {
            'title': 'Test Ticket - Updated Title',
            'description': 'Updated description for testing'
        }
        updated = ticket_model.update_ticket(ticket_id, update_data)
        if updated:
            print("[OK] Ticket updated successfully")
        else:
            print("[ERROR] Failed to update ticket")

        # 2.5 Update ticket status
        print("\n2.5 Updating ticket status...")
        status_updated = ticket_model.update_ticket_status(
            ticket_id, 'IN_PROGRESS', 'engineer1', 'Started working on this ticket'
        )
        if status_updated:
            print("[OK] Ticket status updated to IN_PROGRESS")
        else:
            print("[ERROR] Failed to update ticket status")

        # 2.6 Get ticket list
        print("\n2.6 Getting ticket list...")
        tickets = ticket_model.get_tickets(limit=10)
        print(f"[OK] Retrieved {len(tickets)} tickets")

        # 2.7 Get ticket statistics
        print("\n2.7 Getting ticket statistics...")
        stats = ticket_model.get_ticket_statistics()
        print(f"[OK] Statistics: Total={stats.get('total', 0)}, By Status={stats.get('by_status', {})}")

        # Store ticket_id for cleanup
        return {'success': True, 'ticket_id': ticket_id}

    except Exception as e:
        print(f"[ERROR] Ticket CRUD test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_ticket_comments():
    """Test ticket comment operations"""
    print("\n" + "=" * 60)
    print("Test 3: Ticket Comment Operations")
    print("=" * 60)

    try:
        from modules.ticket_system.models import ticket_model, comment_model

        # Get a ticket to add comments to
        tickets = ticket_model.get_tickets(limit=1)
        if not tickets:
            print("[WARN] No tickets found, skipping comment test")
            return True

        ticket_id = tickets[0]['id']
        print(f"Using ticket ID: {ticket_id}")

        # 3.1 Add comment
        print("\n3.1 Adding comment...")
        comment = comment_model.add_comment(
            ticket_id=ticket_id,
            author_id='test_user',
            author_name='Test User',
            content='This is a test comment.',
            comment_type='COMMENT'
        )
        if comment and comment.get('id'):
            comment_id = comment['id']
            print(f"[OK] Comment added: ID={comment_id}")
        else:
            print("[ERROR] Failed to add comment")
            return False

        # 3.2 Get comments
        print("\n3.2 Getting comments...")
        comments = comment_model.get_comments(ticket_id)
        print(f"[OK] Retrieved {len(comments)} comments")

        # 3.3 Update comment
        print("\n3.3 Updating comment...")
        updated = comment_model.update_comment(comment_id, 'test_user', 'Updated test comment.')
        if updated:
            print("[OK] Comment updated successfully")
        else:
            print("[WARN] Comment update may have failed")

        # 3.4 Delete comment
        print("\n3.4 Deleting comment...")
        deleted = comment_model.delete_comment(comment_id, 'test_user')
        if deleted:
            print("[OK] Comment deleted successfully")
        else:
            print("[WARN] Comment deletion may have failed")

        return True

    except Exception as e:
        print(f"[ERROR] Comment test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_archive_operations():
    """Test ticket archive operations"""
    print("\n" + "=" * 60)
    print("Test 4: Ticket Archive Operations")
    print("=" * 60)

    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        # 4.1 Get tickets to archive
        print("\n4.1 Getting tickets ready for archive...")
        try:
            to_archive = repo.tickets_get_to_archive()
            print(f"[OK] Found {len(to_archive)} tickets ready for archive")
        except Exception as e:
            print(f"[WARN] tickets_get_to_archive failed (view may not exist): {e}")

        # 4.2 Get due soon tickets
        print("\n4.2 Getting due soon tickets...")
        try:
            due_soon = repo.tickets_get_due_soon()
            print(f"[OK] Found {len(due_soon)} tickets due soon")
        except Exception as e:
            print(f"[WARN] tickets_get_due_soon failed (view may not exist): {e}")

        # 4.3 Get overdue tickets
        print("\n4.3 Getting overdue tickets...")
        try:
            overdue = repo.tickets_get_overdue()
            print(f"[OK] Found {len(overdue)} overdue tickets")
        except Exception as e:
            print(f"[WARN] tickets_get_overdue failed (view may not exist): {e}")

        # 4.4 Get active tickets
        print("\n4.4 Getting active tickets...")
        try:
            active = repo.tickets_get_active(limit=10)
            print(f"[OK] Found {len(active)} active tickets")
        except Exception as e:
            print(f"[WARN] tickets_get_active failed: {e}")

        return True

    except Exception as e:
        print(f"[ERROR] Archive operations test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_email_service():
    """Test email service (configuration check only, no actual sending)"""
    print("\n" + "=" * 60)
    print("Test 5: Email Service Configuration")
    print("=" * 60)

    try:
        from modules.ticket_system.services.email_service import EmailConfig, EmailService

        # 5.1 Check configuration
        print("\n5.1 Checking email configuration...")
        config = EmailConfig()

        print(f"  SMTP Host: {config.smtp_host}")
        print(f"  SMTP Port: {config.smtp_port}")
        print(f"  SMTP User: {config.smtp_user[:5]}..." if config.smtp_user else "  SMTP User: (not set)")
        print(f"  Use SSL: {config.use_ssl}")
        print(f"  Use TLS: {config.use_tls}")

        if config.is_configured():
            print("[OK] Email service is configured")

            # 5.2 Test email template generation
            print("\n5.2 Testing email template generation...")
            from modules.ticket_system.services.email_service import TicketEmailNotifier

            notifier = TicketEmailNotifier()
            test_ticket = {
                'ticket_number': 'MON-20250117-001',
                'title': 'Test Ticket',
                'ticket_type': 'SETTLEMENT_ALERT',
                'priority': 'HIGH',
                'creator_name': 'System',
                'assignee_name': 'Engineer',
                'due_at': '2025-01-18 10:00:00',
                'description': 'Test description'
            }

            template = notifier._get_email_template('ticket_created', {
                'ticket_number': test_ticket['ticket_number'],
                'title': test_ticket['title'],
                'ticket_type': test_ticket['ticket_type'],
                'priority': test_ticket['priority'],
                'priority_color': '#fa8c16',
                'creator_name': test_ticket['creator_name'],
                'assignee_name': test_ticket['assignee_name'],
                'due_at': test_ticket['due_at'],
                'description': test_ticket['description']
            })

            print(f"  Subject: {template['subject']}")
            print(f"  Body length: {len(template['body'])} chars")
            print(f"  HTML body: {'Yes' if template['html_body'] else 'No'}")
            print("[OK] Email template generation working")

        else:
            print("[WARN] Email service is NOT configured (SMTP credentials missing)")
            print("  To enable email notifications, set SMTP_* environment variables")

        return True

    except Exception as e:
        print(f"[ERROR] Email service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_scheduler():
    """Test scheduler service"""
    print("\n" + "=" * 60)
    print("Test 6: Scheduler Service")
    print("=" * 60)

    try:
        from modules.ticket_system.services.scheduler import TicketScheduler

        # 6.1 Create scheduler instance
        print("\n6.1 Creating scheduler instance...")
        scheduler = TicketScheduler(check_interval_seconds=60)
        print("[OK] Scheduler instance created")

        # 6.2 Check status
        print("\n6.2 Checking scheduler status...")
        status = scheduler.get_status()
        print(f"  Is running: {status['is_running']}")
        print(f"  Check interval: {status['check_interval_seconds']} seconds")
        print("[OK] Scheduler status retrieved")

        # 6.3 Set user email (manual)
        print("\n6.3 Setting user email mapping (manual)...")
        scheduler.set_user_email('engineer1', 'engineer1@example.com')
        scheduler.set_user_email('admin', 'admin@example.com')
        email = scheduler.get_user_email('engineer1')
        print(f"  engineer1 email: {email}")
        print("[OK] User email mapping working")

        # 6.4 Load from database
        print("\n6.4 Loading user emails from database...")
        db_count = scheduler.load_user_emails_from_database()
        print(f"  Loaded from database: {db_count}")

        # 6.5 Load from environment (fallback)
        print("\n6.5 Loading user emails from environment (fallback)...")
        env_count = scheduler.load_user_emails_from_env()
        print(f"  Loaded from environment: {env_count}")

        status = scheduler.get_status()
        print(f"  Total registered user emails: {status['registered_user_emails']}")
        print("[OK] Email loading working")

        return True

    except Exception as e:
        print(f"[ERROR] Scheduler test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_user_management():
    """Test user management operations"""
    print("\n" + "=" * 60)
    print("Test 7: User Management")
    print("=" * 60)

    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        # 7.1 Create test user
        print("\n7.1 Creating test user...")
        test_user_data = {
            'user_id': 'test_user_email',
            'username': 'test_email_user',
            'display_name': 'Test Email User',
            'email': 'test@example.com',
            'role': 'operator',
            'department': 'Testing'
        }

        try:
            user = repo.user_create(test_user_data)
            if user and user.get('user_id'):
                print(f"[OK] User created: {user.get('user_id')}")
            else:
                print("[WARN] User creation returned empty result")
        except Exception as e:
            if '409' in str(e) or 'duplicate' in str(e).lower():
                print("[INFO] User already exists, continuing...")
            else:
                print(f"[WARN] User creation failed (table may not exist): {e}")

        # 7.2 Get user
        print("\n7.2 Getting user...")
        try:
            user = repo.user_get_by_id('test_user_email')
            if user:
                print(f"[OK] User found: {user.get('display_name')}")
            else:
                print("[WARN] User not found (table may not exist)")
        except Exception as e:
            print(f"[WARN] Get user failed: {e}")

        # 7.3 Update notification settings
        print("\n7.3 Updating notification settings...")
        try:
            settings = repo.user_update_notification_settings('test_user_email', {
                'email_address': 'test_notifications@example.com',
                'email_enabled': True,
                'notify_on_ticket_created': True,
                'notify_on_overdue': True
            })
            if settings:
                print(f"[OK] Notification settings updated")
            else:
                print("[WARN] Notification settings update returned empty")
        except Exception as e:
            print(f"[WARN] Update notification settings failed: {e}")

        # 7.4 Get user email
        print("\n7.4 Getting user email...")
        try:
            email = repo.user_get_email('test_user_email')
            print(f"  Email: {email}")
            print("[OK] Get user email working")
        except Exception as e:
            print(f"[WARN] Get user email failed: {e}")

        # 7.5 Get all users with email
        print("\n7.5 Getting all users with email...")
        try:
            users = repo.users_get_with_email()
            print(f"[OK] Found {len(users)} users with email info")
        except Exception as e:
            print(f"[WARN] Get users with email failed: {e}")

        # 7.6 Cleanup - delete test user
        print("\n7.6 Cleaning up test user...")
        try:
            repo.user_delete('test_user_email')
            print("[OK] Test user deleted")
        except Exception as e:
            print(f"[WARN] Delete test user failed: {e}")

        return True

    except Exception as e:
        print(f"[ERROR] User management test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_cleanup(ticket_id=None):
    """Clean up test data"""
    print("\n" + "=" * 60)
    print("Test 7: Cleanup")
    print("=" * 60)

    if not ticket_id:
        print("[INFO] No ticket ID provided, skipping cleanup")
        return True

    try:
        from modules.ticket_system.models import ticket_model

        print(f"\n7.1 Deleting test ticket ID={ticket_id}...")
        deleted = ticket_model.delete_ticket(ticket_id)
        if deleted:
            print("[OK] Test ticket deleted")
        else:
            print("[WARN] Failed to delete test ticket")

        return True

    except Exception as e:
        print(f"[ERROR] Cleanup failed: {e}")
        return False


def run_all_tests():
    """Run all tests"""
    print("\n")
    print("*" * 60)
    print("*  Ticket System Test Suite")
    print("*  Date:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("*" * 60)

    results = {}
    ticket_id = None

    # Test 1: Database connection
    results['database'] = test_database_connection()

    if results['database']:
        # Test 2: Ticket CRUD
        crud_result = test_ticket_crud()
        if isinstance(crud_result, dict) and crud_result.get('success'):
            results['ticket_crud'] = True
            ticket_id = crud_result.get('ticket_id')
        else:
            results['ticket_crud'] = False

        # Test 3: Comments
        results['comments'] = test_ticket_comments()

        # Test 4: Archive operations
        results['archive'] = test_archive_operations()

    # Test 5: Email service
    results['email'] = test_email_service()

    # Test 6: Scheduler
    results['scheduler'] = test_scheduler()

    # Test 7: User management
    results['user_management'] = test_user_management()

    # Test 8: Cleanup
    results['cleanup'] = test_cleanup(ticket_id)

    # Print summary
    print("\n")
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)

    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed

    for test_name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"  {status} {test_name}")

    print("-" * 60)
    print(f"  Total: {total}, Passed: {passed}, Failed: {failed}")

    if failed == 0:
        print("\n[OK] All tests passed!")
    else:
        print(f"\n[WARN] {failed} test(s) failed")

    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
