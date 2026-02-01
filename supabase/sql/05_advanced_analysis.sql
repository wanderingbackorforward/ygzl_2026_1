-- -*- coding: utf-8 -*-
-- Supabase/PostgreSQL DDL for Advanced Analysis
-- Author: Claude Code
-- Description: Tables for tunnel profile, geological layers, and construction events

-- =====================================================
-- Table: tunnel_profile_config
-- Mapping between settlement points and tunnel chainage
-- =====================================================
CREATE TABLE IF NOT EXISTS tunnel_profile_config (
    point_id VARCHAR(20) PRIMARY KEY,
    chainage_m NUMERIC NOT NULL,           -- Chainage in meters
    section_name VARCHAR(100),             -- Section name (optional)
    x_coord NUMERIC,                       -- X coordinate (optional)
    y_coord NUMERIC,                       -- Y coordinate (optional)
    z_coord NUMERIC,                       -- Z coordinate / elevation (optional)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for chainage queries
CREATE INDEX IF NOT EXISTS idx_profile_chainage ON tunnel_profile_config(chainage_m);

-- =====================================================
-- Table: geological_layers
-- Geological stratification data for profile background
-- =====================================================
CREATE TABLE IF NOT EXISTS geological_layers (
    layer_id SERIAL PRIMARY KEY,
    layer_number VARCHAR(20),              -- Layer number (e.g., "1", "2", "3t")
    layer_name VARCHAR(100) NOT NULL,      -- Layer name
    depth_top NUMERIC NOT NULL,            -- Top depth in meters
    depth_bottom NUMERIC NOT NULL,         -- Bottom depth in meters
    thickness NUMERIC,                     -- Layer thickness
    unit_weight NUMERIC,                   -- Unit weight kN/m3
    cohesion NUMERIC,                      -- Cohesion C (kPa)
    friction_angle NUMERIC,                -- Internal friction angle (degrees)
    compression_modulus NUMERIC,           -- Compression modulus Es (MPa)
    poisson_ratio NUMERIC,                 -- Poisson's ratio
    color VARCHAR(20) DEFAULT '#cccccc',   -- Display color (hex)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Table: settlement_crack_mapping
-- Spatial relationship between settlement and crack points
-- =====================================================
CREATE TABLE IF NOT EXISTS settlement_crack_mapping (
    id SERIAL PRIMARY KEY,
    settlement_point VARCHAR(20) NOT NULL,  -- Settlement point ID (S0-S25)
    crack_point VARCHAR(20) NOT NULL,       -- Crack point ID (F1-1, F1-2, etc.)
    distance_m NUMERIC,                     -- Spatial distance in meters
    correlation_strength VARCHAR(20),       -- strong/medium/weak
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(settlement_point, crack_point)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_mapping_settlement ON settlement_crack_mapping(settlement_point);
CREATE INDEX IF NOT EXISTS idx_mapping_crack ON settlement_crack_mapping(crack_point);

-- =====================================================
-- Table: construction_events
-- Construction activity events for causal analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS construction_events (
    event_id SERIAL PRIMARY KEY,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    event_end_date TIMESTAMP WITH TIME ZONE,          -- Optional end date
    event_type VARCHAR(50) NOT NULL,                  -- pile/excavation/grouting/dewatering/other
    event_subtype VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_chainage_start NUMERIC,                  -- Start chainage
    location_chainage_end NUMERIC,                    -- End chainage
    affected_points TEXT[],                           -- Array of affected point IDs
    intensity VARCHAR(20),                            -- low/medium/high
    metadata JSONB DEFAULT '{}',
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_date ON construction_events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_type ON construction_events(event_type);

-- =====================================================
-- Table: crack_monitoring_data (if not exists)
-- Crack monitoring time series data
-- =====================================================
CREATE TABLE IF NOT EXISTS crack_monitoring_data (
    id SERIAL PRIMARY KEY,
    measurement_date TIMESTAMP WITH TIME ZONE NOT NULL,
    point_id VARCHAR(20) NOT NULL,         -- Crack point ID (F1-1, F1-2, etc.)
    crack_id VARCHAR(20),                  -- Parent crack ID (F1, F2, etc.)
    value NUMERIC NOT NULL,                -- Crack width in mm
    daily_change NUMERIC,
    cumulative_change NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crack_data_date ON crack_monitoring_data(measurement_date);
CREATE INDEX IF NOT EXISTS idx_crack_data_point ON crack_monitoring_data(point_id);

-- =====================================================
-- View: v_profile_with_settlement
-- Combined view for profile chart
-- =====================================================
CREATE OR REPLACE VIEW v_profile_with_settlement AS
SELECT
    pc.point_id,
    pc.chainage_m,
    pc.section_name,
    psd.measurement_date,
    psd.value as settlement_value,
    psd.cumulative_change,
    psd.daily_change,
    sa.trend_type,
    sa.alert_level
FROM tunnel_profile_config pc
LEFT JOIN processed_settlement_data psd ON pc.point_id = psd.point_id
LEFT JOIN settlement_analysis sa ON pc.point_id = sa.point_id
ORDER BY pc.chainage_m, psd.measurement_date;

-- =====================================================
-- View: v_joint_settlement_crack
-- Combined view for joint analysis
-- =====================================================
CREATE OR REPLACE VIEW v_joint_settlement_crack AS
SELECT
    scm.settlement_point,
    scm.crack_point,
    scm.distance_m,
    scm.correlation_strength,
    psd.measurement_date,
    psd.value as settlement_value,
    psd.cumulative_change as settlement_cumulative,
    cmd.value as crack_value
FROM settlement_crack_mapping scm
LEFT JOIN processed_settlement_data psd ON scm.settlement_point = psd.point_id
LEFT JOIN crack_monitoring_data cmd ON scm.crack_point = cmd.point_id
    AND psd.measurement_date = cmd.measurement_date
ORDER BY scm.settlement_point, psd.measurement_date;

-- =====================================================
-- Enable Row Level Security (RLS) - optional
-- =====================================================
-- ALTER TABLE tunnel_profile_config ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE geological_layers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settlement_crack_mapping ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE construction_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Grant permissions for anon role
-- =====================================================
GRANT SELECT ON tunnel_profile_config TO anon;
GRANT SELECT ON geological_layers TO anon;
GRANT SELECT ON settlement_crack_mapping TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON construction_events TO anon;
GRANT SELECT ON crack_monitoring_data TO anon;
GRANT SELECT ON v_profile_with_settlement TO anon;
GRANT SELECT ON v_joint_settlement_crack TO anon;
GRANT USAGE, SELECT ON SEQUENCE construction_events_event_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE crack_monitoring_data_id_seq TO anon;
