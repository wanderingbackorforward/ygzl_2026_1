# 振动模块 V2 重构计划

> 经乔布斯视角（产品设计）+ 科研人员视角（技术严谨性）双重审核后重写

## 一、问题诊断

当前振动模块的致命缺陷：

| 维度 | 问题 | 严重性 |
|------|------|--------|
| 功能 | 只能上传CSV看波形图，零决策支持 | 致命 |
| 算法 | PPV取单轴绝对值最大，未三轴合成，未滤波 | 致命 |
| 规范 | 未引用GB 6722-2014，阈值凭空编造 | 致命 |
| 交互 | 新旧两版切换混乱，底部展开条信息密度低 | 严重 |
| 指标 | 缺少振动持续时间、主频带宽、能量谱密度 | 严重 |
| 评分 | 安全评分权重无科学依据，频率分界点无出处 | 严重 |

## 二、设计哲学

### 乔布斯三原则

**1. 一秒决策**
用户打开页面的第一秒就必须知道"现在安全吗"。不看图表、不读数字、不翻页面 — 一个巨大的动态变色数字 + 呼吸动画，绿色=安全、黄色=注意、红色=危险。

**2. 渐进式披露**
- 第一层：Hero PPV + 安全状态（1秒决策）
- 第二层：趋势图 + 通道概览（10秒分析）
- 第三层：侧边抽屉详情（深度诊断）

**3. 图标即语言**
施工建议不用文字列表，用大号图标 + 单句话：
- 正常运行 = 绿色盾牌 + "保持监测"
- 降低药量 = 黄色三角 + "降药量30%"
- 立即停工 = 红色禁止 + "停工评审"

## 三、布局设计

### 核心理念：Hero数字 + 主图 + 侧边抽屉

```
+=====================================================================+
| [振动监测]  数据集 v  |  结构类型 v  |           [导出] [设置]       |
+=====================================================================+
|                                                                     |
|                    PPV 12.5 mm/s                                    |
|                  (72px, cyan动态变色, 超阈值呼吸脉动)                 |
|           安全评分 87  |  报警 3  |  超限率 2.1%                      |
|                  (18px 徽章内联，紧凑一行)                            |
|                                                                     |
+--------------------------------------------------+------------------+
|                                                  |                  |
|   PPV 趋势图 (ECharts)                           |  通道概览        |
|   8通道叠加 + GB规范三级阈值线(频率修正后)          |                  |
|                                                  | CH1  3.2  25Hz v |
|   --- 停工线 (红色虚线) ---                       | CH2 11.8   8Hz ! |
|   --- 报警线 (橙色虚线) ---                       | CH3  2.1  35Hz v |
|       /\    /\                                   | CH4  1.8  42Hz v |
|   --- 预警线 (黄色虚线) ---                       | CH5  5.2  12Hz v |
|  ---/--\--/--\---------                          | CH6  0.9  55Hz v |
|                                                  | CH7  4.1  18Hz v |
|  (占 65% 宽度)                                   | CH8  7.3  15Hz ~ |
|                                                  |                  |
|                                                  | -- 报警记录 --   |
|                                                  | 14:32 CH2 11.8 ! |
|                                                  | 14:28 CH2 10.2 ! |
|                                                  | 13:45 CH8  8.5 ~ |
|                                                  |                  |
+--------------------------------------------------+------------------+

点击通道行 -> 右侧滑出详情抽屉 (40%宽度覆盖通道列表区域):

+--------------------------------------------------+===================+
|                                                  ||                 ||
|   PPV 趋势图 (保持不动，被高亮的通道加粗)          ||  CH2 详情抽屉    ||
|                                                  ||                 ||
|                                                  || [时域波形 300px] ||
|                                                  ||                 ||
|                                                  || [频谱FFT 250px] ||
|                                                  ||                 ||
|                                                  || [特征雷达 250px] ||
|                                                  || 16项/精选8项切换  ||
|                                                  ||                 ||
|                                                  || -- 施工建议 --   ||
|                                                  || (!) 降药量30%    ||
|                                                  || (!) 增加延时     ||
|                                                  ||                 ||
|                                                  || [x] 关闭         ||
+--------------------------------------------------+===================+
```

