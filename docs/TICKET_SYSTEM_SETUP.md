# Ticket System Setup Guide

## Overview

This document describes how to set up and configure the ticket system for the Terrain Settlement Monitoring project.

## Features

1. **Real Database Operations**: Full CRUD operations with Supabase/PostgreSQL
2. **Multi-user Support**: User management with role-based permissions
3. **Email Notifications**: SMTP email service for ticket events
4. **Due Date Reminders**: Automatic reminders for tickets due within 24 hours
5. **Overdue Alerts**: Notifications for overdue tickets
6. **Auto-archiving**: Automatic archival of completed tickets after 7 days
7. **Monitoring Point Integration**: Associate tickets with S1-S4 monitoring points

## Database Setup

### Step 1: Create Tables in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL files in order:

**File 1: `supabase/sql/01_tickets.sql`**
- Creates `tickets` table
- Creates `ticket_comments` table
- Creates `ticket_archive` table
- Creates views: `v_tickets_active`, `v_tickets_due_soon`, `v_tickets_overdue`, `v_tickets_to_archive`

**File 2: `supabase/sql/02_users.sql`**
- Creates `system_users` table
- Creates `user_notification_settings` table
- Creates view: `v_users_with_email`
- Inserts default users

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Supabase Configuration (already configured)
DB_VENDOR=supabase_http
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key

# SMTP Email Configuration
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your-email@qq.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=your-email@qq.com
SMTP_FROM_NAME=Monitoring System
SMTP_USE_SSL=true
SMTP_USE_TLS=false
```

### Step 3: Add Users and Their Emails

Option A: Through SQL (recommended for initial setup):
```sql
-- Insert user
INSERT INTO system_users (user_id, username, display_name, email, role, department)
VALUES ('yangn497', 'yangn497', 'Yang', 'yangn497@gmail.com', 'admin', 'System');

-- Insert notification settings
INSERT INTO user_notification_settings (user_id, email_address, email_enabled)
VALUES ('yangn497', 'yangn497@gmail.com', true);
```

Option B: Through API:
```bash
# Create user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "yangn497",
    "username": "yangn497",
    "display_name": "Yang",
    "email": "yangn497@gmail.com",
    "role": "admin",
    "department": "System"
  }'

# Update notification settings
curl -X PUT http://localhost:5000/api/users/yangn497/notification-settings \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "yangn497@gmail.com",
    "email_enabled": true,
    "notify_on_ticket_created": true,
    "notify_on_ticket_assigned": true,
    "notify_on_due_soon": true,
    "notify_on_overdue": true
  }'
```

## API Endpoints

### Ticket Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | Get ticket list with filters |
| POST | `/api/tickets` | Create new ticket |
| GET | `/api/tickets/<id>` | Get ticket details |
| PUT | `/api/tickets/<id>` | Update ticket |
| DELETE | `/api/tickets/<id>` | Delete ticket |
| PUT | `/api/tickets/<id>/status` | Update ticket status |
| PUT | `/api/tickets/<id>/assign` | Assign ticket |
| GET | `/api/tickets/<id>/comments` | Get ticket comments |
| POST | `/api/tickets/<id>/comments` | Add comment |
| POST | `/api/tickets/alert-trigger` | Create ticket from alert |
| GET | `/api/tickets/statistics` | Get ticket statistics |
| GET | `/api/tickets/active` | Get active (non-archived) tickets |
| GET | `/api/tickets/due-soon` | Get tickets due within 24 hours |
| GET | `/api/tickets/overdue` | Get overdue tickets |
| GET | `/api/tickets/archive` | Get archived tickets |
| POST | `/api/tickets/<id>/archive` | Archive a ticket |
| POST | `/api/tickets/archive/auto` | Auto-archive eligible tickets |
| GET | `/api/tickets/scheduler/status` | Get scheduler status |
| POST | `/api/tickets/scheduler/run` | Manually trigger scheduler |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| POST | `/api/users` | Create user |
| GET | `/api/users/<user_id>` | Get user details |
| PUT | `/api/users/<user_id>` | Update user |
| DELETE | `/api/users/<user_id>` | Delete user (soft) |
| GET | `/api/users/<user_id>/notification-settings` | Get notification settings |
| PUT | `/api/users/<user_id>/notification-settings` | Update notification settings |
| GET | `/api/users/<user_id>/email` | Get user email |
| GET | `/api/users/with-email` | Get all users with emails |
| GET | `/api/users/by-role/<role>` | Get users by role |

## Ticket Data Structure

```json
{
  "id": 1,
  "ticket_number": "MON-20250117-ABC123",
  "title": "Settlement Alert - S1",
  "description": "Settlement exceeded threshold",
  "ticket_type": "SETTLEMENT_ALERT",
  "sub_type": "Settlement Exceeded Limit",
  "priority": "HIGH",
  "status": "PENDING",
  "creator_id": "system",
  "creator_name": "System Auto",
  "assignee_id": "engineer1",
  "assignee_name": "Engineer One",
  "monitoring_point_id": "S1",
  "equipment_id": "SENSOR-001",
  "threshold_value": 10.0,
  "current_value": 12.5,
  "due_at": "2025-01-18T10:00:00",
  "created_at": "2025-01-17T08:00:00",
  "updated_at": "2025-01-17T08:00:00"
}
```

## Ticket Types

- `SETTLEMENT_ALERT` - Settlement warnings (SLA: 2 hours)
- `CRACK_ALERT` - Crack warnings (SLA: 3 hours)
- `EQUIPMENT_FAULT` - Equipment failures (SLA: 4 hours)
- `MAINTENANCE` - Maintenance tasks (SLA: 24 hours)
- `INSPECTION` - Inspection tasks (SLA: 8 hours)
- `DATA_ANALYSIS` - Data analysis tasks (SLA: 12 hours)

## Ticket Status Flow

```
PENDING -> IN_PROGRESS -> RESOLVED -> CLOSED
    |          |
    v          v
REJECTED   SUSPENDED -> IN_PROGRESS
```

## User Roles

- `admin` - Full access
- `monitoring_engineer` - Create, view all, handle, assign
- `field_technician` - Handle assigned tickets
- `data_analyst` - Create, view, analyze
- `operator` - Create, view own

## Email Notification Events

1. **Ticket Created** - Sent to assignee when ticket is created
2. **Ticket Assigned** - Sent to assignee when ticket is assigned
3. **Status Changed** - Sent to creator when status changes
4. **Due Soon Reminder** - Sent to assignee 24 hours before due date
5. **Overdue Alert** - Sent to assignee when ticket becomes overdue

## Starting the Scheduler

The scheduler runs automatically when the API server starts. To manually control it:

```python
from modules.ticket_system.services import start_scheduler, stop_scheduler

# Start scheduler (loads user emails from database)
start_scheduler()

# Stop scheduler
stop_scheduler()
```

## Testing

Run the test suite:

```bash
cd python_scripts
python tests/test_ticket_system.py
```

## Troubleshooting

### 404 Errors for Views
Run the SQL scripts in Supabase to create the views.

### 409 Conflict on Ticket Creation
The ticket number already exists. The system now uses UUID-based unique suffixes to prevent this.

### Email Not Sending
1. Check SMTP configuration in `.env`
2. Verify user has email configured in `user_notification_settings`
3. Check `email_enabled` is `true`

### User Email Not Found
1. Create user in `system_users` table
2. Add email to `user_notification_settings` table
3. Or set email directly in `system_users.email` field
