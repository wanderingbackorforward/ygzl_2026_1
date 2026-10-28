# RAG 系统实施计划 - 智能上下文感知助手

## 问题分析

当前问题：
1. 大模型调用窗口和页面内容完全脱节
2. 在 InSAR 页面上询问数据相关问题，助手无法获取页面上的实际数据
3. 缺少上下文注入机制，导致回答泛泛而谈

## 解决方案：RAG（检索增强生成）系统

### 核心思路

1. **页面上下文提取**：自动提取当前页面的关键数据和状态
2. **智能检索**：根据用户问题，检索相关的数据和文档
3. **上下文注入**：将检索到的信息注入到大模型的 prompt 中
4. **智能路由**：根据问题类型，选择不同的数据源和检索策略

---

## 技术架构

### 方案选择：混合式 RAG

**为什么不用向量数据库？**
- 数据量不大（监测数据、配置信息）
- 实时性要求高（数据经常更新）
- 部署复杂度高（需要额外的向量数据库服务）

**推荐方案：基于规则的智能检索 + 动态上下文构建**

```
用户问题
    ↓
问题分析（意图识别）
    ↓
    ├─ 数据查询类 → 调用 API 获取实时数据
    ├─ 页面功能类 → 提取页面元数据
    ├─ 系统配置类 → 读取配置文档
    └─ 通用知识类 → 直接调用大模型
    ↓
上下文构建（Prompt Engineering）
    ↓
大模型生成回答
```

---

## 实施步骤

### 第一阶段：页面上下文提取器（2-3天）

#### 1.1 创建上下文提取框架

**文件**：`frontend/src/contexts/PageContextProvider.tsx`

**功能**：
- 监听页面路由变化
- 提取当前页面的关键信息
- 提供统一的上下文访问接口

**提取内容**：
```typescript
interface PageContext {
  pagePath: string;           // 当前页面路径
  pageTitle: string;          // 页面标题
  moduleKey: string;          // 模块标识
  dataSnapshot: {             // 数据快照
    summary: any;             // 汇总数据
    selectedItems: any[];     // 选中的项目
    filters: any;             // 当前筛选条件
    dateRange: [string, string]; // 时间范围
  };
  metadata: {                 // 元数据
    lastUpdate: string;       // 最后更新时间
    dataSource: string;       // 数据源
    recordCount: number;      // 记录数
  };
}
```

#### 1.2 为每个页面实现上下文提取器

**InSAR 页面示例**：
```typescript
// frontend/src/pages/Insar.tsx
export function useInsarContext(): PageContext {
  const [data, setData] = useState(null);

  useEffect(() => {
    // 提取 InSAR 数据
    fetch('/api/insar/data').then(res => res.json()).then(setData);
  }, []);

  return {
    pagePath: '/insar',
    pageTitle: 'InSAR 监测',
    moduleKey: 'insar',
    dataSnapshot: {
      summary: {
        totalPoints: data?.length || 0,
        avgVelocity: calculateAvg(data, 'velocity'),
        maxVelocity: calculateMax(data, 'velocity'),
        dateRange: getDateRange(data),
      },
      selectedItems: data?.filter(d => d.selected) || [],
      filters: getCurrentFilters(),
      dateRange: getDateRange(data),
    },
    metadata: {
      lastUpdate: new Date().toISOString(),
      dataSource: 'Sentinel-1',
      recordCount: data?.length || 0,
    },
  };
}
```

**其他页面**：
- Settlement（沉降）
- Temperature（温度）
- Cracks（裂缝）
- Vibration（振动）
- Overview（总览）

---

### 第二阶段：智能问题分析器（1-2天）

#### 2.1 问题意图识别

**文件**：`backend/modules/assistant/intent_classifier.py`

**功能**：
- 识别用户问题的意图类型
- 提取关键实体（时间、地点、指标）
- 确定需要检索的数据源

