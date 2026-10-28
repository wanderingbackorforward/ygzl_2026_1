# 卡片系统重构计划

## 目标
将沉降、温度、裂缝、振动 4 个页面的卡片从 iframe 静态 HTML 迁移到 React 组件，实现拖拽移动、缩放大小、折叠/展开、全屏放大功能。

## 技术选型

| 方案 | 选择 | 理由 |
|------|------|------|
| 网格布局库 | `react-grid-layout@^2.0.0` | 内置拖拽+缩放+响应式断点，开箱即用 |
| 状态管理 | React Context + localStorage | 轻量级，满足布局持久化需求 |
| 图表库 | ECharts 5.5 (已有) | 保持现有图表逻辑，迁移到 React 组件 |

## 新增依赖

```bash
npm install react-grid-layout@^2.0.0
```

## 文件结构

```
frontend/src/
├── components/
│   ├── cards/
│   │   ├── CardBase.tsx           # 基础卡片容器（标题、操作按钮、拖拽手柄）
│   │   ├── ChartCard.tsx          # ECharts 图表卡片
│   │   ├── TableCard.tsx          # 数据表格卡片
│   │   └── StatsCard.tsx          # 统计指标卡片
│   │
│   ├── charts/
│   │   ├── EChartsWrapper.tsx     # ECharts 实例管理
│   │   ├── cyberpunkTheme.ts      # 赛博朋克主题配置
│   │   ├── TrendChart.tsx         # 趋势分析图
│   │   ├── DistributionChart.tsx  # 分布饼图
│   │   ├── TimeSeriesChart.tsx    # 时间序列图
│   │   └── RateChart.tsx          # 速率图
│   │
│   ├── layout/
│   │   ├── DashboardGrid.tsx      # react-grid-layout 包装器
│   │   └── FullscreenModal.tsx    # 全屏查看模态框
│   │
│   └── shared/
│       ├── PointSelector.tsx      # 监测点选择器
│       └── LoadingState.tsx       # 加载状态
│
├── contexts/
│   ├── LayoutContext.tsx          # 布局状态管理
│   └── PageDataContext.tsx        # 页面数据共享（选中点等）
│
├── hooks/
│   ├── useLayoutPersistence.ts    # localStorage 读写
│   ├── useChartResize.ts          # 图表自适应缩放
│   └── useSettlementData.ts       # 沉降数据获取
│
├── styles/
│   ├── variables.css              # CSS 变量（从 style.css 迁移）
│   ├── cards.css                  # 卡片样式
│   └── grid.css                   # 网格布局样式
│
├── types/
│   ├── api.ts                     # API 响应类型
│   └── layout.ts                  # 布局配置类型
│
└── pages/
    ├── Settlement.tsx             # 重构后的沉降页面
    ├── Temperature.tsx            # 重构后的温度页面
    ├── Cracks.tsx                 # 重构后的裂缝页面
    └── Vibration.tsx              # 重构后的振动页面
```

## 核心组件设计

### 1. CardBase - 基础卡片

```tsx
interface CardBaseProps {
  id: string;
  title: string;
  icon?: string;
  collapsed?: boolean;
  onToggleCollapse: () => void;
  onFullscreen: () => void;
  children: React.ReactNode;
}
```

功能：
- 统一的卡片头部（标题、图标）
- 操作按钮（折叠、全屏、重置）
- 拖拽手柄区域
- 折叠/展开动画

### 2. DashboardGrid - 网格布局

```tsx
interface DashboardGridProps {
  pageId: string;
  cards: CardConfig[];
}

interface CardConfig {
  id: string;
  component: React.ComponentType;
  defaultLayout: { x, y, w, h, minW, minH, maxW, maxH };
}
```

功能：
- 12 列响应式网格
- 断点：lg(1200px), md(996px), sm(768px)
- 布局变化时自动保存到 localStorage
- 支持重置为默认布局

### 3. EChartsWrapper - 图表容器

```tsx
interface EChartsWrapperProps {
  option: EChartsOption;
  loading?: boolean;
  style?: React.CSSProperties;
}
```

功能：
- 自动注册赛博朋克主题
- ResizeObserver 监听容器尺寸变化
- 自动调用 chart.resize()

## 实施步骤

### 阶段 1：基础架构（步骤 1-5）

