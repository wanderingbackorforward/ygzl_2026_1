# Crack V2 - Crack Intelligence Center
# 裂缝智能中心 — 驾驶舱革命

> **革命性突破**: 不是6个图表卡片，而是**飞行员驾驶舱式单一界面**
>
> - **乔布斯**: 0.5秒看懂是否安全（Master Caution灯），不需要读任何图表
> - **工程师**: 告诉我该派谁去哪修什么，不是给我看雷达图
> - **科研**: Wavelet分解 + Permutation Entropy + Hurst指数 + Moran's I空间聚类 — 2024-2025前沿

## 核心设计哲学（来自世界级系统研究）

| 灵感来源 | 核心原则 | 应用到裂缝监测 |
|---------|---------|--------------|
| **飞行员驾驶舱** | Master Caution一灯定乾坤 | 顶部单一健康指示灯：绿/黄/红 |
| **Bloomberg Terminal** | 颜色即信息，不读数字 | 色块网格，扫一眼知道哪个点有问题 |
| **Datadog监控** | Flatline = Happy | 正常时所有曲线都平，异常时自动凸显 |
| **Tesla仪表盘** | 15%屏幕永久显示生命体征 | 左侧固定条：3个关键数字永不滚动 |
| **振动V2成功模式** | 分层架构：算法→英雄→主图→抽屉 | 完全复用这个架构 |

---

## 数据库资产（已验证）

| 表名 | 关键字段 | 用途 |
|------|---------|------|
| `raw_crack_data` | measurement_date + 各监测点列 | 裂缝时序 |
| `crack_analysis_results` | avg_value, total_change, avg_daily_rate, trend_slope | 统计 |
| `processed_temperature_data` | SID, measurement_date, avg_temperature | **热膨胀分离** |
| `processed_settlement_data` | point_id, measurement_date, cumulative_change | **因果推断** |
| `monitoring_points` | point_id, x_coord, y_coord | **空间聚类** |

---

## 分层架构（复用振动V2成功模式）

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: Master Caution (0.5秒决策)                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [●] 结构健康: 良好 | 23个监测点 | 2个需关注             │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Vital Signs Strip (2秒扫描) — 永不滚动            │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│ │ 最大  │ │ 加速  │ │ 热主导│ │ 空间  │ │ 预警  │              │
│ │ 0.3mm│ │ 2点  │ │ 85%  │ │ 聚类  │ │ 0个  │              │
│ │ 🟢   │ │ 🟡   │ │ 🟢   │ │ 🟢   │ │ 🟢   │              │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Intelligence Engine (后台运行，不可见)             │
│ • Wavelet分解(分离趋势/热/噪声)                             │
│ • Permutation Entropy(健康指数)                             │
│ • Hurst指数(预测加速/稳定)                                  │
│ • CUSUM变点检测(早期预警)                                   │
│ • Moran's I空间聚类(传播前沿)                               │
│ • 热-结构分量分离                                           │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Hero Display (3秒理解核心问题)                     │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ [空间热力图] 23个监测点在结构平面图上                   │   │
│ │ • 绿点=健康  黄点=关注  红点=危险                       │   │
│ │ • 点击任意点 → 右侧抽屉展开详情                         │   │
│ └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Main Charts (10秒深入分析) — 可滚动               │
│ • 优先级排序列表(不是雷达图!)                               │
│ • 时序趋势(灰色置信带，线穿带=异常)                         │
│ • GB 50292等级卡(a/b/c/d徽章)                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Side Drawer (按需展开) — 深度诊断                  │
│ 点击任意监测点后展开:                                       │
│ • Wavelet分解图(趋势/季节/噪声)                             │
│ • 热-结构分离(温度叠加+相关系数)                            │
│ • CUSUM变点时间线                                           │
│ • 蠕变阶段识别(I/II/III期)                                  │
│ • 沉降因果分析(lag plot)                                    │
│ • Hurst指数趋势(稳定→加速预警)                             │
│ • Permutation Entropy演化                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: 科学算法层（后台引擎，不可见）

