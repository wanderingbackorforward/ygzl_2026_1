// Mock 数据生成工具
// 用于 Vercel 部署时无法安装 ML 库的降级方案

/**
 * 生成符合物理规律的沉降数据
 * 特点：
 * - 累积性：沉降随时间累积
 * - 季节性：温度影响导致的周期波动
 * - 随机性：施工扰动
 * - 异常点：模拟真实异常情况
 */
export function generateRealisticSettlement(
  pointId: string,
  days: number = 90
): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  const today = new Date();

  // 根据点位ID生成不同的基础沉降速率
  const pointIndex = parseInt(pointId.replace(/\D/g, '')) || 1;
  const baseRate = -0.15 - (pointIndex % 5) * 0.05; // -0.15 到 -0.35 mm/天

  let cumulative = 0;

  for (let i = -days; i <= 0; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    // 季节性波动（温度影响）
    const seasonalEffect = Math.sin((i / 365) * 2 * Math.PI) * 0.5;

    // 随机扰动（施工影响）
    const randomNoise = (Math.random() - 0.5) * 0.3;

    // 偶尔的异常沉降（5%概率）
    const anomaly = Math.random() < 0.05 ? (Math.random() - 0.5) * 2 : 0;

    const dailyChange = baseRate + seasonalEffect + randomNoise + anomaly;
    cumulative += dailyChange;

    data.push({
      date: date.toISOString().split('T')[0],
      value: parseFloat(cumulative.toFixed(2)),
    });
  }

  return data;
}

/**
 * 生成批量异常检测结果
 */
export function generateMockAnomalies(pointIds: string[]) {
  const results: any[] = [];

  pointIds.forEach((pointId, index) => {
    const anomalies: any[] = [];
    const totalPoints = 100;

    // 每7个点有1个严重异常
    if (index % 7 === 0) {
      anomalies.push({
        point_id: pointId,
        date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        anomaly_type: 'spike',
        severity: 'critical',
        settlement: -35 - Math.random() * 10,
        anomaly_score: 0.85 + Math.random() * 0.15,
      });
    }

    // 每4个点有1个高风险
    if (index % 4 === 0) {
      anomalies.push({
        point_id: pointId,
        date: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        anomaly_type: 'acceleration',
        severity: 'high',
        settlement: -25 - Math.random() * 5,
        anomaly_score: 0.70 + Math.random() * 0.15,
      });
    }

    // 每3个点有1个中等风险
    if (index % 3 === 0) {
      anomalies.push({
        point_id: pointId,
        date: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        anomaly_type: 'trend',
        severity: 'medium',
        settlement: -18 - Math.random() * 5,
        anomaly_score: 0.50 + Math.random() * 0.20,
      });
    }

    results.push({
      success: true,
      point_id: pointId,
      method: 'isolation_forest',
      total_points: totalPoints,
      anomaly_count: anomalies.length,
      anomaly_rate: anomalies.length / totalPoints,
      anomalies,
    });
  });

  const summary = {
    total_points: pointIds.length,
    total_anomalies: results.reduce((sum, r) => sum + r.anomaly_count, 0),
    critical_count: results.reduce((sum, r) => sum + r.anomalies.filter((a: any) => a.severity === 'critical').length, 0),
    high_count: results.reduce((sum, r) => sum + r.anomalies.filter((a: any) => a.severity === 'high').length, 0),
    medium_count: results.reduce((sum, r) => sum + r.anomalies.filter((a: any) => a.severity === 'medium').length, 0),
    low_count: results.reduce((sum, r) => sum + r.anomalies.filter((a: any) => a.severity === 'low').length, 0),
  };

  return {
    success: true,
    results,
    summary,
  };
}

/**
 * 生成处置建议
 */