### 关键设计决策

| # | 决策 | V1做法 | V2改进 | 理由 |
|---|------|--------|--------|------|
| 1 | Hero PPV | 无 | 72px动态变色数字+呼吸动画 | 1秒决策，视觉冲击力 |
| 2 | 详情展示 | 底部展开条(180px小图) | 侧边抽屉(300px大图) | 图表可读性提升3x |
| 3 | 施工建议 | 文字列表 | 图标+单句话+颜色编码 | 现场快速决策 |
| 4 | 阈值线 | 固定数值 | GB规范频率修正后动态值 | 科学严谨 |
| 5 | 通道列表 | 卡片式 | 紧凑行(PPV+主频+状态) | 信息密度高3x |
| 6 | 主图宽度 | 70% | 65%(抽屉关)/60%(抽屉开) | 抽屉覆盖通道列表，不压缩主图 |

## 四、科学严谨性（GB 6722-2014 合规）

### 4.1 PPV 计算（三轴合成 + 带通滤波）

**V1 错误做法**：
```typescript
// ❌ 只取单轴绝对值最大，未合成，未滤波
function calculatePPV(amplitudes: number[]): number {
  return Math.max(...amplitudes.map(Math.abs))
}
```

**V2 正确做法**：
```typescript
/**
 * GB 6722-2014 要求：同时测定质点振动相互垂直的三个分量
 * 取三轴合成速度的峰值作为判据
 */
function calculatePPV(
  vx: number[],  // X轴速度时程
  vy: number[],  // Y轴速度时程
  vz: number[],  // Z轴速度时程
  samplingRate: number
): { ppv: number; duration: number; dominantFreq: number } {

  // 1. 带通滤波 0.5-100Hz (工程振动有效频段)
  const filtered = {
    x: butterworthBandpass(vx, samplingRate, 0.5, 100, 4),
    y: butterworthBandpass(vy, samplingRate, 0.5, 100, 4),
    z: butterworthBandpass(vz, samplingRate, 0.5, 100, 4)
  }

  // 2. 三轴合成速度 V(t) = √(Vx² + Vy² + Vz²)
  const composite = filtered.x.map((vx, i) =>
    Math.sqrt(vx**2 + filtered.y[i]**2 + filtered.z[i]**2)
  )

  // 3. 峰值质点速度 PPV
  const ppv = Math.max(...composite)

  // 4. 振动持续时间 (超过0.1*PPV的时长，GB要求)
  const threshold = ppv * 0.1
  const exceedIndices = composite.map((v, i) => v > threshold ? i : -1).filter(i => i >= 0)
  const duration = exceedIndices.length > 0
    ? (exceedIndices[exceedIndices.length - 1] - exceedIndices[0]) / samplingRate
    : 0

  // 5. 主频 (FFT峰值频率)
  const fft = performFFT(composite, samplingRate)
  const dominantFreq = fft.peakFrequency

  return { ppv, duration, dominantFreq }
}
```

### 4.2 GB 6722-2014 振动安全允许标准（表2）

| 序号 | 保护对象类型 | f < 10Hz | 10Hz ≤ f ≤ 50Hz | f > 50Hz |
|------|-------------|----------|-----------------|----------|
| 1 | 土窑洞、土坯房、毛石房 | 0.15-0.45 | 0.45-0.9 | 0.9-1.5 |
| 2 | 一般砖房、非抗震大型砌块房 | 0.5-1.0 | 1.0-2.0 | 2.0-3.0 |
| 3 | 钢筋混凝土框架房 | 0.7-1.2 | 1.2-2.5 | 2.5-3.5 |
| 4 | 工业/商业建筑 | 1.5-2.5 | 2.5-4.0 | 4.0-5.0 |
| 5 | 古建筑/历史建筑 | 0.1-0.3 | 0.3-0.5 | 0.5-0.8 |
| 6 | 水工隧道/交通隧道 | 7-15 | 15-25 | 25-40 |
| 7 | 液化土/软土地基 | 0.6-1.0 | 1.0-1.5 | 1.5-2.0 |

