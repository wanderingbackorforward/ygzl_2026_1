# 知识图谱升级计划

## 现状分析
- 当前知识图谱功能：图谱探索、风险查询、知识问答
- 问题：依赖 Neo4j 图数据库，Vercel 无法部署，只能显示模拟数据
- 核心缺陷：**无法添加内容（如文献），无法自动消化整理为图谱**

## 升级目标
1. **文献管理**：允许用户上传/添加文献（PDF、文本、链接）
2. **自动图谱化**：自动提取文献中的实体和关系，构建知识图谱
3. **AI 增强问答**：基于图谱内容回答问题，提高可靠性
4. **Vercel 兼容**：使用轻量级存储方案（Supabase + JSON）

## 技术方案

### 方案选择：Supabase + LangChain + OpenAI
- **存储**：Supabase PostgreSQL（实体表 + 关系表 + 文献表）
- **向量检索**：Supabase pgvector（语义搜索）
- **图谱构建**：LangChain + OpenAI（实体/关系提取）
- **问答**：RAG（检索增强生成）

### 数据库设计
```sql
-- 文献表
CREATE TABLE kg_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  source_type TEXT, -- 'pdf', 'text', 'url'
  source_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- 实体表
CREATE TABLE kg_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT, -- 'point', 'event', 'concept', 'metric'
  properties JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 关系表
CREATE TABLE kg_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES kg_entities(id),
  target_id UUID REFERENCES kg_entities(id),
  relation_type TEXT, -- 'causes', 'correlates', 'mentions', 'affects'
  properties JSONB,
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 文献-实体关联表
CREATE TABLE kg_document_entities (
  document_id UUID REFERENCES kg_documents(id),
  entity_id UUID REFERENCES kg_entities(id),
  mention_count INT DEFAULT 1,
  PRIMARY KEY (document_id, entity_id)
);
```

## 实施步骤

### Phase 1: 数据库准备 ✅
- [x] 创建 Supabase 表结构
- [x] 添加索引和约束
- [x] 测试数据库连接

### Phase 2: 后端 API（文献管理）
- [ ] 2.1 文献上传接口（`POST /api/kg/documents`）
  - 支持文本输入
  - 支持 URL 抓取
  - 支持 PDF 上传（base64）
- [ ] 2.2 文献列表接口（`GET /api/kg/documents`）
- [ ] 2.3 文献删除接口（`DELETE /api/kg/documents/{id}`）

### Phase 3: 后端 API（图谱构建）
- [ ] 3.1 实体提取接口（`POST /api/kg/extract`）
  - 使用 LangChain + OpenAI 提取实体
  - 存储到 `kg_entities` 表
- [ ] 3.2 关系提取接口（`POST /api/kg/relations`）
  - 提取实体间关系
  - 存储到 `kg_relations` 表
- [ ] 3.3 自动处理流程（后台任务）
  - 文献上传后自动触发提取

### Phase 4: 后端 API（增强问答）
- [ ] 4.1 RAG 问答接口（`POST /api/kg/qa`）
  - 检索相关实体和关系
  - 结合文献内容生成答案
  - 返回置信度和来源
- [ ] 4.2 图谱查询接口（`GET /api/kg/graph`）
  - 支持邻居查询
  - 支持路径查询

### Phase 5: 前端界面（文献管理）
- [ ] 5.1 文献管理 Tab
  - 文献列表展示
  - 上传文献表单（文本/URL/PDF）
  - 删除文献功能
- [ ] 5.2 处理状态展示
  - 显示处理进度
  - 显示提取的实体数量

### Phase 6: 前端界面（图谱可视化）
- [ ] 6.1 增强图谱探索
  - 显示文献来源
  - 高亮实体类型
- [ ] 6.2 增强问答界面
  - 显示答案来源（文献引用）
  - 显示置信度

### Phase 7: 测试与优化
- [ ] 7.1 端到端测试
- [ ] 7.2 性能优化（批量处理）
- [ ] 7.3 错误处理和降级

## Vercel 部署注意事项
1. **无状态处理**：所有数据存 Supabase，不依赖本地文件系统
2. **超时限制**：Vercel Serverless Function 最大 60s，长任务需异步处理
3. **环境变量**：`OPENAI_API_KEY`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`
4. **依赖管理**：`langchain`、`openai`、`pypdf` 添加到 `requirements.txt`

## 预期效果
- 用户可上传文献，系统自动提取知识
- 知识图谱基于真实数据，不再是模拟
- AI 问答基于图谱和文献，答案更可靠
- 完全兼容 Vercel 部署

## 下一步
从 Phase 1 开始，逐步实施，每完成一个 Phase 打勾确认。
