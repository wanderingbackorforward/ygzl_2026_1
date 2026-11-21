-- 悬浮小助手 - 对话管理表结构（Supabase/PostgreSQL 版本）

-- 对话表
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200) NOT NULL DEFAULT '新对话',
  role VARCHAR(20) NOT NULL DEFAULT 'researcher',  -- researcher | worker | reporter
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_created_at ON assistant_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_role ON assistant_conversations(role);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_deleted_at ON assistant_conversations(deleted_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_assistant_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assistant_conversations_updated_at
BEFORE UPDATE ON assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION update_assistant_conversations_updated_at();

-- 消息表
CREATE TABLE IF NOT EXISTS assistant_messages (
  id VARCHAR(50) PRIMARY KEY,
  conversation_id VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL,  -- user | assistant
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'markdown',  -- text | markdown | chart | table
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversation
    FOREIGN KEY (conversation_id)
    REFERENCES assistant_conversations(id)
    ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_created_at ON assistant_messages(created_at);

-- 添加注释
COMMENT ON TABLE assistant_conversations IS '悬浮小助手对话列表';
COMMENT ON TABLE assistant_messages IS '悬浮小助手消息记录';
COMMENT ON COLUMN assistant_conversations.role IS '角色类型: researcher(科研人员) | worker(施工人员) | reporter(项目汇报)';
COMMENT ON COLUMN assistant_messages.role IS '消息角色: user(用户) | assistant(AI助手)';
COMMENT ON COLUMN assistant_messages.content_type IS '内容类型: text(纯文本) | markdown(Markdown格式) | chart(图表) | table(表格)';