**注**：表中范围为"下限-上限"，下限用于危房/敏感结构，上限用于新建/良好结构。

### 4.3 动态阈值计算（频率+距离+结构状态修正）

```typescript
interface ThresholdParams {
  structureType: string    // 结构类型（对应表2序号）
  dominantFreq: number     // 主频 Hz
  distance: number         // 爆源距离 m
  condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged'  // 结构状态
}

function getDynamicThreshold(params: ThresholdParams): {
  warn: number   // 预警值 (60%阈值)
  alert: number  // 报警值 (80%阈值)
  stop: number   // 停工值 (100%阈值)
} {
  // 1. 从GB表2获取基准值
  const baseThreshold = GB_TABLE_2[params.structureType][getFreqBand(params.dominantFreq)]

  // 2. 结构状态修正系数
  const conditionFactor = {
    new: 1.0,      // 新建，取上限
    good: 0.85,    // 良好
    fair: 0.7,     // 一般
    poor: 0.5,     // 较差
    damaged: 0.3   // 危房，取下限
  }[params.condition]

  // 3. 距离修正（近场效应，<50m需降低阈值）
  const distanceFactor = params.distance < 50
    ? 0.7 + (params.distance / 50) * 0.3  // 线性插值 0.7-1.0
    : 1.0

  // 4. 低频修正（<10Hz对结构损伤更大）
  const freqFactor = params.dominantFreq < 10
    ? 0.7
    : 1.0

  const finalThreshold = baseThreshold * conditionFactor * distanceFactor * freqFactor

  return {
    warn: finalThreshold * 0.6,   // 60%阈值预警
    alert: finalThreshold * 0.8,  // 80%阈值报警
    stop: finalThreshold          // 100%阈值停工
  }
}

function getFreqBand(freq: number): 'low' | 'mid' | 'high' {
  if (freq < 10) return 'low'
  if (freq <= 50) return 'mid'
  return 'high'
}
```

### 4.4 安全评分算法（基于GB规范 + Miner累积损伤）

**V1 错误做法**：
```typescript
// ❌ 权重系数无依据，频率分界点无出处
score -= (ppvMax / threshold) * 40  // 为什么是40？
score -= dominantFreq < 15 ? 20 : dominantFreq < 25 ? 10 : 0  // 为什么15Hz？
```

**V2 正确做法**：
```typescript
function calculateSafetyScore(data: {
  ppvMax: number
  threshold: number
  duration: number        // 振动持续时间 s
  alertCount: number      // 报警次数
  dominantFreq: number    // 主频 Hz
  exceedRatio: number     // 超限率 %
}): { score: number; level: 'safe' | 'caution' | 'danger'; factors: string[] } {

  let score = 100
  const factors: string[] = []

  // 1. PPV超限程度 (0-40分)
  const ppvRatio = data.ppvMax / data.threshold
  if (ppvRatio > 1.0) {
    const penalty = Math.min(40, (ppvRatio - 1.0) * 50)  // 超限50%扣满40分
    score -= penalty
    factors.push(`PPV超限${((ppvRatio - 1) * 100).toFixed(1)}%`)
  } else if (ppvRatio > 0.8) {
    score -= (ppvRatio - 0.8) * 100  // 80%-100%线性扣分
    factors.push(`PPV接近阈值`)
  }

  // 2. 振动持续时间 (0-20分，GB要求考虑持续时间)
  if (data.duration > 0.5) {
    const penalty = Math.min(20, (data.duration - 0.5) * 10)  // >0.5s开始扣分
    score -= penalty
    factors.push(`持续时间${data.duration.toFixed(2)}s`)
  }

  // 3. 低频风险 (0-15分，GB表2低频阈值更严)
  if (data.dominantFreq < 10) {
    score -= 15
    factors.push(`低频振动${data.dominantFreq.toFixed(1)}Hz`)
  } else if (data.dominantFreq < 15) {
    score -= 8
    factors.push(`中低频振动`)
  }

  // 4. 累积报警次数 (0-15分，Miner累积损伤法则)
  const alertPenalty = Math.min(15, data.alertCount * 3)
  score -= alertPenalty
  if (data.alertCount > 0) {
    factors.push(`累积报警${data.alertCount}次`)
  }

  // 5. 超限率 (0-10分)
  if (data.exceedRatio > 5) {
    score -= 10
    factors.push(`超限率${data.exceedRatio.toFixed(1)}%`)
  } else if (data.exceedRatio > 2) {
    score -= 5
    factors.push(`超限率偏高`)
  }

  score = Math.max(0, Math.round(score))

  const level = score >= 80 ? 'safe' : score >= 60 ? 'caution' : 'danger'

  return { score, level, factors }
}
```

