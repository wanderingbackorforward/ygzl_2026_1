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

### Phase 1: 数据库准备 ✅ (已完成)
- [x] 创建 kg_nodes, kg_edges 基础表
- [x] 创建 kg_documents 文献表
- [x] 创建 kg_document_entities 关联表
- [x] 创建 kg_qa_history 问答历史表
- [x] 扩展 kg_nodes/kg_edges 添加 document_id, source, confidence
- [x] RLS 策略配置

### Phase 2: 后端 API（文献管理）✅ (已完成)
- [x] 2.1 supabase_kg.py 添加文献管理方法（list/add/get/delete/process_document）
- [x] 2.2 api.py 注册 5 个路由（GET/POST/DELETE /kg/documents, POST /process）
- [x] 2.3 apiClient.ts 添加前端 API 调用函数
- [x] 2.4 规则引擎实体提取（监测点/概念/关键词，中英文双语）

### Phase 3: 后端 API（图谱构建）✅ (已在 Phase 2 中实现)
- [x] 3.1 规则引擎实体提取（监测点/概念/关键词，中英文）
- [x] 3.2 关系提取（文献->实体 MENTIONS, 点位->概念 RELATED_TO）
- [x] 3.3 上传后自动触发提取（process_document）

### Phase 4: 后端 API（增强问答）✅ (已完成)
- [x] 4.1 RAG 问答（检索文献 + 图谱数据 + 综合回答）
  - _search_documents: 关键词匹配文献内容
  - 中文停用词过滤
  - 置信度动态计算（文献命中+图谱命中累加）
  - 答案附带文献来源引用
- [x] 4.2 前端来源展示增强
  - 置信度颜色分级（绿>70% / 黄>50% / 橙<50%）
  - 来源标签化展示（图谱来源 vs 文献来源区别显示）

### Phase 5: 前端界面（文献管理）✅ (已完成)
- [x] 5.1 文献管理 Tab（默认首页）
  - 文献列表展示（标题、类型、日期、处理状态、实体/关系数量）
  - 添加文献表单（文本/URL/PDF，标题+内容输入）
  - 删除文献功能（带 loading 状态）
- [x] 5.2 自动处理流程
  - 上传后自动提取实体和关系
  - 统计数字实时刷新

### Phase 6: 前端界面（图谱可视化增强）✅ (已完成)
- [x] 6.1 新节点类型支持
  - Document（文献）节点：蓝色 #3b82f6
  - Concept（概念）节点：绿色 #10b981
  - TYPE_LABELS 增加中文标签
  - 图例增加文献和概念图标
- [x] 6.2 边颜色映射增强
  - MENTIONS（引用）：蓝色 #3b82f6
  - RELATED_TO（关联）：绿色 #10b981
  - SPATIAL_NEAR / DETECTED_AT / CORRELATES_WITH / CAUSES 各有独立颜色
  - 图例增加"引用"和"关联"边类型

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
