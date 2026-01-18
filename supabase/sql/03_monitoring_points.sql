-- -*- coding: utf-8 -*-
-- Supabase/PostgreSQL DDL for Monitoring Points System
-- Author: Claude Code
-- Description: Core monitoring points and raw data tables for construction site

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS metric_snapshots CASCADE;
DROP TABLE IF EXISTS engineering_metrics CASCADE;
DROP TABLE IF EXISTS raw_data CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS metric_configs CASCADE;
DROP TABLE IF EXISTS monitoring_points CASCADE;

-- =====================================================
-- Table: monitoring_points (all monitoring locations)
-- =====================================================
CREATE TABLE monitoring_points (
    id BIGSERIAL PRIMARY KEY,
    point_id VARCHAR(50) UNIQUE NOT NULL,
    point_name VARCHAR(200) NOT NULL,

    -- Type classification
    -- settlement: settlement monitoring
    -- crack: crack monitoring
    -- temperature: temperature monitoring
    -- vibration: vibration monitoring
    point_type VARCHAR(50) NOT NULL,

    -- Location coordinates
    coord_x NUMERIC(12, 4),
    coord_y NUMERIC(12, 4),
    coord_z NUMERIC(12, 4),
    location_description TEXT,

    -- Installation info
    installed_at TIMESTAMP WITH TIME ZONE,
    installation_notes TEXT,

    -- Status: active / inactive / maintenance / fault
    status VARCHAR(30) NOT NULL DEFAULT 'active',

    -- Associated equipment
    equipment_id VARCHAR(100),
    equipment_type VARCHAR(100),
    equipment_model VARCHAR(200),

    -- Responsible person
    responsible_person_id VARCHAR(100),
    responsible_person_name VARCHAR(100),

    -- Thresholds for this point (override global config)
    threshold_config JSONB DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_monitoring_points_point_id ON monitoring_points(point_id);
CREATE INDEX idx_monitoring_points_point_type ON monitoring_points(point_type);
CREATE INDEX idx_monitoring_points_status ON monitoring_points(status);
CREATE INDEX idx_monitoring_points_equipment_id ON monitoring_points(equipment_id);

-- =====================================================
-- Table: raw_data (original sensor readings - Layer 1)
-- =====================================================
CREATE TABLE raw_data (
    id BIGSERIAL PRIMARY KEY,

    -- Reference to monitoring point
    point_id VARCHAR(50) NOT NULL REFERENCES monitoring_points(point_id) ON DELETE CASCADE,

    -- Timestamp of measurement
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Raw sensor value
    raw_value NUMERIC(16, 6) NOT NULL,
    unit VARCHAR(20),

    -- Data source: auto / manual / import
    data_source VARCHAR(30) NOT NULL DEFAULT 'auto',

    -- Who/what collected the data
    collector_id VARCHAR(100),
    collector_name VARCHAR(100),
    device_id VARCHAR(100),

    -- Data quality: valid / invalid / pending / suspicious
    quality_flag VARCHAR(30) NOT NULL DEFAULT 'valid',
    quality_score NUMERIC(3, 2),

    -- Additional sensor info (device status, environment params, etc.)
    sensor_info JSONB DEFAULT '{}',

    -- Batch import tracking
    import_batch_id VARCHAR(100),
    import_source VARCHAR(200),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique measurement per point per time
    UNIQUE(point_id, measured_at)
);

-- Create indexes for common queries
CREATE INDEX idx_raw_data_point_id ON raw_data(point_id);
CREATE INDEX idx_raw_data_measured_at ON raw_data(measured_at DESC);
CREATE INDEX idx_raw_data_point_measured ON raw_data(point_id, measured_at DESC);
CREATE INDEX idx_raw_data_quality_flag ON raw_data(quality_flag);
CREATE INDEX idx_raw_data_data_source ON raw_data(data_source);
CREATE INDEX idx_raw_data_import_batch ON raw_data(import_batch_id);

-- =====================================================
-- Table: metric_configs (configuration for metrics)
-- =====================================================
CREATE TABLE metric_configs (
    id BIGSERIAL PRIMARY KEY,

    -- Metric identification
    metric_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(200) NOT NULL,
    metric_description TEXT,

    -- Applicable point types
    applicable_point_types JSONB DEFAULT '["settlement", "crack", "temperature", "vibration"]',

    -- Calculation method: difference / regression / average / cumulative / custom
    calculation_method VARCHAR(50) NOT NULL,

    -- Formula or calculation parameters
    formula TEXT,
    calculation_params JSONB DEFAULT '{}',

    -- Unit of the metric
    unit VARCHAR(50),

    -- Default thresholds
    warning_threshold NUMERIC,
    critical_threshold NUMERIC,
    threshold_direction VARCHAR(10) DEFAULT 'above',

    -- Data requirements
    min_data_points INTEGER DEFAULT 1,
    time_window_hours INTEGER,

    -- Update settings
    update_frequency VARCHAR(50) DEFAULT 'on_data',

    -- Status: active / inactive / deprecated
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(metric_type)
);

-- Create indexes
CREATE INDEX idx_metric_configs_metric_type ON metric_configs(metric_type);
CREATE INDEX idx_metric_configs_calculation_method ON metric_configs(calculation_method);
CREATE INDEX idx_metric_configs_is_active ON metric_configs(is_active);

-- =====================================================
-- Table: engineering_metrics (computed metrics - Layer 2)
-- =====================================================
CREATE TABLE engineering_metrics (
    id BIGSERIAL PRIMARY KEY,

    -- Reference to monitoring point
    point_id VARCHAR(50) NOT NULL REFERENCES monitoring_points(point_id) ON DELETE CASCADE,

    -- Metric type from config
    metric_type VARCHAR(100) NOT NULL,

    -- Computed value
    computed_value NUMERIC(16, 6) NOT NULL,
    unit VARCHAR(50),

    -- Threshold status: normal / warning / critical
    threshold_status VARCHAR(30) NOT NULL DEFAULT 'normal',

    -- Calculation timestamp
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Calculation method used
    calculation_method VARCHAR(50),

    -- Complete calculation chain for traceability
    calculation_params JSONB DEFAULT '{}',

    -- Data source info: which raw_data was used
    data_source_table VARCHAR(100) DEFAULT 'raw_data',
    data_range_start TIMESTAMP WITH TIME ZONE,
    data_range_end TIMESTAMP WITH TIME ZONE,
    data_point_count INTEGER,

    -- Quality assessment
    quality_score NUMERIC(3, 2),

    -- Verification status: pending / verified / rejected
    verification_status VARCHAR(30) DEFAULT 'pending',
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Link to previous metric for trend analysis
    previous_metric_id BIGINT REFERENCES engineering_metrics(id),
    change_from_previous NUMERIC(16, 6),
    change_percentage NUMERIC(8, 4),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_engineering_metrics_point_id ON engineering_metrics(point_id);
CREATE INDEX idx_engineering_metrics_metric_type ON engineering_metrics(metric_type);
CREATE INDEX idx_engineering_metrics_calculated_at ON engineering_metrics(calculated_at DESC);
CREATE INDEX idx_engineering_metrics_point_metric ON engineering_metrics(point_id, metric_type, calculated_at DESC);
CREATE INDEX idx_engineering_metrics_threshold_status ON engineering_metrics(threshold_status);
CREATE INDEX idx_engineering_metrics_verification ON engineering_metrics(verification_status);

-- =====================================================
-- Table: alert_rules (automatic alert triggering rules)
-- =====================================================
CREATE TABLE alert_rules (
    id BIGSERIAL PRIMARY KEY,

    -- Rule identification
    rule_name VARCHAR(200) NOT NULL,
    rule_description TEXT,

    -- What triggers this rule
    trigger_metric_type VARCHAR(100) NOT NULL,
    trigger_point_types JSONB DEFAULT '["settlement", "crack", "temperature", "vibration"]',
    trigger_specific_points JSONB,

    -- Condition: threshold_exceeded / rate_exceeded / trend_detected / custom
    condition_type VARCHAR(50) NOT NULL,
    condition_params JSONB NOT NULL,

    -- Action to take: create_ticket / send_notification / both
    action_type VARCHAR(50) NOT NULL DEFAULT 'create_ticket',

    -- Ticket creation settings
    ticket_type VARCHAR(50),
    ticket_priority VARCHAR(20) DEFAULT 'MEDIUM',
    default_assignee_id VARCHAR(100),
    ticket_template JSONB DEFAULT '{}',

    -- Notification settings
    notification_recipients JSONB DEFAULT '[]',
    notification_template TEXT,

    -- Cooldown to prevent alert spam (in minutes)
    cooldown_minutes INTEGER DEFAULT 60,
    last_triggered_at TIMESTAMP WITH TIME ZONE,

    -- Status: active / inactive / testing
    is_active BOOLEAN DEFAULT TRUE,

    -- Statistics
    trigger_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_alert_rules_trigger_metric ON alert_rules(trigger_metric_type);
CREATE INDEX idx_alert_rules_is_active ON alert_rules(is_active);
CREATE INDEX idx_alert_rules_condition_type ON alert_rules(condition_type);

-- =====================================================
-- Table: metric_snapshots (point-in-time data state)
-- =====================================================
CREATE TABLE metric_snapshots (
    id BIGSERIAL PRIMARY KEY,

    -- Snapshot identification
    snapshot_name VARCHAR(200),

    -- Snapshot type: manual / ticket_related / scheduled / alert_triggered
    snapshot_type VARCHAR(50) NOT NULL,

    -- Timestamp of snapshot
    snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Complete data snapshot in JSON format
    snapshot_data JSONB NOT NULL,

    -- What triggered this snapshot
    trigger_source VARCHAR(100),
    trigger_id BIGINT,

    -- Associated ticket (if any)
    ticket_id BIGINT,
    ticket_number VARCHAR(50),

    -- Scope of snapshot
    scope_description TEXT,
    included_points JSONB,
    time_range_start TIMESTAMP WITH TIME ZONE,
    time_range_end TIMESTAMP WITH TIME ZONE,

    -- Snapshot size for monitoring
    data_size_bytes BIGINT,

    -- Expiration (for automatic cleanup)
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Creator info
    created_by VARCHAR(100),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_metric_snapshots_snapshot_type ON metric_snapshots(snapshot_type);
CREATE INDEX idx_metric_snapshots_snapshot_at ON metric_snapshots(snapshot_at DESC);
CREATE INDEX idx_metric_snapshots_ticket_id ON metric_snapshots(ticket_id);
CREATE INDEX idx_metric_snapshots_ticket_number ON metric_snapshots(ticket_number);
CREATE INDEX idx_metric_snapshots_expires_at ON metric_snapshots(expires_at);

-- =====================================================
-- Triggers
-- =====================================================
DROP TRIGGER IF EXISTS update_monitoring_points_updated_at ON monitoring_points;
CREATE TRIGGER update_monitoring_points_updated_at
    BEFORE UPDATE ON monitoring_points
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_metric_configs_updated_at ON metric_configs;
CREATE TRIGGER update_metric_configs_updated_at
    BEFORE UPDATE ON metric_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
ALTER TABLE monitoring_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (adjust for production)
CREATE POLICY "Allow anonymous access to monitoring_points" ON monitoring_points
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to raw_data" ON raw_data
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to metric_configs" ON metric_configs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to engineering_metrics" ON engineering_metrics
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to alert_rules" ON alert_rules
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access to metric_snapshots" ON metric_snapshots
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Views
-- =====================================================

-- View: Active monitoring points with latest metrics
CREATE OR REPLACE VIEW v_points_with_latest_metrics AS
SELECT
    mp.*,
    lm.metric_type AS latest_metric_type,
    lm.computed_value AS latest_value,
    lm.unit AS latest_unit,
    lm.threshold_status AS latest_threshold_status,
    lm.calculated_at AS latest_calculated_at
FROM monitoring_points mp
LEFT JOIN LATERAL (
    SELECT em.*
    FROM engineering_metrics em
    WHERE em.point_id = mp.point_id
    ORDER BY em.calculated_at DESC
    LIMIT 1
) lm ON true
WHERE mp.status = 'active';

-- View: Points with alert status
CREATE OR REPLACE VIEW v_points_alert_status AS
SELECT
    mp.point_id,
    mp.point_name,
    mp.point_type,
    mp.status,
    COUNT(CASE WHEN em.threshold_status = 'warning' THEN 1 END) AS warning_count,
    COUNT(CASE WHEN em.threshold_status = 'critical' THEN 1 END) AS critical_count,
    MAX(em.calculated_at) AS last_metric_at
FROM monitoring_points mp
LEFT JOIN engineering_metrics em ON mp.point_id = em.point_id
    AND em.calculated_at > NOW() - INTERVAL '24 hours'
WHERE mp.status = 'active'
GROUP BY mp.point_id, mp.point_name, mp.point_type, mp.status;

-- View: Raw data statistics by point
CREATE OR REPLACE VIEW v_raw_data_stats AS
SELECT
    point_id,
    COUNT(*) AS total_readings,
    MIN(measured_at) AS first_reading_at,
    MAX(measured_at) AS last_reading_at,
    AVG(raw_value) AS avg_value,
    MIN(raw_value) AS min_value,
    MAX(raw_value) AS max_value,
    STDDEV(raw_value) AS stddev_value,
    COUNT(CASE WHEN quality_flag = 'valid' THEN 1 END) AS valid_count,
    COUNT(CASE WHEN quality_flag = 'invalid' THEN 1 END) AS invalid_count
FROM raw_data
GROUP BY point_id;

-- =====================================================
-- Insert default metric configurations
-- =====================================================
INSERT INTO metric_configs (metric_type, metric_name, calculation_method, unit, warning_threshold, critical_threshold, threshold_direction, applicable_point_types) VALUES
    -- Settlement metrics
    ('cumulative_settlement', 'Cumulative Settlement', 'cumulative', 'mm', 20.0, 30.0, 'above', '["settlement"]'),
    ('daily_settlement_rate', 'Daily Settlement Rate', 'difference', 'mm/day', 2.0, 5.0, 'above', '["settlement"]'),
    ('settlement_trend', 'Settlement Trend Slope', 'regression', 'mm/day', 1.0, 2.0, 'above', '["settlement"]'),

    -- Crack metrics
    ('crack_width', 'Crack Width', 'difference', 'mm', 0.3, 0.5, 'above', '["crack"]'),
    ('crack_growth_rate', 'Crack Growth Rate', 'difference', 'mm/day', 0.1, 0.2, 'above', '["crack"]'),

    -- Temperature metrics
    ('temperature_deviation', 'Temperature Deviation', 'difference', 'C', 5.0, 10.0, 'above', '["temperature"]'),
    ('temperature_gradient', 'Temperature Gradient', 'regression', 'C/hour', 2.0, 5.0, 'above', '["temperature"]'),

    -- Vibration metrics
    ('peak_vibration', 'Peak Vibration', 'difference', 'mm/s', 10.0, 25.0, 'above', '["vibration"]'),
    ('vibration_frequency', 'Vibration Frequency', 'custom', 'Hz', 50.0, 100.0, 'above', '["vibration"]')
ON CONFLICT (metric_type) DO NOTHING;

-- =====================================================
-- Insert default alert rules
-- =====================================================
INSERT INTO alert_rules (rule_name, trigger_metric_type, condition_type, condition_params, action_type, ticket_type, ticket_priority) VALUES
    ('Settlement Critical Alert', 'cumulative_settlement', 'threshold_exceeded', '{"threshold": 30.0, "comparison": "greater_than"}', 'create_ticket', 'SETTLEMENT_ALERT', 'CRITICAL'),
    ('Settlement Warning Alert', 'cumulative_settlement', 'threshold_exceeded', '{"threshold": 20.0, "comparison": "greater_than"}', 'create_ticket', 'SETTLEMENT_ALERT', 'HIGH'),
    ('Crack Critical Alert', 'crack_width', 'threshold_exceeded', '{"threshold": 0.5, "comparison": "greater_than"}', 'create_ticket', 'CRACK_ALERT', 'CRITICAL'),
    ('Crack Warning Alert', 'crack_width', 'threshold_exceeded', '{"threshold": 0.3, "comparison": "greater_than"}', 'create_ticket', 'CRACK_ALERT', 'MEDIUM'),
    ('High Vibration Alert', 'peak_vibration', 'threshold_exceeded', '{"threshold": 25.0, "comparison": "greater_than"}', 'create_ticket', 'EQUIPMENT_FAULT', 'HIGH')
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Monitoring points and metrics database schema created successfully!' as message;