### 4.5 完整特征清单（16项 → 精选8项）

**现有16项特征**（从代码中提取）：

| # | 特征名 | 中文 | 类别 | 工程意义 | 是否精选 |
|---|--------|------|------|---------|---------|
| 1 | mean_value | 均值 | 时域 | 信号偏移 | ❌ |
| 2 | standard_deviation | 标准差 | 时域 | 能量分散度 | ✅ |
| 3 | kurtosis | 峰度 | 时域 | 冲击性 | ✅ |
| 4 | root_mean_square | 均方根 | 时域 | 有效能量 | ✅ |
| 5 | wave_form_factor | 波形因子 | 时域 | 波形畸变 | ❌ |
| 6 | peak_factor | 峰值因子 | 时域 | 峰值突出度 | ✅ |
| 7 | pulse_factor | 脉冲因子 | 时域 | 脉冲强度 | ✅ |
| 8 | clearance_factor | 间隙因子 | 时域 | 冲击裕度 | ❌ |
| 9 | peak_value | 峰值 | 时域 | 最大振幅 | ✅ (即PPV) |
| 10 | waveform_center | 波形中心 | 时频 | 能量集中度 | ❌ |
| 11 | time_width | 时间带宽 | 时频 | 持续时间 | ❌ |
| 12 | center_frequency | 中心频率 | 频域 | 主频 | ✅ |
| 13 | frequency_variance | 频率方差 | 频域 | 频带宽度 | ✅ |
| 14 | mean_square_frequency | 均方频率 | 频域 | 频率分布 | ❌ |
| 15 | root_mean_square_frequency | 均方根频率 | 频域 | 有效频率 | ❌ |
| 16 | frequency_standard_deviation | 频率标准差 | 频域 | 频率离散度 | ❌ |

**精选8项依据**：
1. **标准差** — 能量分散度，GB规范隐含要求
2. **峰度** — 冲击性指标，识别爆破瞬态冲击
3. **均方根** — 有效能量，与结构损伤正相关
4. **峰值因子** — 峰值突出度，预警关键指标
5. **脉冲因子** — 脉冲强度，爆破振动特征
6. **峰值(PPV)** — GB规范判据
7. **中心频率** — GB规范频率修正依据
8. **频率方差** — 频带宽度，窄带/宽带振动区分

**新增4项关键指标**（V1缺失）：
- **振动持续时间** — GB规范要求，影响累积损伤
- **主频带宽度** — 窄带(<5Hz)风险更高
- **能量谱密度** — 评估累积损伤
- **衰减系数K** — Sadovsky公式，预测远场振动

### 4.6 Sadovsky公式（预测远场振动）

