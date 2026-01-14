BEGIN;
CREATE SCHEMA IF NOT EXISTS digital_twin;
SET search_path TO digital_twin, public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM ('PENDING','IN_PROGRESS','RESOLVED','CLOSED','REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type') THEN
    CREATE TYPE ticket_type AS ENUM ('ALERT','MAINTENANCE','FAULT','INSPECTION','OTHER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ticket_type ticket_type NOT NULL,
  sub_type TEXT,
  priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
  status ticket_status NOT NULL DEFAULT 'PENDING',
  creator_id TEXT,
  creator_name TEXT,
  assignee_id TEXT,
  assignee_name TEXT,
  monitoring_point_id TEXT,
  location_info TEXT,
  equipment_id TEXT,
  threshold_value NUMERIC(10,3),
  current_value NUMERIC(10,3),
  alert_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  resolution TEXT,
  rejection_reason TEXT,
  attachment_paths JSONB,
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_ticket_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_creator ON tickets(creator_id);
CREATE INDEX IF NOT EXISTS idx_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_point ON tickets(monitoring_point_id);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  comment_type TEXT DEFAULT 'COMMENT',
  attachment_paths JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comment_author ON ticket_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comment_created_at ON ticket_comments(created_at);

CREATE TABLE IF NOT EXISTS settlement_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_code TEXT UNIQUE,
  name TEXT,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  elev NUMERIC(10,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS settlement_measurements (
  id BIGSERIAL PRIMARY KEY,
  point_id UUID NOT NULL REFERENCES settlement_points(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  value NUMERIC(10,3),
  rate NUMERIC(10,3)
);
CREATE INDEX IF NOT EXISTS idx_settlement_point_ts ON settlement_measurements(point_id, ts);

CREATE TABLE IF NOT EXISTS temperature_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_code TEXT UNIQUE,
  name TEXT,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS temperature_measurements (
  id BIGSERIAL PRIMARY KEY,
  sensor_id UUID NOT NULL REFERENCES temperature_sensors(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  value NUMERIC(10,3)
);
CREATE INDEX IF NOT EXISTS idx_temperature_sensor_ts ON temperature_measurements(sensor_id, ts);

CREATE TABLE IF NOT EXISTS cracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crack_code TEXT UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crack_measurements (
  id BIGSERIAL PRIMARY KEY,
  crack_id UUID NOT NULL REFERENCES cracks(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  width NUMERIC(10,3),
  rate NUMERIC(10,3)
);
CREATE INDEX IF NOT EXISTS idx_crack_ts ON crack_measurements(crack_id, ts);

CREATE TABLE IF NOT EXISTS vibration_datasets (
  dataset_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  upload_time TIMESTAMPTZ NOT NULL,
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_upload_time ON vibration_datasets(upload_time);

CREATE TABLE IF NOT EXISTS vibration_channels (
  dataset_id TEXT NOT NULL REFERENCES vibration_datasets(dataset_id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  sampling_rate DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (dataset_id, channel_id)
);

CREATE TABLE IF NOT EXISTS vibration_time_data (
  id BIGSERIAL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  time_point DOUBLE PRECISION NOT NULL,
  amplitude DOUBLE PRECISION NOT NULL,
  FOREIGN KEY (dataset_id, channel_id) REFERENCES vibration_channels(dataset_id, channel_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vib_time_range ON vibration_time_data(dataset_id, channel_id, time_point);

CREATE TABLE IF NOT EXISTS vibration_frequency_data (
  id BIGSERIAL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  frequency DOUBLE PRECISION NOT NULL,
  amplitude DOUBLE PRECISION NOT NULL,
  FOREIGN KEY (dataset_id, channel_id) REFERENCES vibration_channels(dataset_id, channel_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vib_frequency_range ON vibration_frequency_data(dataset_id, channel_id, frequency);

CREATE TABLE IF NOT EXISTS vibration_features (
  id BIGSERIAL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_value DOUBLE PRECISION NOT NULL,
  FOREIGN KEY (dataset_id, channel_id) REFERENCES vibration_channels(dataset_id, channel_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feature_dataset ON vibration_features(feature_name, dataset_id);

INSERT INTO tickets(ticket_number,title,description,ticket_type,priority,status,creator_id,creator_name,assignee_id,assignee_name,current_value,alert_data)
VALUES
('T-202601-0001','监测点 S1 沉降超阈值','自动告警触发','ALERT','HIGH','PENDING','u_001','系统','u_002','维护员',-32.5,'{"threshold":-30.0,"point":"S1"}'::jsonb)
ON CONFLICT DO NOTHING;
INSERT INTO ticket_comments(ticket_id,author_id,author_name,content,comment_type)
SELECT id,'u_002','维护员','现场已查看，待复测','COMMENT' FROM tickets WHERE ticket_number='T-202601-0001' ON CONFLICT DO NOTHING;

INSERT INTO settlement_points(point_code,name,lat,lon,elev)
VALUES ('S1','监测点 S1',31.230000,121.480000,5.000),
       ('S2','监测点 S2',31.235000,121.485000,5.100)
ON CONFLICT DO NOTHING;
INSERT INTO settlement_measurements(point_id,ts,value,rate)
SELECT id, NOW() - INTERVAL '1 day', -31.8, 0.08 FROM settlement_points WHERE point_code='S1'
UNION ALL
SELECT id, NOW(), -32.5, 0.07 FROM settlement_points WHERE point_code='S1'
ON CONFLICT DO NOTHING;

INSERT INTO temperature_sensors(sensor_code,name,lat,lon)
VALUES ('T001','温度传感器-入口',31.230500,121.480500),
       ('T002','温度传感器-中段',31.232000,121.482000)
ON CONFLICT DO NOTHING;
INSERT INTO temperature_measurements(sensor_id,ts,value)
SELECT id, NOW(), 18.5 FROM temperature_sensors WHERE sensor_code='T001'
UNION ALL
SELECT id, NOW(), 19.2 FROM temperature_sensors WHERE sensor_code='T002'
ON CONFLICT DO NOTHING;

INSERT INTO cracks(crack_code,location) VALUES ('C001','左洞拱顶') ON CONFLICT DO NOTHING;
INSERT INTO crack_measurements(crack_id,ts,width,rate)
SELECT id, NOW(), 2.8, 0.003 FROM cracks WHERE crack_code='C001' ON CONFLICT DO NOTHING;

INSERT INTO vibration_datasets(dataset_id,name,upload_time,description)
VALUES ('DS001','测试数据集', NOW(),'联调示例') ON CONFLICT DO NOTHING;
INSERT INTO vibration_channels(dataset_id,channel_id,sampling_rate)
VALUES ('DS001','1', 1000.0) ON CONFLICT DO NOTHING;
INSERT INTO vibration_time_data(dataset_id,channel_id,time_point,amplitude)
VALUES ('DS001','1',0.001,0.12),('DS001','1',0.002,0.08) ON CONFLICT DO NOTHING;
INSERT INTO vibration_frequency_data(dataset_id,channel_id,frequency,amplitude)
VALUES ('DS001','1',60.0,0.35),('DS001','1',120.0,0.18) ON CONFLICT DO NOTHING;
INSERT INTO vibration_features(dataset_id,channel_id,feature_name,feature_value)
VALUES ('DS001','1','RMS',0.25),('DS001','1','PEAK',0.45) ON CONFLICT DO NOTHING;

ALTER TABLE tickets                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_points                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_measurements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_sensors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_measurements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cracks                               ENABLE ROW LEVEL SECURITY;
ALTER TABLE crack_measurements                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibration_datasets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibration_channels                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibration_time_data                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibration_frequency_data             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibration_features                   ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read_tickets      ON tickets                 FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_tickets        ON tickets                 FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_comments     ON ticket_comments         FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_comments       ON ticket_comments         FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_settle_pt    ON settlement_points       FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_settle_pt      ON settlement_points       FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_settle_meas  ON settlement_measurements FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_settle_meas    ON settlement_measurements FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_temp_sens    ON temperature_sensors     FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_temp_sens      ON temperature_sensors     FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_temp_meas    ON temperature_measurements FOR SELECT TO anon          USING (true);
CREATE POLICY auth_rw_temp_meas      ON temperature_measurements FOR ALL   TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_cracks       ON cracks                  FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_cracks         ON cracks                  FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_crack_meas   ON crack_measurements      FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_crack_meas     ON crack_measurements      FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_vib_ds       ON vibration_datasets      FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_vib_ds         ON vibration_datasets      FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_vib_chan     ON vibration_channels      FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_vib_chan       ON vibration_channels      FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_vib_time     ON vibration_time_data     FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_vib_time       ON vibration_time_data     FOR ALL    TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_vib_freq     ON vibration_frequency_data FOR SELECT TO anon          USING (true);
CREATE POLICY auth_rw_vib_freq       ON vibration_frequency_data FOR ALL   TO authenticated  USING (true) WITH CHECK (true);
CREATE POLICY anon_read_vib_feat     ON vibration_features      FOR SELECT TO anon           USING (true);
CREATE POLICY auth_rw_vib_feat       ON vibration_features      FOR ALL    TO authenticated  USING (true) WITH CHECK (true);

COMMIT;