export function generateMockRecommendations(anomalies: any[]) {
  const recommendations: any[] = [];

  anomalies.forEach(anomaly => {
    if (anomaly.severity === 'critical') {
      recommendations.push({
        id: `rec-${anomaly.point_id}-1`,
        priority: 'urgent',
        action: 'inspect',
        title: '立即现场巡检',
        reason: `${anomaly.point_id} 点位累积沉降已超过安全阈值，需立即安排现场巡检，评估结构安全性。`,
        related_anomalies: [anomaly.point_id],
        estimated_time: '2小时内',
        point_ids: [anomaly.point_id],
      });
      recommendations.push({
        id: `rec-${anomaly.point_id}-2`,
        priority: 'urgent',
        action: 'report',
        title: '上报技术负责人',
        reason: '准备详细的沉降分析报告，包括历史数据、趋势分析和风险评估。',
        related_anomalies: [anomaly.point_id],
        estimated_time: '4小时内',
        point_ids: [anomaly.point_id],
      });
    } else if (anomaly.severity === 'high') {
      recommendations.push({
        id: `rec-${anomaly.point_id}-1`,
        priority: 'high',
        action: 'monitor',
        title: '加密监测频率',
        reason: `${anomaly.point_id} 点位沉降速率异常，建议将监测频率提高至每日2次。`,
        related_anomalies: [anomaly.point_id],
        estimated_time: '24小时内',
        point_ids: [anomaly.point_id],
      });
    } else if (anomaly.severity === 'medium') {
      recommendations.push({
        id: `rec-${anomaly.point_id}-1`,
        priority: 'medium',
        action: 'monitor',
        title: '持续关注',
        reason: `${anomaly.point_id} 点位沉降趋势需持续关注，保持现有监测频率。`,
        related_anomalies: [anomaly.point_id],
        estimated_time: '本周内',
        point_ids: [anomaly.point_id],
      });
    }
  });

  return recommendations;
}

/**
 * 生成预测数据
 */
export function generateMockPrediction(
  pointId: string,
  forecastDays: number = 30
) {
  const historical = generateRealisticSettlement(pointId, 60);
  const lastValue = historical[historical.length - 1].value;
  const lastDate = new Date(historical[historical.length - 1].date);

  // 计算历史趋势
  const recentData = historical.slice(-30);
  const trend = (recentData[recentData.length - 1].value - recentData[0].value) / 30;

  const forecastDates: string[] = [];
  const forecastValues: number[] = [];
  const lowerBounds: number[] = [];
  const upperBounds: number[] = [];

  let currentValue = lastValue;

  for (let i = 1; i <= forecastDays; i++) {
    const date = new Date(lastDate);
    date.setDate(date.getDate() + i);

    // 趋势延续 + 小幅波动
    const dailyChange = trend + (Math.random() - 0.5) * 0.2;
    currentValue += dailyChange;

    // 置信区间（±15%）
    const confidence = Math.abs(currentValue) * 0.15;

    forecastDates.push(date.toISOString().split('T')[0]);
    forecastValues.push(parseFloat(currentValue.toFixed(2)));
    lowerBounds.push(parseFloat((currentValue - confidence).toFixed(2)));
    upperBounds.push(parseFloat((currentValue + confidence).toFixed(2)));
  }

  return {
    success: true,
    point_id: pointId,
    selected_model: 'arima',
    model_selection_info: {
      best_score: 0.92,
      metric: 'mape',
      data_characteristics: {
        data_size: 90,
        trend_strength: 0.75,
        volatility: 0.35,
        seasonality_strength: 0.15,
      },
    },
    historical: historical.map(h => ({ date: h.date, value: h.value })),
    forecast: {
      dates: forecastDates,
      values: forecastValues,
      lower_bound: lowerBounds,
      upper_bound: upperBounds,
    },
  };
}

/**
 * 生成模型对比数据
 */
export function generateMockModelComparison(pointId: string) {
  return {
    success: true,
    point_id: pointId,
    best_model: 'arima',
    models: [
      {
        name: 'arima',
        mae: 0.45,
        rmse: 0.62,
        mape: 3.2,
        training_time: 2.3,
        is_best: true,
      },
      {
        name: 'sarima',
        mae: 0.52,
        rmse: 0.71,
        mape: 3.8,
        training_time: 4.1,
        is_best: false,
      },
      {
        name: 'prophet',
        mae: 0.58,
        rmse: 0.79,
        mape: 4.2,
        training_time: 3.5,
        is_best: false,
      },
    ],
  };
}

/**
 * 生成空间关联数据
 */