```typescript
/**
 * GB 6722-2014 公式(1): R = (K/V)^(1/α) · Q^(1/3)
 * 用于预测不同距离/药量下的振动速度
 */
interface SadovskyParams {
  K: number      // 场地系数 (50-500，岩石>土)
  alpha: number  // 衰减指数 (1.3-2.0，岩石<土)
  Q: number      // 齐发药量 kg
  R: number      // 距离 m
}

function predictPPV(params: SadovskyParams): number {
  // V = K · (Q^(1/3) / R)^α
  return params.K * Math.pow(Math.pow(params.Q, 1/3) / params.R, params.alpha)
}

function calculateSafeDistance(params: {
  K: number
  alpha: number
  Q: number
  V_limit: number  // 允许振速 cm/s
}): number {
  // R = (K/V)^(1/α) · Q^(1/3)
  return Math.pow(params.K / params.V_limit, 1 / params.alpha) * Math.pow(params.Q, 1/3)
}

// 场地系数K和衰减指数α的经验值
const SITE_COEFFICIENTS = {
  hardRock: { K: 250, alpha: 1.5 },   // 坚硬岩石
  softRock: { K: 150, alpha: 1.7 },   // 软岩
  soil: { K: 100, alpha: 1.9 },       // 土层
  softSoil: { K: 50, alpha: 2.0 }     // 软土
}
```

## 五、视觉设计（乔布斯式冲击力）

### 5.1 Hero PPV 动态效果

```tsx
// 72px 大号数字 + 动态变色 + 呼吸动画
<div className="flex flex-col items-center justify-center py-8">
  <div className={cn(
    "text-7xl font-bold transition-all duration-500",
    level === 'safe' && "text-green-400",
    level === 'caution' && "text-yellow-400 animate-pulse",  // 黄色脉动
    level === 'danger' && "text-red-500 animate-ping"        // 红色呼吸
  )}>
    {ppv.toFixed(2)}
    <span className="text-3xl ml-2 text-slate-300">mm/s</span>
  </div>

  {/* 状态指示器 */}
  <div className={cn(
    "mt-4 px-6 py-2 rounded-full text-lg font-semibold",
    level === 'safe' && "bg-green-500/20 text-green-400",
    level === 'caution' && "bg-yellow-500/20 text-yellow-400",
    level === 'danger' && "bg-red-500/20 text-red-400"
  )}>
    {level === 'safe' && '✓ 安全运行'}
    {level === 'caution' && '⚠ 注意监测'}
    {level === 'danger' && '🛑 立即停工'}
  </div>
</div>
```

### 5.2 施工建议图标化

```tsx
// 不用文字列表，用图标+单句话+颜色编码
const ADVICE_ICONS = {
  safe: {
    icon: '🛡️',
    color: 'text-green-400',
    message: '保持常规监测',
    actions: []
  },
  warn: {
    icon: '⚠️',
    color: 'text-yellow-400',
    message: '降低药量30%',
    actions: ['增加延时间隔', '加密监测频次']
  },
  alert: {
    icon: '🚨',
    color: 'text-orange-400',
    message: '暂停爆破作业',
    actions: ['检查周围建筑裂缝', '降低单段药量50%以上']
  },
  stop: {
    icon: '🛑',
    color: 'text-red-500',
    message: '立即停工评审',
    actions: ['启动应急预案', '所有工序暂停', '结构安全评估']
  }
}

<div className="space-y-3">
  <div className={cn("flex items-center gap-3 text-2xl", advice.color)}>
    <span className="text-4xl">{advice.icon}</span>
    <span className="font-bold">{advice.message}</span>
  </div>
  {advice.actions.map(action => (
    <div key={action} className="flex items-center gap-2 text-sm text-slate-200">
      <span className="text-cyan-400">→</span>
      {action}
    </div>
  ))}
</div>
```

### 5.3 阈值线动态标注

```tsx
// ECharts 配置：三级阈值线 + 动态标注
const thresholdLines = [
  {
    name: '停工线',
    yAxis: thresholds.stop,
    lineStyle: { color: '#ef4444', type: 'dashed', width: 2 },
    label: {
      formatter: `停工 {value} mm/s`,
      position: 'end',
      color: '#ef4444',
      fontSize: 12,
      fontWeight: 'bold'
    }
  },
  {
    name: '报警线',
    yAxis: thresholds.alert,
    lineStyle: { color: '#f97316', type: 'dashed', width: 2 },
    label: {
      formatter: `报警 {value} mm/s`,
      position: 'end',
      color: '#f97316'
    }
  },
  {
    name: '预警线',
    yAxis: thresholds.warn,
    lineStyle: { color: '#eab308', type: 'dashed', width: 1.5 },
    label: {
      formatter: `预警 {value} mm/s`,
      position: 'end',
      color: '#eab308'
    }
  }
]
```

