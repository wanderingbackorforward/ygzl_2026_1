-- -*- coding: utf-8 -*-
-- Supabase/PostgreSQL DDL for Tickets System
-- Author: Claude Code
-- Description: Real ticket system with proper database schema

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS ticket_archive CASCADE;

-- =====================================================
-- Table: tickets (Main ticket table)
-- =====================================================
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Type and classification
    ticket_type VARCHAR(50) NOT NULL,
    sub_type VARCHAR(100),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    -- User info
    creator_id VARCHAR(100) NOT NULL,
    creator_name VARCHAR(100),
    assignee_id VARCHAR(100),
    assignee_name VARCHAR(100),

    -- Association with monitoring system
    monitoring_point_id VARCHAR(50),
    location_info JSONB,
    equipment_id VARCHAR(50),

    -- Alert-related data
    threshold_value NUMERIC,
    current_value NUMERIC,
    alert_data JSONB DEFAULT '{}',

    -- SLA and timeline
    due_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,

    -- Attachments and metadata
    attachment_paths JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Archive flag (for soft delete / archive)
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_ticket_type ON tickets(ticket_type);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_creator_id ON tickets(creator_id);
CREATE INDEX idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX idx_tickets_monitoring_point_id ON tickets(monitoring_point_id);
CREATE INDEX idx_tickets_equipment_id ON tickets(equipment_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_due_at ON tickets(due_at);
CREATE INDEX idx_tickets_is_archived ON tickets(is_archived);

-- =====================================================
-- Table: ticket_comments
-- =====================================================
CREATE TABLE ticket_comments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,

    -- Author info
    author_id VARCHAR(100) NOT NULL,
    author_name VARCHAR(100),

    -- Content
    content TEXT NOT NULL,
    comment_type VARCHAR(30) DEFAULT 'COMMENT',

    -- Attachments
    attachment_paths JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_author_id ON ticket_comments(author_id);
CREATE INDEX idx_ticket_comments_created_at ON ticket_comments(created_at);

-- =====================================================
-- Table: ticket_archive (Archive table for old tickets)
-- =====================================================
CREATE TABLE ticket_archive (
    id BIGSERIAL PRIMARY KEY,
    original_id BIGINT NOT NULL,
    ticket_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ticket_type VARCHAR(50) NOT NULL,
    sub_type VARCHAR(100),
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,

    creator_id VARCHAR(100) NOT NULL,
    creator_name VARCHAR(100),
    assignee_id VARCHAR(100),
    assignee_name VARCHAR(100),

    monitoring_point_id VARCHAR(50),
    location_info JSONB,
    equipment_id VARCHAR(50),

    threshold_value NUMERIC,
    current_value NUMERIC,
    alert_data JSONB,

    due_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,

    attachment_paths JSONB,
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Store comments as JSON for archive
    comments_snapshot JSONB DEFAULT '[]'
);

CREATE INDEX idx_ticket_archive_archived_at ON ticket_archive(archived_at DESC);
CREATE INDEX idx_ticket_archive_ticket_number ON ticket_archive(ticket_number);

-- =====================================================
-- Function: auto_update_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tickets
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to ticket_comments
DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
-- Enable RLS on tables
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_archive ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write for now (adjust as needed)
CREATE POLICY "Allow anonymous access to tickets" ON tickets
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to ticket_comments" ON ticket_comments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to ticket_archive" ON ticket_archive
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- View: v_tickets_with_stats (Useful view for statistics)
-- =====================================================
CREATE OR REPLACE VIEW v_tickets_active AS
SELECT
    t.*,
    CASE
        WHEN t.due_at IS NOT NULL AND t.due_at < NOW() AND t.status NOT IN ('CLOSED', 'RESOLVED', 'REJECTED')
        THEN TRUE
        ELSE FALSE
    END AS is_overdue,
    EXTRACT(EPOCH FROM (t.due_at - NOW()))/3600 AS hours_until_due
FROM tickets t
WHERE t.is_archived = FALSE;

-- =====================================================
-- View: v_tickets_due_soon (Tickets due within 24 hours)
-- =====================================================
CREATE OR REPLACE VIEW v_tickets_due_soon AS
SELECT * FROM tickets
WHERE is_archived = FALSE
  AND status NOT IN ('CLOSED', 'RESOLVED', 'REJECTED')
  AND due_at IS NOT NULL
  AND due_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours';

-- =====================================================
-- View: v_tickets_overdue (Overdue tickets)
-- =====================================================
CREATE OR REPLACE VIEW v_tickets_overdue AS
SELECT * FROM tickets
WHERE is_archived = FALSE
  AND status NOT IN ('CLOSED', 'RESOLVED', 'REJECTED')
  AND due_at IS NOT NULL
  AND due_at < NOW();

-- =====================================================
-- View: v_tickets_to_archive (Tickets ready for archive)
-- =====================================================
CREATE OR REPLACE VIEW v_tickets_to_archive AS
SELECT * FROM tickets
WHERE is_archived = FALSE
  AND status IN ('CLOSED', 'REJECTED')
  AND updated_at < NOW() - INTERVAL '7 days';

-- Success message
SELECT 'Tickets database schema created successfully!' as message;