**意图分类**：
```python
class IntentType(Enum):
    DATA_QUERY = "data_query"           # 数据查询："最新的沉降数据是多少？"
    DATA_ANALYSIS = "data_analysis"     # 数据分析："沉降趋势如何？"
    ANOMALY_CHECK = "anomaly_check"     # 异常检查："有没有异常点？"
    COMPARISON = "comparison"           # 对比分析："A点和B点哪个更严重？"
    PREDICTION = "prediction"           # 预测："未来会怎样？"
    EXPLANATION = "explanation"         # 解释说明："velocity字段是什么意思？"
    OPERATION = "operation"             # 操作指导："如何导出数据？"
    GENERAL = "general"                 # 通用问题："系统有哪些功能？"
```

**实现方式**：
```python
def classify_intent(question: str, page_path: str) -> Dict[str, Any]:
    """
    使用规则 + 关键词匹配识别意图
    """
    question_lower = question.lower()

    # 数据查询类关键词
    if any(kw in question_lower for kw in ['多少', '数据', '值', '最新', '当前']):
        return {
            'intent': IntentType.DATA_QUERY,
            'confidence': 0.9,
            'entities': extract_entities(question),
        }

    # 异常检查类关键词
    if any(kw in question_lower for kw in ['异常', '超限', '预警', '风险', '问题']):
        return {
            'intent': IntentType.ANOMALY_CHECK,
            'confidence': 0.85,
            'entities': extract_entities(question),
        }

    # ... 其他意图识别

    return {
        'intent': IntentType.GENERAL,
        'confidence': 0.5,
        'entities': {},
    }
```

#### 2.2 实体提取

**提取内容**：
- 时间实体：今天、昨天、最近7天、2024年1月
- 地点实体：S1、S2、A区、B区
- 指标实体：沉降量、速率、温度、裂缝宽度
- 数值实体：大于10mm、小于5℃

---

### 第三阶段：数据检索器（2-3天）

#### 3.1 创建统一的数据检索接口

**文件**：`backend/modules/assistant/data_retriever.py`

**功能**：
- 根据意图和实体，检索相关数据
- 支持多种数据源（API、数据库、文件）
- 数据格式化和摘要

**检索策略**：
```python
class DataRetriever:
    def retrieve(self, intent: IntentType, entities: Dict, page_context: Dict) -> Dict:
        """
        根据意图检索数据
        """
        if intent == IntentType.DATA_QUERY:
            return self._retrieve_data_query(entities, page_context)
        elif intent == IntentType.ANOMALY_CHECK:
            return self._retrieve_anomalies(entities, page_context)
        elif intent == IntentType.DATA_ANALYSIS:
            return self._retrieve_analysis_data(entities, page_context)
        # ... 其他意图

    def _retrieve_data_query(self, entities: Dict, page_context: Dict) -> Dict:
        """
        检索数据查询类问题的数据
        """
        module = page_context.get('moduleKey')

        if module == 'insar':
            # 调用 InSAR API
            data = self._call_api('/api/insar/data')
            return {
                'data_type': 'insar_data',
                'summary': self._summarize_insar_data(data),
                'raw_data': data[:10],  # 只返回前10条
                'total_count': len(data),
            }
        elif module == 'settlement':
            # 调用沉降 API
            data = self._call_api('/api/settlement/data')
            return {
                'data_type': 'settlement_data',
                'summary': self._summarize_settlement_data(data),
                'raw_data': data[:10],
                'total_count': len(data),
            }
        # ... 其他模块
```

#### 3.2 数据摘要生成

**目的**：减少 token 消耗，提取关键信息

**示例**：
```python
def _summarize_insar_data(self, data: List[Dict]) -> str:
    """
    将 InSAR 数据摘要为文本
    """
    if not data:
        return "当前没有 InSAR 数据"

    total = len(data)
    avg_velocity = sum(d['velocity'] for d in data) / total
    max_velocity = max(d['velocity'] for d in data)
    min_velocity = min(d['velocity'] for d in data)

    anomalies = [d for d in data if abs(d['velocity']) > 10]

    summary = f"""
    InSAR 数据摘要：
    - 总点位数：{total}
    - 平均速率：{avg_velocity:.2f} mm/年
    - 最大速率：{max_velocity:.2f} mm/年
    - 最小速率：{min_velocity:.2f} mm/年
    - 异常点数：{len(anomalies)}
    """

    if anomalies:
        summary += "\n异常点详情：\n"
        for a in anomalies[:5]:  # 只列出前5个
            summary += f"  - {a['point_id']}: {a['velocity']:.2f} mm/年\n"

    return summary.strip()
```

