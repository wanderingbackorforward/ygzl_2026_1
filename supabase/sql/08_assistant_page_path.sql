-- 为 assistant_conversations 表添加 page_path 字段以实现对话页面隔离
-- 执行时间: 2026-03-09

-- 1. 添加 page_path 字段
ALTER TABLE assistant_conversations
ADD COLUMN page_path TEXT;

-- 2. 为现有数据设置默认值（可选，如果有历史数据）
UPDATE assistant_conversations
SET page_path = '/settlement'
WHERE page_path IS NULL;

-- 3. 添加索引以提升查询性能
CREATE INDEX idx_assistant_conversations_page_path
ON assistant_conversations(page_path);

-- 4. 添加复合索引（page_path + updated_at）用于排序查询
CREATE INDEX idx_assistant_conversations_page_path_updated_at
ON assistant_conversations(page_path, updated_at DESC);

-- 5. 验证修改
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'assistant_conversations'
ORDER BY ordinal_position;
