# Mock 数据方案实施说明

## 背景

Vercel 部署环境无法安装大型机器学习库（scikit-learn, prophet 等），导致 ML API 返回 404 错误。为了保证前端功能完整展示，实施了智能 Mock 数据降级方案。

## 实施方案

### 1. 核心特性

#### 自动降级机制
- API 正常时使用真实数据
- API 404 时自动切换到 Mock 模式
- 全局 Mock 模式标志，避免重复检测
- 无缝切换，用户体验不受影响

#### 明确标注
- 右上角显示橙色"演示模式"徽章
- 脉冲动画吸引注意
- Hover 显示详细说明
- 控制台输出 Mock 日志

#### 真实感数据
- 基于物理规律生成（累积性、季节性、随机性）
- 模拟真实异常情况（5%概率）
- 合理的统计分布
- 符合工程实际的数值范围

### 2. 文件结构

```
frontend/src/
├── utils/
│   ├── mockData.ts          # Mock 数据生成器
│   └── apiClient.ts         # API 客户端（支持自动降级）
└── components/
    └── common/
        └── MockModeIndicator.tsx  # Mock 模式指示器
```

### 3. Mock 数据生成器

#### mockData.ts
包含以下生成函数：

1. **generateRealisticSettlement** - 生成符合物理规律的沉降数据
   - 累积性：沉降随时间累积
   - 季节性：温度影响的周期波动
   - 随机性：施工扰动
   - 异常点：5%概率的异常沉降

2. **generateMockAnomalies** - 生成批量异常检测结果
   - 每7个点有1个严重异常
   - 每4个点有1个高风险
   - 每3个点有1个中等风险
   - 其他点位正常

3. **generateMockRecommendations** - 生成处置建议
   - 严重异常：立即巡检 + 上报
   - 高风险：加密监测
   - 中等风险：持续关注

4. **generateMockPrediction** - 生成预测数据
   - 基于历史趋势延续
   - 置信区间（±15%）
   - 合理的模型指标（MAE, RMSE, MAPE）

5. **generateMockModelComparison** - 生成模型对比
   - ARIMA, SARIMA, Prophet 三个模型
   - 真实的性能指标差异

6. **generateMockSpatialCorrelation** - 生成空间关联
   - 基于距离的相关系数
   - 自动聚类分组

7. **generateMockCausalAnalysis** - 生成因果分析
   - DID/SCM 方法模拟
   - 事件前后对比
   - 处理效应计算

### 4. API 客户端

#### apiClient.ts
核心功能：

```typescript
async function fetchWithFallback<T>(
  url: string,
  options?: RequestInit,
  mockGenerator?: () => T
): Promise<T>
```

- 检测 Mock 模式标志
- 捕获 404 错误自动降级
- 捕获网络错误自动降级
- 模拟 300ms 网络延迟
- 控制台输出降级日志

导出的 API 函数：
- `fetchBatchAnomalies` - 批量异常检测
- `fetchRecommendations` - 处置建议
- `fetchAutoPrediction` - 自动预测
- `fetchModelComparison` - 模型对比
- `fetchSpatialCorrelation` - 空间关联
- `fetchCausalAnalysis` - 因果分析

### 5. Mock 模式指示器

#### MockModeIndicator.tsx
- 固定在右上角
- 橙色徽章 + 烧瓶图标
- 脉冲动画（2秒周期）
- Hover 显示 tooltip
- 每秒检测 Mock 模式状态

### 6. 组件集成

已更新以下组件使用新的 API 客户端：

1. **AnomalyDashboard.tsx**
   - 使用 `fetchBatchAnomalies`
   - 数据格式转换

2. **RecommendationDashboard.tsx**
   - 使用 `fetchRecommendations`
   - 数据格式转换

3. **PredictionDashboard.tsx**
   - 使用 `fetchAutoPrediction`
   - 使用 `fetchModelComparison`

4. **CorrelationDashboard.tsx**
   - 使用 `fetchSpatialCorrelation`
   - 函数重命名避免冲突

5. **CausalAnalysis.tsx**
   - 使用 `fetchCausalAnalysis`

6. **AdvancedAnalysis.tsx**
   - 添加 `MockModeIndicator` 组件

## 使用说明

### 开发环境
- 本地开发时，如果后端 ML API 可用，使用真实数据
- 如果后端不可用，自动降级到 Mock 数据

### Vercel 部署
- 首次 API 调用返回 404 时自动切换到 Mock 模式
- 后续所有请求直接使用 Mock 数据
- 用户看到右上角"演示模式"徽章

### 生产环境
- 部署完整后端（包含 ML 服务）
- API 正常返回，不会触发 Mock 模式
- 不显示"演示模式"徽章

## Mock 数据特点

### 1. 沉降数据
- 基础沉降速率：-0.15 到 -0.35 mm/天
- 季节性波动：±0.5 mm（正弦曲线）
- 随机扰动：±0.3 mm
- 异常沉降：5%概率，±2 mm

### 2. 异常检测
- 严重异常（critical）：累积沉降 < -30 mm
- 高风险（high）：沉降速率 < -2 mm/天
- 中等风险（medium）：趋势持续增长
- 正常（normal）：无异常

### 3. 预测数据
- 基于最近30天趋势
- 置信区间：±15%
- 模型指标：MAE 0.45, RMSE 0.62, MAPE 3.2%

### 4. 空间关联
- 相关系数：基于点位距离计算
- 距离越近，相关性越高
- 自动分为4个聚类

### 5. 因果分析
- 事件前：处理组和对照组趋势相似
- 事件后：处理组沉降加速（-0.4 mm/天 vs -0.2 mm/天）
- 处理效应：约 -6 mm（30天窗口）

## 技术优势

1. **零配置**：无需手动切换，自动检测
2. **零侵入**：不影响现有代码逻辑
3. **高真实感**：数据符合物理规律
4. **明确标注**：用户知道是演示数据
5. **易维护**：集中管理 Mock 逻辑
6. **可扩展**：轻松添加新的 Mock 函数

## 构建结果

- 构建时间：6.08 秒
- AdvancedAnalysis 打包：115.98 kB (gzip: 26.66 kB)
- 无错误、无警告
- 新增代码：约 600 行

## 后续优化

### 短期
1. 添加手动切换 Mock 模式的开关（开发调试用）
2. Mock 数据持久化到 localStorage（避免刷新后重新生成）
3. 添加更多数据变化模式（不同工况）

### 长期
1. 实施方案3：分离部署（Railway/Render 部署 ML 服务）
2. 实施方案4：预计算 + 静态数据（定期更新）
3. 轻量级 ML 替代（使用 TensorFlow.js 在浏览器端运行）

## 总结

通过智能 Mock 数据方案，成功解决了 Vercel 部署环境无法安装 ML 库的问题。用户可以完整体验所有功能，同时明确知道当前是演示模式。生产环境部署完整后端时，自动使用真实数据，无需修改代码。
