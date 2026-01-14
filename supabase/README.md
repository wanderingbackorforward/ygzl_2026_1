Supabase SQL 迁移目录

- 目录：supabase/sql
- 约定：按编号顺序执行（如 10_auto_ticket_rules.sql）
- 环境：使用 SUPABASE_DB_URL 提供 Postgres 连接字符串
- 运行：可用 Python runner 扫描并执行 supabase/sql 下所有 .sql

示例 SUPABASE_DB_URL：
postgresql://user:password@host:5432/dbname

使用方法：
- 设置环境变量 SUPABASE_DB_URL（或在项目根创建 .env）
- 执行迁移：python supabase/run_migrations.py
- 验证规则表：python supabase/validate_rules.py