---

### 第四阶段：Prompt 工程（1-2天）

#### 4.1 动态 Prompt 构建

**文件**：`backend/modules/assistant/prompt_builder.py`

**功能**：
- 根据意图、上下文、检索数据构建 prompt
- 优化 prompt 结构，提高回答质量
- 控制 token 数量

**Prompt 模板**：
```python
class PromptBuilder:
    def build_prompt(
        self,
        question: str,
        intent: IntentType,
        page_context: Dict,
        retrieved_data: Dict,
    ) -> str:
        """
        构建完整的 prompt
        """
        # 系统角色定义
        system_role = self._get_system_role(intent)

        # 上下文信息
        context_info = self._format_context(page_context)

        # 检索数据
        data_info = self._format_retrieved_data(retrieved_data)

        # 组装 prompt
        prompt = f"""
{system_role}

## 当前页面信息
{context_info}

## 相关数据
{data_info}

## 用户问题
{question}

## 回答要求
1. 基于上述数据回答问题，不要编造数据
2. 如果数据不足，明确说明需要哪些额外信息
3. 使用 Markdown 格式，排版清晰
4. 中文回答，简洁明确
5. 如果涉及数值，保留2位小数
"""
        return prompt.strip()

    def _get_system_role(self, intent: IntentType) -> str:
        """
        根据意图返回系统角色定义
        """
        roles = {
            IntentType.DATA_QUERY: "你是一个数据查询助手，擅长从监测数据中提取关键信息。",
            IntentType.DATA_ANALYSIS: "你是一个数据分析专家，擅长分析监测数据的趋势和模式。",
            IntentType.ANOMALY_CHECK: "你是一个异常检测专家，擅长识别监测数据中的异常情况。",
            IntentType.EXPLANATION: "你是一个技术文档专家，擅长解释系统功能和术语。",
            # ... 其他角色
        }
        return roles.get(intent, "你是一个智能助手。")
```

#### 4.2 针对不同意图的 Prompt 优化

**数据查询类**：
```
你是一个数据查询助手。用户正在查看 InSAR 监测页面。

当前页面数据摘要：
- 总点位数：150
- 平均速率：-2.3 mm/年
- 异常点数：5

用户问题：最新的沉降速率是多少？

请基于上述数据回答，格式如下：
### 数据概览
- 关键指标1
- 关键指标2

### 详细说明
...
```

**异常检查类**：
```
你是一个异常检测专家。用户正在查看 InSAR 监测页面。

检测到的异常点：
1. S001: -15.2 mm/年（超限）
2. S005: -12.8 mm/年（超限）
3. S010: -11.5 mm/年（接近阈值）

用户问题：有没有异常点？

请分析异常情况，格式如下：
### 异常概况
- 异常点数量
- 严重程度分布

### 异常详情
| 点位 | 速率 | 状态 | 建议 |
|------|------|------|------|
...

### 处置建议
...
```

---

### 第五阶段：后端 API 集成（1-2天）

#### 5.1 修改 assistant API

**文件**：`backend/modules/assistant/api.py`

**改动**：
```python
@assistant_bp.route("/chat", methods=["POST"])
def assistant_chat():
    body = request.get_json(silent=True) or {}
    question = body.get("question", "").strip()
    page_context = body.get("pageContext", {})  # 新增：接收页面上下文

    # 1. 意图识别
    intent_result = classify_intent(question, page_context.get('pagePath', ''))
    intent = intent_result['intent']
    entities = intent_result['entities']

    # 2. 数据检索
    retriever = DataRetriever()
    retrieved_data = retriever.retrieve(intent, entities, page_context)

    # 3. Prompt 构建
    prompt_builder = PromptBuilder()
    full_prompt = prompt_builder.build_prompt(
        question=question,
        intent=intent,
        page_context=page_context,
        retrieved_data=retrieved_data,
    )

    # 4. 调用大模型
    response = call_deepseek(full_prompt)

    return jsonify({
        "status": "success",
        "answerMarkdown": response,
        "metadata": {
            "intent": intent.value,
            "dataSource": retrieved_data.get('data_type'),
            "recordCount": retrieved_data.get('total_count'),
        }
    })
```