1. 安装 `react-grid-layout` 依赖
2. 创建 `styles/variables.css`，迁移 CSS 变量
3. 创建 `styles/cards.css` 和 `styles/grid.css`
4. 实现 `CardBase.tsx` 基础卡片组件
5. 实现 `DashboardGrid.tsx` 网格布局组件

### 阶段 2：图表组件（步骤 6-10）

6. 实现 `EChartsWrapper.tsx` 和 `cyberpunkTheme.ts`
7. 实现 `useChartResize.ts` 钩子
8. 实现 `LayoutContext.tsx` 布局状态管理
9. 实现 `useLayoutPersistence.ts` 本地存储
10. 实现 `FullscreenModal.tsx` 全屏模态框

### 阶段 3：沉降页面迁移（步骤 11-15）

11. 定义 `types/api.ts` 中的沉降数据类型
12. 实现 `useSettlementData.ts` 数据获取钩子
13. 迁移 `TrendChart.tsx`（趋势分析柱状图）
14. 迁移 `DistributionChart.tsx`（监测点分布饼图）
15. 迁移 `TimeSeriesChart.tsx` 和 `RateChart.tsx`
16. 重构 `Settlement.tsx` 页面

### 阶段 4：其他页面迁移（步骤 17-22）

17. 迁移温度页面图表组件
18. 重构 `Temperature.tsx`
19. 迁移裂缝页面图表组件
20. 重构 `Cracks.tsx`
21. 迁移振动页面图表组件
22. 重构 `Vibration.tsx`

### 阶段 5：优化和测试（步骤 23-25）

23. 添加折叠/展开动画效果
24. 性能优化（React.memo, useMemo）
25. 全面测试所有交互功能

## 关键文件参考

| 现有文件 | 用途 |
|----------|------|
| `static/js/charts.js` (1894行) | ECharts 配置和图表更新函数，需迁移 |
| `static/css/style.css` (1700+行) | CSS 变量和卡片样式，需提取 |
| `backend/modules/api/api_server.py` | API 端点参考，保持不变 |
| `frontend/src/lib/api.ts` | 现有 API 工具，扩展类型 |

## 卡片配置示例（沉降页面）

```typescript
const SETTLEMENT_CARDS: CardConfig[] = [
  {
    id: 'trend-chart',
    component: TrendChart,
    defaultLayout: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'distribution',
    component: DistributionChart,
    defaultLayout: { x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'time-series',
    component: TimeSeriesChart,
    defaultLayout: { x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'rate-chart',
    component: RateChart,
    defaultLayout: { x: 6, y: 4, w: 6, h: 4, minW: 4, minH: 3 }
  },
  {
    id: 'point-selector',
    component: PointSelector,
    defaultLayout: { x: 0, y: 8, w: 4, h: 3, minW: 3, minH: 2 }
  },
  {
    id: 'point-details',
    component: PointDetails,
    defaultLayout: { x: 4, y: 8, w: 8, h: 3, minW: 4, minH: 2 }
  }
];
```

## 验证方案

### 功能测试清单

- [ ] 卡片可以拖拽到任意位置
- [ ] 卡片可以通过右下角手柄缩放
- [ ] 缩放时图表自动适应新尺寸
- [ ] 点击折叠按钮卡片最小化
- [ ] 点击全屏按钮显示模态框
- [ ] 刷新页面后布局保持不变
- [ ] 点击重置按钮恢复默认布局
- [ ] 响应式断点正常工作 (lg/md/sm)
- [ ] 所有 API 数据正确加载
- [ ] 选中监测点后相关卡片联动更新

### 测试命令

```bash
# 启动开发服务器
cd frontend && npm run dev

# 启动后端 API
cd backend && python -m modules.api.api_server

# 构建测试
npm run build
```

## 后端接口（保持不变）

```
GET /api/summary          - 沉降汇总数据
GET /api/point/:id        - 单点详情
GET /api/trends           - 趋势统计
GET /api/temperature/*    - 温度相关
GET /api/crack/*          - 裂缝相关
```

## 风险和缓解

| 风险 | 缓解措施 |
|------|----------|
| ECharts 拖拽时抖动 | 使用 ResizeObserver + 防抖 |
| 图表数量多性能问题 | 懒加载 + React.memo |
| 布局迁移中断服务 | 保留旧 HTML 作为回退 |