export function generateMockSpatialCorrelation(distanceThreshold: number = 50) {
  const points = Array.from({ length: 10 }, (_, i) => ({
    point_id: `S${i + 1}`,
    x: Math.random() * 200,
    y: Math.random() * 100,
  }));

  // 生成相关系数矩阵
  const n = points.length;
  const correlationMatrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1.0); // 自相关
      } else {
        // 距离越近，相关性越高
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const correlation = Math.max(-0.3, 1 - distance / distanceThreshold);
        row.push(parseFloat(correlation.toFixed(3)));
      }
    }
    correlationMatrix.push(row);
  }

  // 生成邻接矩阵
  const adjacencyMatrix = correlationMatrix.map(row =>
    row.map(val => (val > 0.5 ? 1 : 0))
  );

  // 简单聚类（基于相关性）
  const clusters: number[][] = [
    [0, 1, 2], // 聚类1
    [3, 4, 5], // 聚类2
    [6, 7],    // 聚类3
    [8, 9],    // 聚类4
  ];

  return {
    success: true,
    points,
    correlation_matrix: correlationMatrix,
    adjacency_matrix: adjacencyMatrix,
    clusters,
    cluster_count: clusters.length,
  };
}

/**
 * 生成因果分析数据
 */
export function generateMockCausalAnalysis(
  pointId: string,
  eventDate: string,
  method: 'DID' | 'SCM',
  windowDays: number = 30
) {
  const eventDateObj = new Date(eventDate);

  // 生成事件前后数据
  const beforeDates: string[] = [];
  const beforeTreated: number[] = [];
  const beforeControl: number[] = [];

  for (let i = -windowDays; i < 0; i++) {
    const date = new Date(eventDateObj);
    date.setDate(date.getDate() + i);
    beforeDates.push(date.toISOString().split('T')[0]);

    // 事件前两组趋势相似
    const baseValue = i * -0.2;
    beforeTreated.push(parseFloat((baseValue + Math.random() * 0.5).toFixed(2)));
    beforeControl.push(parseFloat((baseValue + Math.random() * 0.5).toFixed(2)));
  }

  const afterDates: string[] = [];
  const afterTreated: number[] = [];
  const afterControl: number[] = [];
  const counterfactual: number[] = [];

  for (let i = 0; i <= windowDays; i++) {
    const date = new Date(eventDateObj);
    date.setDate(date.getDate() + i);
    afterDates.push(date.toISOString().split('T')[0]);

    // 事件后处理组沉降加速
    const treatedValue = i * -0.4 + Math.random() * 0.5;
    const controlValue = i * -0.2 + Math.random() * 0.5;

    afterTreated.push(parseFloat(treatedValue.toFixed(2)));
    afterControl.push(parseFloat(controlValue.toFixed(2)));

    // 反事实：如果没有事件，处理组应该的值
    if (method === 'SCM') {
      counterfactual.push(parseFloat((i * -0.2 + Math.random() * 0.5).toFixed(2)));
    }
  }

  const treatedChange = afterTreated[afterTreated.length - 1] - beforeTreated[beforeTreated.length - 1];
  const controlChange = afterControl[afterControl.length - 1] - beforeControl[beforeControl.length - 1];
  const treatmentEffect = treatedChange - controlChange;

  return {
    method,
    treatment_effect: parseFloat(treatmentEffect.toFixed(2)),
    treated_change: parseFloat(treatedChange.toFixed(2)),
    control_change: parseFloat(controlChange.toFixed(2)),
    confidence_interval: [
      parseFloat((treatmentEffect - 1.5).toFixed(2)),
      parseFloat((treatmentEffect + 1.5).toFixed(2)),
    ] as [number, number],
    interpretation: treatmentEffect < -2
      ? '事件对沉降有显著负面影响'
      : treatmentEffect < -1
      ? '事件对沉降有一定影响'
      : '事件影响不显著',
    before_period: {
      dates: beforeDates,
      treated_values: beforeTreated,
      control_values: beforeControl,
    },
    after_period: {
      dates: afterDates,
      treated_values: afterTreated,
      control_values: afterControl,
      counterfactual: method === 'SCM' ? counterfactual : undefined,
    },
  };
}