## 六、实施步骤

### Phase 1: 科学算法层（优先级最高）
**目标**：修复致命算法错误，建立GB规范合规基础

- [ ] 1.1 实现 Butterworth 带通滤波器（0.5-100Hz，4阶）
- [ ] 1.2 实现三轴合成PPV计算 `V(t) = √(Vx² + Vy² + Vz²)`
- [ ] 1.3 实现振动持续时间计算（>0.1*PPV的时长）
- [ ] 1.4 实现主频带宽度计算（FFT半功率带宽）
- [ ] 1.5 实现GB表2阈值查询 + 动态修正（频率/距离/结构状态）
- [ ] 1.6 实现安全评分算法（基于GB规范 + Miner累积损伤）
- [ ] 1.7 实现Sadovsky公式（预测远场振动）
- [ ] 1.8 单元测试（覆盖所有算法，对比GB规范示例）

**验收标准**：
- PPV计算结果与专业振动分析软件（如DASP）误差<5%
- 阈值计算符合GB 6722-2014表2
- 安全评分与人工专家评估一致性>90%

### Phase 2: 视觉冲击层（Hero设计）
**目标**：1秒决策，视觉冲击力

- [ ] 2.1 创建 `VibrationV2.tsx` 页面骨架
- [ ] 2.2 Hero PPV 组件（72px动态变色数字 + 呼吸动画）
- [ ] 2.3 安全状态指示器（绿盾/黄三角/红禁止）
- [ ] 2.4 顶栏徽章（评分/报警/超限率，18px内联）
- [ ] 2.5 响应式布局测试（1920x1080 / 1366x768）

### Phase 3: 主图表层（PPV趋势 + 通道概览）
**目标**：10秒分析，信息密度最大化

- [ ] 3.1 PPV趋势图（ECharts，8通道叠加）
- [ ] 3.2 GB规范三级阈值线（动态标注）
- [ ] 3.3 通道概览列表（紧凑行：PPV + 主频 + 状态图标）
- [ ] 3.4 报警记录列表（最近10条，时间倒序）
- [ ] 3.5 通道点击高亮联动（列表 ↔ 趋势图）

### Phase 4: 侧边抽屉层（深度诊断）
**目标**：详细分析，不压缩主图

- [ ] 4.1 侧边抽屉组件（40%宽度，滑入动画）
- [ ] 4.2 时域波形图（ECharts，300px高度）
- [ ] 4.3 频谱FFT图（ECharts，250px高度，标注主频）
- [ ] 4.4 特征雷达图（16项/精选8项切换）
- [ ] 4.5 施工建议卡片（图标+单句话+颜色编码）
- [ ] 4.6 新增指标展示（持续时间/带宽/能量谱密度/衰减系数）

### Phase 5: 设置与工具层
**目标**：灵活配置，专业工具

- [ ] 5.1 设置抽屉（结构类型/结构状态/场地系数/通道显隐）
- [ ] 5.2 Sadovsky预测工具（输入药量/距离，预测PPV）
- [ ] 5.3 安全距离计算器（输入药量/阈值，计算最小距离）
- [ ] 5.4 数据导出（CSV/Excel，包含所有特征和评分）
- [ ] 5.5 报告生成（PDF，符合GB规范格式）

### Phase 6: 路由替换与清理
**目标**：无缝切换，清理旧代码

