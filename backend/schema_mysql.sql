-- -*- coding: utf-8 -*-
-- 杨高中路 本地/云端 MySQL 结构补全脚本（可重复执行）
-- 用途：把原先只在 Supabase(PostgreSQL) 里存在的表补齐到 MySQL
-- 执行：mysql -uroot -p settlement_monitoring < backend/schema_mysql.sql

SET NAMES utf8mb4;

-- =====================================================
-- 1. 工单：归档标记
-- =====================================================
DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER //
CREATE PROCEDURE add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @_ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE _stmt FROM @_ddl;
    EXECUTE _stmt;
    DEALLOCATE PREPARE _stmt;
  END IF;
END //
DELIMITER ;

CALL add_col_if_missing('tickets', 'is_archived', '`is_archived` TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('tickets', 'archived_at', '`archived_at` DATETIME NULL');
CALL add_col_if_missing('assistant_conversations', 'page_path', '`page_path` VARCHAR(255) NULL');

-- =====================================================
-- 2. 用户与通知设置
-- =====================================================
CREATE TABLE IF NOT EXISTS system_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'operator',
  permissions JSON,
  is_active TINYINT(1) DEFAULT 1,
  last_login_at DATETIME NULL,
  department VARCHAR(100),
  team VARCHAR(100),
  avatar_url TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_system_users_role (role),
  INDEX idx_system_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notification_settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL UNIQUE,
  email_enabled TINYINT(1) DEFAULT 1,
  in_app_enabled TINYINT(1) DEFAULT 1,
  webhook_enabled TINYINT(1) DEFAULT 0,
  email_address VARCHAR(255),
  email_frequency VARCHAR(20) DEFAULT 'realtime',
  notify_on_ticket_created TINYINT(1) DEFAULT 1,
  notify_on_ticket_assigned TINYINT(1) DEFAULT 1,
  notify_on_status_change TINYINT(1) DEFAULT 1,
  notify_on_comment TINYINT(1) DEFAULT 1,
  notify_on_due_soon TINYINT(1) DEFAULT 1,
  notify_on_overdue TINYINT(1) DEFAULT 1,
  quiet_hours_start TIME NULL,
  quiet_hours_end TIME NULL,
  timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
  webhook_url TEXT,
  webhook_secret VARCHAR(255),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. 模块注册表
-- =====================================================
CREATE TABLE IF NOT EXISTS app_modules (
  module_key VARCHAR(64) PRIMARY KEY,
  route_path VARCHAR(128),
  display_name VARCHAR(100),
  icon_class VARCHAR(100),
  sort_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'developed',
  pending_badge_text VARCHAR(100),
  pending_popup_title VARCHAR(200),
  pending_popup_body VARCHAR(500),
  is_visible TINYINT(1) DEFAULT 1,
  updated_by VARCHAR(100),
  update_reason VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. 工单归档表
-- =====================================================
CREATE TABLE IF NOT EXISTS ticket_archive (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  original_id BIGINT NOT NULL,
  ticket_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  ticket_type VARCHAR(50) NOT NULL,
  sub_type VARCHAR(100),
  priority VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  creator_id VARCHAR(100),
  creator_name VARCHAR(100),
  assignee_id VARCHAR(100),
  assignee_name VARCHAR(100),
  monitoring_point_id VARCHAR(50),
  location_info JSON,
  equipment_id VARCHAR(50),
  threshold_value DECIMAL(20, 6),
  current_value DECIMAL(20, 6),
  alert_data JSON,
  due_at DATETIME NULL,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  attachment_paths JSON,
  metadata JSON,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  comments_snapshot JSON,
  INDEX idx_ticket_archive_number (ticket_number),
  INDEX idx_ticket_archive_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. 高级分析相关表
-- =====================================================
CREATE TABLE IF NOT EXISTS tunnel_profile_config (
  point_id VARCHAR(20) PRIMARY KEY,
  chainage_m DECIMAL(12, 3) NOT NULL,
  section_name VARCHAR(100),
  x_coord DECIMAL(18, 6),
  y_coord DECIMAL(18, 6),
  z_coord DECIMAL(18, 6),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_profile_chainage (chainage_m)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS geological_layers (
  layer_id INT AUTO_INCREMENT PRIMARY KEY,
  layer_number VARCHAR(20),
  layer_name VARCHAR(100) NOT NULL,
  depth_top DECIMAL(10, 3) NOT NULL,
  depth_bottom DECIMAL(10, 3) NOT NULL,
  thickness DECIMAL(10, 3),
  unit_weight DECIMAL(10, 3),
  cohesion DECIMAL(10, 3),
  friction_angle DECIMAL(10, 3),
  compression_modulus DECIMAL(10, 3),
  poisson_ratio DECIMAL(10, 4),
  color VARCHAR(20) DEFAULT '#cccccc',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settlement_crack_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settlement_point VARCHAR(20) NOT NULL,
  crack_point VARCHAR(20) NOT NULL,
  distance_m DECIMAL(10, 3),
  correlation_strength VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_settlement_crack (settlement_point, crack_point)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS construction_events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  event_date DATETIME NOT NULL,
  event_end_date DATETIME NULL,
  event_type VARCHAR(50) NOT NULL,
  event_subtype VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_chainage_start DECIMAL(12, 3),
  location_chainage_end DECIMAL(12, 3),
  affected_points JSON,
  intensity VARCHAR(20),
  metadata JSON,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_events_date (event_date),
  INDEX idx_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crack_monitoring_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  measurement_date DATETIME NOT NULL,
  point_id VARCHAR(20) NOT NULL,
  crack_id VARCHAR(20),
  value DECIMAL(12, 4) NOT NULL,
  daily_change DECIMAL(12, 4),
  cumulative_change DECIMAL(12, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_crack_data_date (measurement_date),
  INDEX idx_crack_data_point (point_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. 知识图谱
-- =====================================================
CREATE TABLE IF NOT EXISTS kg_nodes (
  id VARCHAR(255) PRIMARY KEY,
  node_type VARCHAR(64) NOT NULL,
  label VARCHAR(500) NOT NULL,
  properties JSON,
  document_id VARCHAR(64),
  source VARCHAR(32) DEFAULT 'auto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kg_nodes_type (node_type),
  INDEX idx_kg_nodes_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kg_edges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(255) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  edge_type VARCHAR(64) NOT NULL,
  properties JSON,
  document_id VARCHAR(64),
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kg_edges_source (source_id),
  INDEX idx_kg_edges_target (target_id),
  INDEX idx_kg_edges_type (edge_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kg_documents (
  id VARCHAR(64) PRIMARY KEY,
  title TEXT NOT NULL,
  content LONGTEXT,
  summary TEXT,
  source_type VARCHAR(32) NOT NULL DEFAULT 'text',
  source_url TEXT,
  file_size INT DEFAULT 0,
  processed TINYINT(1) DEFAULT 0,
  entity_count INT DEFAULT 0,
  relation_count INT DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  INDEX idx_kg_docs_processed (processed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kg_document_entities (
  document_id VARCHAR(64) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  mention_count INT DEFAULT 1,
  context TEXT,
  PRIMARY KEY (document_id, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kg_qa_history (
  id VARCHAR(64) PRIMARY KEY,
  question TEXT NOT NULL,
  answer LONGTEXT,
  sources JSON,
  confidence FLOAT,
  feedback INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. Agent 巡检 insights
-- =====================================================
CREATE TABLE IF NOT EXISTS insights (
  id VARCHAR(64) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  insight_type VARCHAR(32) NOT NULL DEFAULT 'anomaly',
  severity VARCHAR(20) NOT NULL DEFAULT 'info',
  point_id VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  evidence JSON,
  suggestion TEXT,
  acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  dismissed TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_insights_latest (created_at),
  INDEX idx_insights_unread (acknowledged, created_at),
  INDEX idx_insights_point (point_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7.1 ML 模型 / 训练历史 / 预测结果
-- =====================================================
CREATE TABLE IF NOT EXISTS ml_models (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  model_type VARCHAR(50),
  version VARCHAR(50),
  storage_path TEXT,
  config JSON,
  metrics JSON,
  file_size_bytes BIGINT,
  is_active TINYINT(1) DEFAULT 1,
  notes TEXT,
  trained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ml_models_name (model_name),
  INDEX idx_ml_models_active (model_name, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ml_training_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  model_id BIGINT,
  training_type VARCHAR(50),
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  duration_sec DOUBLE,
  n_samples INT,
  n_entities INT,
  metrics JSON,
  data_summary JSON,
  status VARCHAR(20) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ml_history_name (model_name, finished_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ml_predictions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  model_id BIGINT,
  model_name VARCHAR(100),
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  prediction_date DATETIME NULL,
  forecast_steps INT,
  forecast_values JSON,
  lower_bound JSON,
  upper_bound JSON,
  historical JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ml_pred_target (model_name, target_id, prediction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. 视图（原 Supabase 视图的 MySQL 版本）
-- =====================================================
CREATE OR REPLACE VIEW v_tickets_active AS
SELECT t.*,
  CASE WHEN t.due_at IS NOT NULL AND t.due_at < NOW()
            AND t.status NOT IN ('CLOSED', 'RESOLVED', 'REJECTED')
       THEN 1 ELSE 0 END AS is_overdue
FROM tickets t
WHERE t.is_archived = 0;

CREATE OR REPLACE VIEW v_tickets_due_soon AS
SELECT * FROM tickets
WHERE is_archived = 0
  AND status NOT IN ('CLOSED', 'RESOLVED', 'REJECTED')
  AND due_at IS NOT NULL
  AND due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR);

CREATE OR REPLACE VIEW v_tickets_overdue AS
SELECT * FROM tickets
WHERE is_archived = 0
  AND status NOT IN ('CLOSED', 'RESOLVED', 'REJECTED')
  AND due_at IS NOT NULL
  AND due_at < NOW();

CREATE OR REPLACE VIEW v_tickets_to_archive AS
SELECT * FROM tickets
WHERE is_archived = 0
  AND status IN ('CLOSED', 'REJECTED')
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

CREATE OR REPLACE VIEW v_users_with_email AS
SELECT
  u.id, u.user_id, u.username, u.display_name,
  u.email AS primary_email, u.role, u.department, u.team, u.is_active,
  COALESCE(n.email_address, u.email) AS notification_email,
  n.email_enabled, n.notify_on_ticket_created, n.notify_on_ticket_assigned,
  n.notify_on_status_change, n.notify_on_due_soon, n.notify_on_overdue
FROM system_users u
LEFT JOIN user_notification_settings n ON u.user_id = n.user_id
WHERE u.is_active = 1;

-- =====================================================
-- 9. 默认用户与模块
-- =====================================================
INSERT IGNORE INTO system_users (user_id, username, display_name, role, department) VALUES
  ('admin', 'admin', 'System Administrator', 'admin', 'IT'),
  ('system', 'system', 'System Auto', 'system', 'System'),
  ('monitoring_engineer', 'engineer1', 'Monitoring Engineer 1', 'monitoring_engineer', 'Monitoring'),
  ('field_technician', 'tech1', 'Field Technician 1', 'field_technician', 'Field'),
  ('data_analyst', 'analyst1', 'Data Analyst 1', 'data_analyst', 'Analysis');

INSERT IGNORE INTO user_notification_settings (user_id, email_enabled, email_address)
SELECT user_id, 1, email FROM system_users
WHERE user_id IN ('admin', 'monitoring_engineer', 'field_technician', 'data_analyst');

INSERT IGNORE INTO app_modules (module_key, route_path, display_name, icon_class, sort_order, status, is_visible) VALUES
  ('cover', '/cover', '封面', 'fas fa-home', 10, 'developed', 1),
  ('settlement', '/settlement', '沉降', 'fas fa-chart-area', 20, 'developed', 1),
  ('temperature', '/temperature', '温度', 'fas fa-thermometer-half', 30, 'developed', 1),
  ('cracks', '/cracks', '裂缝', 'fas fa-bug', 40, 'developed', 1),
  ('vibration', '/vibration', '振动', 'fas fa-wave-square', 50, 'developed', 1),
  ('insar', '/insar', 'InSAR', 'fas fa-satellite', 60, 'developed', 1),
  ('advanced', '/advanced', '高级分析', 'fas fa-microscope', 65, 'developed', 1),
  ('overview', '/overview', '数据总览', 'fas fa-chart-line', 70, 'developed', 1),
  ('three', '/three', '3D模型', 'fas fa-cubes', 80, 'developed', 1),
  ('tickets', '/tickets', '工单', 'fas fa-ticket-alt', 90, 'developed', 1),
  ('shield-trajectory', '/shield-trajectory', '盾构轨迹', 'fas fa-route', 95, 'developed', 1);

DROP PROCEDURE IF EXISTS add_col_if_missing;
