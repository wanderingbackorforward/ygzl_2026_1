## 问题与目标
- 每页多个框导致大块空白、部分内容需缩放才能看到。
- 目标：在不改技术栈的前提下，实现自动排版与视图自适配，减少空白、保证所有框可见。

## 技术栈定位
- 后端：Flask + Jinja2 模板 [api_server.py](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/repo_src/modules/api/api_server.py#L149-L156)
- 前端：静态 HTML + 原生 JS/Three.js（如 [three_test.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/three_test.html)、[three_viewer.js](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/js/three_viewer.js#L495-L509)）

## 布局改造方案
- 引入通用栅格容器（CSS Grid），自动填充与密排：
  - 容器：grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  - 使用 grid-auto-flow: dense; 减少空白。
- 卡片统一样式：固定内边距、阴影、最小高度，移除页面中的绝对定位与固定宽高。
- 保留必要 Flex 布局用于居中 Three.js 画布。

示例（新增通用布局样式）：
```css
.dashboard-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;grid-auto-flow:dense}
.card{min-height:260px;border:1px solid rgba(0,229,255,.2);border-radius:8px;background:rgba(0,0,0,.2)}
```

## Three.js 自适应
- 尺寸同步：renderer.setSize(container.clientWidth, container.clientHeight) 已有，补充 ResizeObserver，确保容器尺寸变化即刻更新。
- 相机适配：在模型加载完成后调用“fit to bounds”，使用现有逻辑 [three_viewer.js](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/js/three_viewer.js#L438-L460) 并在加载成功回调与容器尺寸变化时触发。
- 视口策略：保持滚动而非隐藏重要内容；仅对 Three.js 画布区域使用 overflow:hidden。

## 改动范围
- 统一样式文件：static/css/layout.css（新增）
- 统一逻辑文件：static/js/layout.js（新增 ResizeObserver/密排辅助）
- 页面应用与微调：
  - [settlement.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/settlement.html)
  - [cracks.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/cracks.html)
  - [temperature.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/temperature.html)
  - [vibration.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/vibration.html)
  - [overview.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/overview.html) 与 [overview_viewer.js](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/js/overview_viewer.js)
  - [three_test.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/three_test.html) 与 [three_viewer.js](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/static/js/three_viewer.js)
  - 模板页： [templates/index.html](file:///d:/Self-Made%20Digital%20Twin%20Terrain%20Settlement%20(V1)/python_scripts/templates/index.html)

## 交互与回退
- 在 layout.js 中提供全局开关（window.APP_AUTO_LAYOUT=true/false）。
- 若特定页面布局冲突，可在页面局部禁用自动密排。

## 验证步骤
- 本地启动后访问各页面：确认栅格自动密排、卡片最小高度、Three.js 画布可见并随窗口自适应，无需手动缩放。
- 模型加载后相机自动适配边界，减少“看不到”的情况。

## Git 流程
- 新建分支：feature/auto-layout
- 提交粒度：
  - 提交1：新增 layout.css / layout.js
  - 提交2：页面应用栅格样式与移除固定定位
  - 提交3：Three.js 自适配与相机适配触发
- 合并策略：合并到主分支（main），优先使用无冲突快进。若存在冲突，按页面逐一解决。
- 若验证失败：回滚此合并或关闭开关快速回退。

确认后我将按该方案实施、创建分支并完成合并。