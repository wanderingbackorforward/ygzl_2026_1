# Crack V1 现有架构分析

## 页面结构 (CracksNew.tsx - 89行)
- LayoutProvider + CracksProvider 双层 Context
- DashboardGrid 网格布局，9张卡片
- FullscreenModal 全屏查看
- 深色主题 radial-gradient 背景

## 9张卡片（当前布局）
| ID | 标题 | 位置 (x,y,w,h) | 组件 |
|----|------|----------------|------|
| crack-average-trend | 平均趋势 | 0,0,3,4 | CrackAverageTrendChart |
| crack-overview | 状态概览 | 0,4,3,3 | CrackOverviewPieChart |
| crack-daily | 日变化直方图 | 0,7,3,3 | CrackDailyHistogramChart |
| crack-point-selector | 监测点选择 | 3,0,6,2 | PointSelectorCard |
| crack-main-trend | 主趋势 | 3,2,6,5 | CrackMainTrendChart |
| crack-table | 数据表格 | 3,7,6,4 | CrackDataTableCard |
| crack-slope | 斜率趋势 | 9,0,3,3 | CrackSlopeChart |
| crack-rate | 平均变化速率 | 9,3,3,3 | CrackRateChart |
| crack-correlation | 相关性热力图 | 9,6,3,5 | CrackCorrelationHeatmap |

## 数据层 (CracksContext.tsx - 137行)
- useCrackPoints → `/crack/monitoring_points`
- useCrackTrend → `/crack/trend_data?point_id=X`
- useCrackOverview → `/crack/stats_overview`
- useCrackDailyHistogram → `/crack/analysis_results` (前端计算)
- useCrackSlope → `/crack/analysis_results`
- useCrackRate → `/crack/analysis_results`
- useCrackCorrelation → `/crack/analysis_results` (前端Pearson计算)

## 图表技术栈
- ECharts (EChartsWrapper) + cyberpunkTheme (NEON_COLORS)
- 每个图表组件 28-35行，极简

## 致命问题
1. **9张图平铺，无层次** — 用户打开就是"数据墙"
2. **无上下文** — 没有阈值线、没有安全/危险标注
3. **无结论** — 没有任何文字告诉用户"这个裂缝安全吗"
4. **图表标题是英文** — "Trend Analysis"违反中文规则
5. **所有图表一次加载** — 9个API同时请求
6. **相关性热力图只算自身3个指标** — 没有跨域关联
