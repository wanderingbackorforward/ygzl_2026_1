## 目标
- 把当前 React 的占位页全部实现为可用页面，功能与交互对齐现有静态版与老 JS 逻辑
- 保留既有视觉风格与容器 ID，确保后端 /api 接口无需变更即可联通

## 总体技术方案
- 复用前端静态版的 JS 逻辑，抽象为 React Hook/模块
  - 图表：封装 useEcharts(options, deps)；迁移 charts.js、temperature_charts.js、cracks_charts.js、vibration_charts.js 的初始化与更新
  - 三维：封装 useThreeViewer({ canvasRef })；迁移 three_viewer.js/overview_viewer.js 的初始化与 goToViewpoint 映射
  - 工单：封装 useTicketsApi()（列表、分页、筛选、详情/创建），复用 tickets.js 的渲染与状态机
- 保留/迁移 CSS：直接沿用 repo_src/static/css 下的样式，或按页面拆分导入，保持风格一致
- 数据：沿用现有 /api 端点（/api/summary、/api/point/:id、/api/tickets* 等），统一 fetch 封到 web/src/lib/api.ts

## 页面实现明细
- Settlement（沉降）
  - 组件：趋势分析、分布饼图、点位选择器、时间序列、速率图、点位详情
  - 行为：页面加载→调用 /api/summary→填充点位选择器→默认选首个监测点→联动图表；选择变更→加载 /api/point/:id 并调用 goToViewpoint
- Temperature（温度）
  - 组件：统计概览表格、分析项统计（徽章）、图表容器
  - 行为：页面加载→调用温度相关 /api（已存在的端点）→渲染图表与表格
- Cracks（裂缝）
  - 组件：总体趋势、统计概览、日变化分布、大图（多点趋势）、数据详情表
  - 行为：加载与交互复刻 cracks_charts.js 的逻辑
- Vibration（振动）
  - 组件：指标概览（均值/标准差/峰值/RMS）、时频图等
  - 行为：复刻 vibration_charts.js；保留数据集选择与刷新
- Overview（数据总览）
  - 组件：3D 视图画布、视角按钮、左右面板
  - 行为：迁移 overview_viewer.js 与 Three 初始化；按钮切换视角
- ThreeModel（3D 模型）
  - 组件：画布、加载指示、模型选择、简单交互
  - 行为：迁移 three_viewer.js 的最小查看器功能
- SettlementVideo（沉降视频）
  - 组件：双视频播放器（入口/中段），本地或远端源
- Insar（已完成）
  - React iframe 已嵌入 http://47.96.7.238:38089/mapLayer，并提供“新窗口打开”按钮
- Tickets（工单）
  - 组件：筛选条、统计条、列表卡片、分页、详情模态、创建模态
  - 行为：复刻 tickets.js 的加载、渲染与状态切换；与 /api/tickets* 交互

## 代码组织
- web/src/pages：以上各页面
- web/src/components：Nav、ChartContainer、Modal、StatBadge、DataTable 等
- web/src/hooks：useEcharts、useThreeViewer、useTicketsApi、useFetch 等
- web/src/lib/api.ts：统一 GET/POST；错误重试
- 样式：直接导入现有 CSS 或按页面拆分

## 验证与交付
- 本地：npm run dev 访问各页面，完成端到端数据与交互验证
- 构建：npm run build 生成 dist；后端已支持 SPA 兜底；Vercel 使用 @vercel/static-build 自动识别
- 交付：完整 React 页面代码、hook 封装、保留 CSS、使用说明（README）

## 请求确认
- 如无其它偏好，我将按此计划逐页迁移并在本地跑通（沉降→工单→总览→其余页面），期间保持样式与行为一致，完成后推送到主分支。请确认后我立即开始实施。