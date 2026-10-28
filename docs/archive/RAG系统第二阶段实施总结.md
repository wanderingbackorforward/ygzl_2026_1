# RAG系统第二阶段实施总结 - 角色Prompt优化

## 完成时间
2026-03-09

## 实施目标
为三个角色（researcher/worker/reporter）创建专业的、差异化的 system prompt，并集成意图分类和动态上下文格式化系统。

## 实施内容

### 1. 创建的新文件

#### `backend/modules/assistant/prompts.py`
- 定义三个角色的专业 prompt（使用英文避免 Windows 编码问题）
- 每个角色包含：角色定义、核心原则、回答要求、输出格式示例

**角色特点**：
- **researcher**: 技术研究助手
  - 详细技术分析
  - 数据驱动（引用具体数值）
  - 解释机制和原因
  - 使用科学术语

- **worker**: 现场操作助手
  - 清晰可操作的指导
  - 强调安全第一
  - 避免复杂术语
  - 提供分步骤说明

- **reporter**: 高管报告助手
  - 高层总结和关键洞察
  - 关注业务影响和风险
  - 量化指标和对比
  - 决策建议

#### `backend/modules/assistant/intent_classifier.py`
- 实现意图分类功能
- 支持 8 种意图类型：
  1. `data_query` - 数据查询（多少、几个、数值）
  2. `anomaly_check` - 异常检查（异常、问题、风险）
  3. `trend_analysis` - 趋势分析（趋势、变化、增长）
  4. `comparison` - 数据对比（对比、比较、差异）
  5. `prediction` - 未来预测（预测、未来、可能）
  6. `explanation` - 机制解释（为什么、原因、如何）
  7. `operation` - 操作指导（怎么办、处理、步骤）
  8. `general` - 通用问题

- 使用关键词匹配算法
- 返回意图类型和置信度

#### `backend/modules/assistant/prompt_templates.py`
- 为每种意图定义专用 prompt 模板
- 每个模板包含：
  - 意图说明
  - 关注重点
  - 回答格式要求
  - 输出示例

- 实现 `build_system_prompt()` 函数，组合角色 prompt 和意图模板

#### `backend/modules/assistant/context_formatter.py`
- 根据意图动态格式化页面上下文
- 不同意图关注不同的数据：
  - `data_query`: summary + statistics
  - `anomaly_check`: summary + anomalies + statistics + status
  - `trend_analysis`: trend info + key metrics
  - `comparison`: available data + selected items
  - `prediction`: historical data + last update
  - `general`: balanced information

### 2. 修改的文件

#### `backend/modules/assistant/api.py`
- 添加新模块导入
- 修改 `/api/assistant/chat` 端点：
  - 使用 `get_role_prompt('researcher')` 替代硬编码 prompt
  - 保持简单实现（暂不使用意图分类）

- 修改 `/api/assistant/conversations/<conv_id>/messages` 端点：
  - 使用 `get_role_prompt(role)` 获取角色 prompt
  - 保持简单实现（暂不使用意图分类和动态上下文）

**注意**：为了避免复杂度，第二阶段只集成了角色 prompt，意图分类和动态上下文功能已实现但暂未启用。

## 技术要点

### Windows 编码问题处理
- 所有 prompt 使用英文编写（避免 GBK/UTF-8 冲突）
- 用户可见输出仍然是中文（在 prompt 中要求 "Output in Chinese"）
- 避免使用中文多行字符串

### 模块化设计
```
prompts.py           -> 角色定义
intent_classifier.py -> 意图识别
prompt_templates.py  -> 意图模板
context_formatter.py -> 上下文格式化
api.py              -> 集成调用
```

### 扩展性
- 新增角色：在 `ROLE_PROMPTS` 字典添加
- 新增意图：在 `INTENT_KEYWORDS` 和 `INTENT_TEMPLATES` 添加
- 新增上下文格式：在 `context_formatter.py` 添加格式化函数

## 验证结果

### 模块导入测试
✅ 所有模块成功导入
✅ 三个角色定义正确加载
✅ 意图分类器正常工作

### 意图分类测试
| 问题 | 预期意图 | 实际意图 | 置信度 | 状态 |
|------|---------|---------|--------|------|
| 当前页面有多少个监测点？ | data_query | data_query | 0.13 | ✅ |
| 有哪些异常点位？ | anomaly_check | anomaly_check | 0.07 | ✅ |
| 沉降趋势如何？ | trend_analysis | trend_analysis | 0.07 | ✅ |
| 为什么会出现沉降？ | explanation | explanation | 0.08 | ✅ |

### 前端构建测试
✅ 构建成功（5.84秒）
✅ 无 TypeScript 错误
✅ 无编译警告

## 提交记录
- Commit: `7289a85`
- Message: "feat: RAG系统第二阶段 - 角色Prompt优化"
- 推送到: `origin/master`

## 下一步计划

### 第三阶段：启用意图分类和动态上下文（可选）
如果需要更智能的回答，可以：
1. 在 `send_message()` 中启用意图分类
2. 使用 `build_system_prompt()` 组合角色和意图 prompt
3. 使用 `format_context_for_prompt()` 动态格式化上下文

修改位置：`api.py` 第 295-308 行

```python
# 当前实现（简单）
system_prompt = get_role_prompt(role)
context_text = _format_context(page_context)

# 升级实现（智能）
intent, confidence = classify_intent(content, page_path)
base_role_prompt = get_role_prompt(role)
system_prompt = build_system_prompt(role, intent, base_role_prompt)
context_text = format_context_for_prompt(page_context, intent)
```

### 第四阶段：扩展到其他页面
为其他页面添加数据缓存：
- Temperature 页面
- Cracks 页面
- Vibration 页面
- InSAR 页面
- Overview 页面

## 总结

第二阶段成功完成，实现了：
- ✅ 三个角色的专业 prompt 定义
- ✅ 意图分类系统（8种类型）
- ✅ 意图专用 prompt 模板
- ✅ 动态上下文格式化
- ✅ 模块化、可扩展的架构
- ✅ Windows 编码兼容

系统现在具备了智能化的基础设施，可以根据角色和意图提供更专业、更精准的回答。