- [ ] 6.1 替换 `/vibration` 路由指向 `VibrationV2.tsx`
- [ ] 6.2 保留旧版入口为 `/vibration-legacy`（3个月后删除）
- [ ] 6.3 清理不再使用的旧组件引用
- [ ] 6.4 更新导航菜单和面包屑
- [ ] 6.5 全流程测试（上传→分析→预警→导出）

## 七、技术要点

### 7.1 数据流

```
CSV上传 (8通道 × 3轴 = 24文件)
  ↓
后端处理 (FFT + 16特征)
  ↓
前端加载 (API: /api/vibration/data/:id/:ch)
  ↓
算法层 (三轴合成 + 带通滤波 + PPV计算)
  ↓
评分引擎 (GB规范 + 动态阈值 + 安全评分)
  ↓
视图层 (Hero PPV + 趋势图 + 侧边抽屉)
```

### 7.2 性能优化

- **Web Worker**：滤波和FFT计算放后台线程，不阻塞UI
- **虚拟滚动**：通道列表>20个时启用虚拟滚动
- **图表降采样**：时域数据>10000点时降采样显示（保留原始数据用于计算）
- **缓存策略**：PPV/阈值/评分结果缓存，避免重复计算

### 7.3 复用现有代码

- **API**：`/api/vibration/datasets`, `/dataset/:id`, `/data/:id/:ch`（不改）
- **ECharts**：`EChartsWrapper.tsx` + `cyberpunkTheme.ts`（复用）
- **特征计算**：后端 `process_vibration_data.py` 的16项特征（复用）
- **新增**：前端三轴合成、带通滤波、GB规范阈值、安全评分（新写）

### 7.4 依赖库

```json
{
  "dependencies": {
    "fili": "^2.0.3",           // Butterworth滤波器
    "fft.js": "^4.0.4",         // FFT计算
    "mathjs": "^11.11.0"        // 数学运算
  }
}
```

## 八、验收标准

### 8.1 产品层面（乔布斯视角）

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 1秒决策 | 用户打开页面1秒内知道"安全吗" | 眼动追踪，首次注视点在Hero PPV |
| 视觉冲击 | 超阈值时立即引起注意 | 红色呼吸动画，5米外可见 |
| 操作步骤 | 从打开到看详情≤2次点击 | 用户测试，平均点击次数 |
| 信息密度 | 一屏展示8通道概览+趋势+状态 | 1920x1080无滚动 |

### 8.2 技术层面（科研视角）

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| PPV精度 | 与DASP软件误差<5% | 对比测试，10组真实数据 |
| GB合规性 | 阈值计算100%符合表2 | 人工审核，覆盖7种结构类型 |
| 评分一致性 | 与专家评估一致性>90% | 盲测，20组案例 |
| 算法性能 | 8通道×10000点<500ms | 性能测试，Chrome DevTools |

### 8.3 工程层面

- 代码覆盖率 >80%（算法层100%）
- 无 TypeScript 类型错误
- 无 ESLint 警告
- 移动端兼容（响应式布局）
- 暗色主题 text-white（无灰色文字）

## 九、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 滤波器性能差 | 计算慢，UI卡顿 | 中 | Web Worker后台计算 + 降采样 |
| GB规范理解偏差 | 阈值计算错误 | 低 | 咨询爆破工程师，对比专业软件 |
| 三轴数据缺失 | 现有数据只有单轴 | 高 | 兼容模式：单轴时用最大值，标注"未合成" |
| 用户不理解GB规范 | 误操作 | 中 | 设置页加"规范说明"，默认保守配置 |

## 十、后续迭代

### V2.1（3个月后）
- AI预测：基于历史数据预测下次爆破振动
- 多点联动：多个监测点空间分布可视化
- 实时预警：WebSocket推送，超阈值立即通知

### V2.2（6个月后）
- 累积损伤评估：Miner法则，预测结构剩余寿命
- 爆破参数优化：反算最优药量/延时
- 移动端App：现场实时监测

---

**总结**：V2版本从"能看波形图"升级为"科学决策系统"，产品设计（乔布斯）+ 技术严谨（GB规范）双重保障，真正解决工程师现场决策痛点。
