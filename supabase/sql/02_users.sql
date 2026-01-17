-- -*- coding: utf-8 -*-
-- Supabase/PostgreSQL DDL for Users and Notification Settings
-- Author: Claude Code
-- Description: User management with email notifications support

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS user_notification_settings CASCADE;
DROP TABLE IF EXISTS system_users CASCADE;

-- =====================================================
-- Table: system_users (System user accounts)
-- =====================================================
CREATE TABLE system_users (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),

    -- Contact information
    email VARCHAR(255),
    phone VARCHAR(50),

    -- Role and permissions
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    permissions JSONB DEFAULT '[]',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Department/Team info
    department VARCHAR(100),
    team VARCHAR(100),

    -- Metadata
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_system_users_user_id ON system_users(user_id);
CREATE INDEX idx_system_users_email ON system_users(email);
CREATE INDEX idx_system_users_role ON system_users(role);
CREATE INDEX idx_system_users_is_active ON system_users(is_active);

-- =====================================================
-- Table: user_notification_settings
-- =====================================================
CREATE TABLE user_notification_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES system_users(user_id) ON DELETE CASCADE,

    -- Notification channels
    email_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    webhook_enabled BOOLEAN DEFAULT FALSE,

    -- Email settings
    email_address VARCHAR(255),
    email_frequency VARCHAR(20) DEFAULT 'realtime',

    -- Notification types to receive
    notify_on_ticket_created BOOLEAN DEFAULT TRUE,
    notify_on_ticket_assigned BOOLEAN DEFAULT TRUE,
    notify_on_status_change BOOLEAN DEFAULT TRUE,
    notify_on_comment BOOLEAN DEFAULT TRUE,
    notify_on_due_soon BOOLEAN DEFAULT TRUE,
    notify_on_overdue BOOLEAN DEFAULT TRUE,

    -- Quiet hours (optional)
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',

    -- Webhook settings
    webhook_url TEXT,
    webhook_secret VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_user_notification_settings_user_id ON user_notification_settings(user_id);

-- =====================================================
-- Trigger: auto_update_updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_system_users_updated_at ON system_users;
CREATE TRIGGER update_system_users_updated_at
    BEFORE UPDATE ON system_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
    BEFORE UPDATE ON user_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (adjust as needed for production)
CREATE POLICY "Allow anonymous access to system_users" ON system_users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to user_notification_settings" ON user_notification_settings
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- View: v_users_with_email (Users with their notification email)
-- =====================================================
CREATE OR REPLACE VIEW v_users_with_email AS
SELECT
    u.id,
    u.user_id,
    u.username,
    u.display_name,
    u.email AS primary_email,
    u.role,
    u.department,
    u.team,
    u.is_active,
    COALESCE(n.email_address, u.email) AS notification_email,
    n.email_enabled,
    n.notify_on_ticket_created,
    n.notify_on_ticket_assigned,
    n.notify_on_status_change,
    n.notify_on_due_soon,
    n.notify_on_overdue
FROM system_users u
LEFT JOIN user_notification_settings n ON u.user_id = n.user_id
WHERE u.is_active = TRUE;

-- =====================================================
-- Insert default users (examples - customize as needed)
-- =====================================================
INSERT INTO system_users (user_id, username, display_name, email, role, department) VALUES
    ('admin', 'admin', 'System Administrator', NULL, 'admin', 'IT'),
    ('system', 'system', 'System Auto', NULL, 'system', 'System'),
    ('monitoring_engineer', 'engineer1', 'Monitoring Engineer 1', NULL, 'monitoring_engineer', 'Monitoring'),
    ('field_technician', 'tech1', 'Field Technician 1', NULL, 'field_technician', 'Field'),
    ('data_analyst', 'analyst1', 'Data Analyst 1', NULL, 'data_analyst', 'Analysis')
ON CONFLICT (user_id) DO NOTHING;

-- Insert default notification settings
INSERT INTO user_notification_settings (user_id, email_enabled, email_address)
SELECT user_id, TRUE, email FROM system_users WHERE user_id IN ('admin', 'monitoring_engineer', 'field_technician', 'data_analyst')
ON CONFLICT (user_id) DO NOTHING;

-- Success message
SELECT 'Users and notification settings tables created successfully!' as message;