#### 5.2 创建数据 API 代理

**目的**：统一数据访问接口，方便检索器调用

**文件**：`backend/modules/assistant/data_proxy.py`

```python
class DataProxy:
    """
    数据代理，统一访问各模块的数据
    """
    def get_insar_data(self, filters: Dict = None) -> List[Dict]:
        # 调用 InSAR API
        pass

    def get_settlement_data(self, filters: Dict = None) -> List[Dict]:
        # 调用沉降 API
        pass

    def get_anomalies(self, module: str) -> List[Dict]:
        # 调用异常检测 API
        pass

    def get_analysis_result(self, module: str, point_id: str) -> Dict:
        # 调用分析 API
        pass
```

---

### 第六阶段：前端集成（1天）

#### 6.1 修改 FloatingAssistant 组件

**文件**：`frontend/src/components/assistant/FloatingAssistant.tsx`

**改动**：
```typescript
// 1. 获取页面上下文
const pageContext = usePageContext();  // 新增 hook

// 2. 发送请求时包含上下文
async function handleAsk() {
  const res = await fetch(`${API_BASE}/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: q,
      pageContext: pageContext,  // 新增：发送页面上下文
    }),
  });
  // ...
}
```

#### 6.2 创建页面上下文 Hook

**文件**：`frontend/src/hooks/usePageContext.ts`

```typescript
export function usePageContext(): PageContext {
  const location = useLocation();
  const [context, setContext] = useState<PageContext | null>(null);

  useEffect(() => {
    // 根据当前路由，提取页面上下文
    const extractContext = async () => {
      const path = location.pathname;

      if (path === '/insar') {
        const data = await fetchInsarData();
        setContext({
          pagePath: path,
          pageTitle: 'InSAR 监测',
          moduleKey: 'insar',
          dataSnapshot: {
            summary: summarizeInsarData(data),
            // ...
          },
        });
      }
      // ... 其他页面
    };

    extractContext();
  }, [location.pathname]);

  return context;
}
```

---

## 测试用例

### 测试场景 1：InSAR 页面数据查询

**用户问题**：最新的沉降速率是多少？

**期望流程**：
1. 识别意图：DATA_QUERY
2. 检索数据：调用 `/api/insar/data`
3. 数据摘要：平均速率 -2.3 mm/年
4. 生成回答：基于实际数据回答

**期望回答**：
```
### 当前沉降速率概况

根据最新的 InSAR 监测数据（共150个点位）：

- **平均沉降速率**：-2.3 mm/年
- **最大沉降速率**：-15.2 mm/年（点位 S001）
- **最小沉降速率**：+1.5 mm/年（点位 S120）

### 异常情况

检测到 5 个异常点位，速率超过 -10 mm/年：
- S001: -15.2 mm/年
- S005: -12.8 mm/年
- S010: -11.5 mm/年

