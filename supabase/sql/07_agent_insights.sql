-- Agent 巡检系统 - insights 表
-- 存储 Agent 的每一次发现（巡检结果、异常检测、恢复通知）

CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  insight_type TEXT NOT NULL DEFAULT 'anomaly',
  severity TEXT NOT NULL DEFAULT 'info',
  point_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  evidence JSONB DEFAULT '{}',
  suggestion TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE insights IS 'Agent 巡检系统的发现记录';
COMMENT ON COLUMN insights.insight_type IS 'patrol_summary | anomaly | resolution';
COMMENT ON COLUMN insights.severity IS 'info | warning | critical';
COMMENT ON COLUMN insights.point_id IS '关联监测点ID，patrol_summary 时为 NULL';
COMMENT ON COLUMN insights.dismissed IS '用户标记"不相关"，用于误报学习';

CREATE INDEX IF NOT EXISTS idx_insights_latest ON insights (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_unread ON insights (acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_point ON insights (point_id, created_at DESC);