### 1.1 Wavelet多尺度分解
- **目的**: 分离长期趋势 / 季节性(温度) / 噪声
- **算法**: Discrete Wavelet Transform (DWT), Daubechies 4小波
- **输出**:
  - Approximation (低频) = 长期结构趋势
  - Detail Level 2-3 (中频) = 日/周温度循环
  - Detail Level 1 (高频) = 测量噪声
- **参考**: MDPI Buildings 2024 — Wavelet-Based Vibration Denoising for SHM

### 1.2 Permutation Entropy (健康指数)
- **目的**: 单一数字量化裂缝行为复杂度
- **算法**: Amplitude-Aware Permutation Entropy (AAPE)
  - 嵌入维度 m=3, 时滞 τ=1
  - 健康结构 = 低熵(规律), 损伤结构 = 高熵(混乱)
- **输出**: 0-1标准化熵值，映射到健康评分
- **参考**: Sensors 2024 — AAPE for SHM; Mechanical Systems & Signal Processing 2024

### 1.3 Hurst指数(长程依赖分析)
- **目的**: 预测裂缝是稳定还是加速
- **算法**: Rescaled Range (R/S) 分析，滚动窗口30天
  - H = 0.5 → 随机游走(不可预测)
  - H > 0.5 → 持续性(加速扩展) **危险**
  - H < 0.5 → 反持续性(自限性，稳定)
- **输出**: 滚动Hurst指数时序，H跨越0.5阈值时触发警报
- **参考**: Engineering Fracture Mechanics 2025; ResearchGate 2022

### 1.4 CUSUM变点检测
- **目的**: 比阈值报警早5-15天发现行为突变
- **算法**: Page's CUSUM, k=0.5σ, h=5.0
- **输出**: 变点时间戳列表 + 方向(加速/减速)
- **参考**: JMLR 2023 FO-CuS; Sage SHM Journal 2024

### 1.5 Moran's I空间聚类
- **目的**: 检测裂缝是否在空间上聚集(共同原因)
- **算法**: Global Moran's I + LISA (Local Indicators of Spatial Association)
- **输出**:
  - I > 0.3 → 强聚类(结构性问题)
  - I ≈ 0 → 随机分布
  - 热点地图(High-High clusters)
- **参考**: Structural Control & Health Monitoring 2022; Sensors 2024 CrackLG

### 1.6 热-结构分量分离
- **目的**: 区分温度引起的可逆变化 vs 结构损伤
- **算法**:
  - 裂缝 vs 温度 Pearson相关 + 互相关(lag -7~+7天)
  - 热分量 = α·L·ΔT (α=11×10⁻⁶/°C, L=100mm)
  - 结构分量 = 实测 - 热分量
- **输出**:
  - |r| > 0.7 → 热主导(低风险)
  - |r| < 0.3 → 结构主导(高风险)
- **参考**: 混凝土结构温度效应理论

---

## Phase 2: Hero Display Layer（英雄展示，3秒理解）

### 2.1 Master Caution Indicator (顶部单一指示灯)
```tsx
<div className="h-16 flex items-center justify-center border-b border-slate-700">
  <div className="flex items-center gap-4">
    <div className={`w-4 h-4 rounded-full ${masterColor}`} />
    <span className="text-xl font-bold text-white">{masterStatus}</span>
    <span className="text-slate-300">{summary}</span>
  </div>
</div>
```
- **逻辑**:
  - 绿灯: 所有点 GB50292 ≤ b级 且 无CUSUM警报 且 Hurst < 0.6
  - 黄灯: 存在 c级 或 CUSUM警报 或 Hurst > 0.6
  - 红灯: 存在 d级 或 III期加速 或 Hurst > 0.8