建议重点关注这些点位。
```

### 测试场景 2：异常检查

**用户问题**：有没有异常点？

**期望流程**：
1. 识别意图：ANOMALY_CHECK
2. 检索数据：调用 `/api/ml/anomalies`
3. 生成回答：列出异常点和建议

### 测试场景 3：数据对比

**用户问题**：S001 和 S002 哪个更严重？

**期望流程**：
1. 识别意图：COMPARISON
2. 提取实体：S001、S002
3. 检索数据：获取这两个点的数据
4. 生成回答：对比分析

---

## 技术栈

### 后端
- **意图识别**：规则 + 关键词匹配（可扩展为 NLP 模型）
- **数据检索**：直接调用现有 API
- **Prompt 构建**：模板 + 动态填充
- **大模型**：DeepSeek API

### 前端
- **上下文提取**：React Context + Hooks
- **数据获取**：现有 API 调用
- **UI 集成**：修改 FloatingAssistant 组件

---

## 优化方向

### 短期优化（1-2周内）
1. **缓存机制**：缓存常见问题的回答
2. **流式输出**：支持 SSE，实时显示回答
3. **多轮对话**：支持上下文记忆

### 中期优化（1-2月内）
1. **向量检索**：引入向量数据库（Milvus/Qdrant）
2. **文档索引**：索引系统文档和帮助文档
3. **智能推荐**：根据页面内容推荐问题

### 长期优化（3月+）
1. **Fine-tuning**：基于用户反馈微调模型
2. **多模态**：支持图表识别和分析
3. **自动化报告**：自动生成分析报告

---

## 风险和挑战

### 技术风险
1. **Token 消耗**：上下文过大导致成本增加
   - 解决：数据摘要、智能截断
2. **响应延迟**：数据检索 + 大模型调用耗时
   - 解决：异步处理、流式输出
3. **数据一致性**：页面数据和检索数据不一致
   - 解决：实时检索、版本标记

### 业务风险
1. **回答准确性**：大模型可能产生幻觉
   - 解决：数据验证、置信度标记
2. **用户体验**：回答不符合预期
   - 解决：用户反馈、持续优化

---

## 时间估算

| 阶段 | 工作量 | 时间 |
|------|--------|------|
| 第一阶段：页面上下文提取器 | 中 | 2-3天 |
| 第二阶段：智能问题分析器 | 小 | 1-2天 |
| 第三阶段：数据检索器 | 中 | 2-3天 |
| 第四阶段：Prompt 工程 | 小 | 1-2天 |
| 第五阶段：后端 API 集成 | 小 | 1-2天 |
| 第六阶段：前端集成 | 小 | 1天 |
| **总计** | | **8-13天** |

---

## 下一步行动

1. **确认方案**：确认技术路线和实施优先级
2. **准备环境**：确保 DeepSeek API 可用
3. **开始实施**：从第一阶段开始，逐步推进

---

## 附录：关键代码示例

### A. 意图识别示例

```python
# backend/modules/assistant/intent_classifier.py

INTENT_KEYWORDS = {
    IntentType.DATA_QUERY: ['多少', '数据', '值', '最新', '当前', '查询'],
    IntentType.ANOMALY_CHECK: ['异常', '超限', '预警', '风险', '问题', '告警'],
    IntentType.DATA_ANALYSIS: ['趋势', '分析', '变化', '对比', '统计'],
    IntentType.PREDICTION: ['预测', '未来', '会不会', '可能'],
    IntentType.EXPLANATION: ['是什么', '什么意思', '解释', '含义'],
}

def classify_intent(question: str, page_path: str) -> Dict[str, Any]:
    question_lower = question.lower()
    scores = {}

    for intent, keywords in INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in question_lower)
        scores[intent] = score

    best_intent = max(scores, key=scores.get)
    confidence = scores[best_intent] / len(INTENT_KEYWORDS[best_intent])

    return {
        'intent': best_intent,
        'confidence': confidence,
        'entities': extract_entities(question),
    }
```

### B. 数据摘要示例

```python
# backend/modules/assistant/data_summarizer.py

def summarize_data(data: List[Dict], data_type: str) -> str:
    if not data:
        return "暂无数据"

    if data_type == 'insar':
        return f"""
InSAR 数据摘要（共 {len(data)} 个点位）：
- 平均速率：{mean([d['velocity'] for d in data]):.2f} mm/年
- 速率范围：{min([d['velocity'] for d in data]):.2f} ~ {max([d['velocity'] for d in data]):.2f} mm/年
- 异常点数：{len([d for d in data if abs(d['velocity']) > 10])}
"""
    # ... 其他数据类型
```

### C. Prompt 模板示例

```python
# backend/modules/assistant/prompt_templates.py

DATA_QUERY_TEMPLATE = """
你是一个数据查询助手，正在帮助用户查询 {module_name} 的监测数据。

## 当前页面
- 页面：{page_title}
- 模块：{module_key}

## 数据摘要
{data_summary}

## 用户问题
{question}

## 回答要求
1. 基于上述数据摘要回答问题
2. 使用 Markdown 格式
3. 如果数据中有异常，主动提醒用户
4. 保留2位小数
"""
```

---

**计划制定完成，等待确认后开始实施。**
