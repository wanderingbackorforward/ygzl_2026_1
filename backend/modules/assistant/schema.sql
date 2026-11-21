-- 悬浮小助手 - 对话管理表结构

-- 对话表
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200) NOT NULL DEFAULT '新对话',
  role VARCHAR(20) NOT NULL DEFAULT 'researcher',  -- researcher | worker | reporter
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_created_at (created_at),
  INDEX idx_role (role),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息表
CREATE TABLE IF NOT EXISTS assistant_messages (
  id VARCHAR(50) PRIMARY KEY,
  conversation_id VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL,  -- user | assistant
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'markdown',  -- text | markdown | chart | table
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