### 2.2 Vital Signs Strip (5个关键数字，永不滚动)
```tsx
<div className="h-24 grid grid-cols-5 gap-4 px-4 shrink-0">
  <VitalCard label="最大裂缝" value="0.3mm" status="green" />
  <VitalCard label="加速点" value="2个" status="yellow" />
  <VitalCard label="热主导" value="85%" status="green" />
  <VitalCard label="空间聚类" value="I=0.12" status="green" />
  <VitalCard label="CUSUM预警" value="0个" status="green" />
</div>
```
- 每个卡片: 大号数字 + 背景色(绿/黄/红)
- **不需要点击，扫一眼就知道系统状态**

### 2.3 Spatial Heatmap (结构平面图 + 监测点色块)
```tsx
<div className="flex-1 min-h-0 p-4">
  <StructureMap>
    {points.map(p => (
      <MapDot
        x={p.x_coord}
        y={p.y_coord}
        color={getHealthColor(p)}
        onClick={() => openDrawer(p.id)}
      />
    ))}
  </StructureMap>
</div>
```
- **这是主界面** — 不是表格，是空间地图
- 点击任意点 → 右侧抽屉滑出，显示该点的全部诊断

---

## Phase 3: Main Charts Layer（主图层，可滚动）

### 3.1 Priority Ranking List (不是雷达图!)
```tsx
<PriorityList>
  {rankedPoints.map(p => (
    <PriorityRow
      point={p.id}
      severity={p.gb50292_grade}
      hurst={p.hurst}
      entropy={p.entropy}
      action={p.recommended_action}
      daysToDegrade={p.days_to_next_grade}
    />
  ))}
</PriorityList>
```
- **排序逻辑**: GB等级 → Hurst指数 → Entropy → CUSUM警报
- 每行显示: 监测点 | 等级徽章 | 关键指标 | **建议行动** | 预计降级时间

### 3.2 Trend with Confidence Band (灰色置信带)
```tsx
<TrendChart>
  <ConfidenceBand data={baseline} /> {/* 灰色带 */}
  <TrendLine data={actual} />         {/* 蓝线 */}
  <AlertZone where={line_pierces_band} /> {/* 红色高亮 */}
</TrendChart>
```
- **Datadog模式**: 线在带内=正常，线穿带=异常
- 置信带 = μ ± 2σ (从历史数据计算)

### 3.3 GB 50292 Grade Cards (等级徽章网格)
```tsx
<div className="grid grid-cols-4 gap-2">
  <GradeCard grade="a" count={18} color="green" />
  <GradeCard grade="b" count={3} color="yellow" />
  <GradeCard grade="c" count={2} color="orange" />
  <GradeCard grade="d" count={0} color="red" />
</div>
```

---

## Phase 4: Side Drawer (深度诊断，按需展开)

点击空间地图上的任意点后，右侧抽屉滑出，显示该点的完整诊断报告：

### 4.1 Wavelet Decomposition View
- 3个子图: Approximation / Detail (thermal) / Detail (noise)
- 显示: "长期趋势 +0.05mm/年，季节波动 ±0.02mm"

### 4.2 Thermal-Structural Separation
- 双Y轴: 裂缝宽度 + 温度
- 显示: "温度相关性 r=0.82 (热主导型)，结构分量 +0.01mm"

### 4.3 CUSUM Timeline
- 时序图 + 红色竖线标注变点
- 显示: "2024-02-15检测到加速，提前12天预警"

### 4.4 Creep Phase Identification
- 水平时间线，彩色分段
- 显示: "当前处于II期稳定期，已持续45天"

### 4.5 Settlement Causality
- Lag plot (互相关 vs 滞后天数)
- 显示: "裂缝滞后沉降3天 (r=0.65)，沉降是主因"

### 4.6 Hurst Exponent Trend
- 滚动Hurst指数时序
- 显示: "H=0.48 (稳定)，未检测到加速趋势"

