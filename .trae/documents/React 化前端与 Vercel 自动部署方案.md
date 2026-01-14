## 分支策略
- 新建前端迁移分支：feat/react-migration（或你指定命名）
- 在该分支完成 React 化与 Vercel 配置，保持现有分支不受影响；完成后按你的节奏合并

## 目标
- 前端迁移为 React（Vite + React + TS），路由与交互完整对齐现状
- 保持后端 API 可用；在 Vercel 上实现自动识别与部署（两种备选方案）

## 前端架构
- 技术栈：Vite、React、TypeScript、react-router-dom、ECharts、three.js（GLTFLoader/OrbitControls）
- 目录：web/src/pages（Settlement/Temperature/Cracks/Vibration/Insar/Overview/ThreeModel/SettlementVideo/Tickets）、components、hooks、lib/api.ts、styles；public 静态资源
- 路由顺序：/settlement、/temperature、/cracks、/vibration、/insar、/overview、/three、/settlement-video、/tickets；/ 显示封面或跳转到 /settlement
- 图表与 3D：封装 useEchartsHook、useThreeViewer；保留现有视觉与默认数据展示

## 后端在 Vercel 的自动识别（二选一）
- 方案 A：Serverless Functions（Python）在 /api 创建函数文件，映射现有端点；api/requirements.txt 声明依赖；Vercel 自动识别
- 方案 B：后端独立托管（保留 Flask），在 vercel.json 配置 rewrites 将 /api/** 代理到后端，前端“零手动”部署
- 默认选 B 以最快落地；若你偏好“全托管在 Vercel”，改选 A

## Vercel 配置
- 前端：Vite 默认识别；vercel.json 设置 outputDirectory（dist）与（方案 B）rewrites
- 环境变量：DATABASE_* 在 Vercel Project 设置中配置

## 迁移步骤
1. 新建分支 feat/react-migration
2. 初始化 web（Vite + React + TS）、统一导航与页面骨架
3. 迁移各页面逻辑与样式，抽象 api.ts 与 hooks
4. 实施方案 A 或 B（按偏好选择）；联调接口
5. 部署到 Vercel，端到端验证

## 交付
- 完整 React 前端与 Vercel 配置
- 后端部署（Serverless 或代理）与文档
- README：本地开发、环境变量、部署说明、页面路由

确认后我将创建分支并开始实施；若需要修改分支名或优先选择方案 A，请说明。