### 4.7 Permutation Entropy Evolution
- 熵值时序
- 显示: "当前熵=0.23 (健康)，较基线无显著变化"

---

## Phase 5: Settings/Tools Layer（设置与工具）

### 5.1 Threshold Configuration
- 用户可调整: CUSUM的h值, Hurst阈值, 熵阈值

### 5.2 Export Reports
- 一键导出: 当前状态PDF报告 + 所有诊断图表

---

## 实施顺序（严格按Phase执行）

```
Phase 1: 科学算法层 (2-3天)
  ├─ 1.1 Wavelet分解        [独立]
  ├─ 1.2 Permutation Entropy [独立]
  ├─ 1.3 Hurst指数          [独立]
  ├─ 1.4 CUSUM              [独立]
  ├─ 1.5 Moran's I          [需坐标数据]
  └─ 1.6 热-结构分离        [需温度API]

Phase 2: Hero Display (1天)
  ├─ 2.1 Master Caution     [依赖Phase1全部]
  ├─ 2.2 Vital Signs Strip  [依赖Phase1全部]
  └─ 2.3 Spatial Heatmap    [需坐标数据]

Phase 3: Main Charts (1天)
  ├─ 3.1 Priority List      [依赖Phase1]
  ├─ 3.2 Confidence Band    [依赖Phase1]
  └─ 3.3 GB Grade Cards     [独立]

Phase 4: Side Drawer (2天)
  └─ 7个诊断视图            [依赖Phase1全部算法]

Phase 5: Settings (0.5天)
  └─ 配置界面 + 导出

总计: 6.5天
```

---

## 技术约束

- **前端算法**: Wavelet/Entropy/Hurst/CUSUM 全部用 TypeScript 实现
- **新增API**:
  - `GET /temperature/by_date_range` (温度时序)
  - `GET /settlement/by_point` (沉降时序)
  - `GET /monitoring_points/coordinates` (坐标)
- **性能**:
  - Wavelet/Entropy 用 Web Worker 后台计算
  - 空间地图用 Canvas 渲染(>100点时)
- **UI规范**: 深色主题 text-white, 固定布局(不滚动Layer 0-2)

---

## vs 上一版计划对比

| 维度 | 上一版(6图表卡片) | 本版(驾驶舱) |
|------|------------------|-------------|
| **UX模式** | 拼盘式卡片 | 分层驾驶舱 |
| **决策速度** | 需读6张图(30秒+) | 0.5秒看灯 + 2秒扫条 |
| **科学深度** | 基础统计 | Wavelet+Entropy+Hurst+Moran's I |
| **空间分析** | 无 | Moran's I聚类 + 热力图 |
| **预警能力** | CUSUM单一方法 | CUSUM+Hurst+Entropy三重预警 |
| **可操作性** | 只展示数据 | 优先级列表 + 建议行动 |
| **信息架构** | 平铺 | 分层渐进(0→1→2→3→4) |

---

## 关键创新点（论文级）

1. **Wavelet-Entropy-Hurst三位一体**: 首次在裂缝监测中组合使用
2. **热-结构分量分离**: 解决温度干扰的根本问题
3. **空间传播前沿检测**: Moran's I LISA识别裂缝扩展方向
4. **驾驶舱式UX**: 首个将飞行员HUD设计应用于SHM的系统
5. **多尺度时序分解**: Wavelet分离趋势/季节/噪声，精准提取结构信号

---

## 成功标准

- [ ] **乔布斯测试**: 非专业人员打开页面0.5秒内知道是否安全
- [ ] **工程师测试**: 3秒内找到最该关注的监测点 + 知道该做什么
- [ ] **科研测试**: 算法可发表SCI论文(Wavelet+Entropy+Hurst组合创新)
- [ ] **性能测试**: 100个监测点 × 365天数据，计算+渲染 <2秒
- [ ] **预警测试**: 比传统阈值报警早5-15天发现异常(CUSUM验证)
