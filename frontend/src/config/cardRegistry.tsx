import React from 'react';
import type { CardConfig } from '../types/layout';

// Overview 卡片
import SafetyScoreGaugeCard from '../components/overview/SafetyScoreGaugeCard';
import RiskRadarCard from '../components/overview/RiskRadarCard';
import SettlementOverviewCard from '../components/overview/SettlementOverviewCard';
import CracksOverviewCard from '../components/overview/CracksOverviewCard';
import TemperatureOverviewCard from '../components/overview/TemperatureOverviewCard';
import VibrationOverviewCard from '../components/overview/VibrationOverviewCard';

// Settlement 卡片
import { TrendChart } from '../components/charts/TrendChart';
import { DistributionChart } from '../components/charts/DistributionChart';
import { TimeSeriesChart } from '../components/charts/TimeSeriesChart';
import { RateChart } from '../components/charts/RateChart';
import { TrendPredictionChart } from '../components/charts/TrendPredictionChart';

// Temperature 卡片
import { TemperatureSeriesChart } from '../components/charts/temperature/TemperatureSeriesChart';
import { TemperatureTrendChart } from '../components/charts/temperature/TemperatureTrendChart';
import { TemperatureDistributionChart } from '../components/charts/temperature/TemperatureDistributionChart';
import { TemperatureRangeChart } from '../components/charts/temperature/TemperatureRangeChart';

// Cracks 卡片
import { CrackMainTrendChart } from '../components/charts/cracks/CrackMainTrendChart';
import { CrackAverageTrendChart } from '../components/charts/cracks/CrackAverageTrendChart';
import { CrackOverviewPieChart } from '../components/charts/cracks/CrackOverviewPieChart';
import { CrackDailyHistogramChart } from '../components/charts/cracks/CrackDailyHistogramChart';
import { CrackRateChart } from '../components/charts/cracks/CrackRateChart';
import { CrackSlopeChart } from '../components/charts/cracks/CrackSlopeChart';

export interface CardRegistryItem extends CardConfig {
  category: string;
  description?: string;
  requiresContext?: string[];
}

export const CARD_REGISTRY: Record<string, CardRegistryItem> = {
  // 综合分析卡片
  'safety-score': {
    id: 'safety-score',
    title: '项目安全总览',
    icon: 'fas fa-shield-alt',
    category: '综合分析',
    description: '显示项目整体安全评分和状态',
    component: SafetyScoreGaugeCard as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'risk-radar': {
    id: 'risk-radar',
    title: '综合风险评估',
    icon: 'fas fa-bullseye',
    category: '综合分析',
    description: '多维度风险雷达图',
    component: RiskRadarCard as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 0, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },

  // 沉降监测卡片
  'settlement-overview': {
    id: 'settlement-overview',
    title: '沉降监测概况',
    icon: 'fas fa-arrows-alt-v',
    category: '沉降监测',
    description: '沉降数据总览和统计',
    component: SettlementOverviewCard as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'settlement-trend': {
    id: 'settlement-trend',
    title: '沉降趋势分析',
    icon: 'fas fa-chart-bar',
    category: '沉降监测',
    description: '沉降趋势图表',
    component: TrendChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 8, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'settlement-distribution': {
    id: 'settlement-distribution',
    title: '沉降类型分布',
    icon: 'fas fa-chart-pie',
    category: '沉降监测',
    description: '趋势类型分布饼图',
    component: DistributionChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 8, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'settlement-timeseries': {
    id: 'settlement-timeseries',
    title: '沉降时间序列',
    icon: 'fas fa-chart-line',
    category: '沉降监测',
    description: '时间序列折线图',
    component: TimeSeriesChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 12, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'settlement-rate': {
    id: 'settlement-rate',
    title: '沉降速率',
    icon: 'fas fa-tachometer-alt',
    category: '沉降监测',
    description: '沉降速率变化图',
    component: RateChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 12, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'settlement-prediction': {
    id: 'settlement-prediction',
    title: '沉降趋势预测',
    icon: 'fas fa-crystal-ball',
    category: '沉降监测',
    description: '基于历史数据的趋势预测',
    component: TrendPredictionChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 16, w: 12, h: 4, minW: 6, minH: 4, maxH: 4 },
  },

  // 裂缝监测卡片
  'cracks-overview': {
    id: 'cracks-overview',
    title: '裂缝监测概况',
    icon: 'fas fa-stream',
    category: '裂缝监测',
    description: '裂缝数据总览和统计',
    component: CracksOverviewCard as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 20, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'crack-main-trend': {
    id: 'crack-main-trend',
    title: '裂缝主趋势',
    icon: 'fas fa-chart-line',
    category: '裂缝监测',
    description: '主要裂缝趋势图',
    component: CrackMainTrendChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 20, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'crack-average-trend': {
    id: 'crack-average-trend',
    title: '裂缝平均趋势',
    icon: 'fas fa-chart-area',
    category: '裂缝监测',
    description: '裂缝平均值趋势',
    component: CrackAverageTrendChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 24, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'crack-pie': {
    id: 'crack-pie',
    title: '裂缝分布',
    icon: 'fas fa-chart-pie',
    category: '裂缝监测',
    description: '裂缝类型分布饼图',
    component: CrackOverviewPieChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 24, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'crack-histogram': {
    id: 'crack-histogram',
    title: '裂缝日统计',
    icon: 'fas fa-chart-bar',
    category: '裂缝监测',
    description: '每日裂缝统计柱状图',
    component: CrackDailyHistogramChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 28, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'crack-rate': {
    id: 'crack-rate',
    title: '裂缝变化率',
    icon: 'fas fa-tachometer-alt',
    category: '裂缝监测',
    description: '裂缝变化速率图',
    component: CrackRateChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 28, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'crack-slope': {
    id: 'crack-slope',
    title: '裂缝斜率',
    icon: 'fas fa-angle-double-up',
    category: '裂缝监测',
    description: '裂缝发展斜率分析',
    component: CrackSlopeChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 32, w: 12, h: 4, minW: 6, minH: 4, maxH: 4 },
  },

  // 温度监测卡片
  'temperature-overview': {
    id: 'temperature-overview',
    title: '温度监测概况',
    icon: 'fas fa-thermometer-half',
    category: '温度监测',
    description: '温度数据总览和统计',
    component: TemperatureOverviewCard as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 36, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'temperature-series': {
    id: 'temperature-series',
    title: '温度时间序列',
    icon: 'fas fa-chart-line',
    category: '温度监测',
    description: '温度时间序列图',
    component: TemperatureSeriesChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 36, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'temperature-trend': {
    id: 'temperature-trend',
    title: '温度趋势',
    icon: 'fas fa-chart-area',
    category: '温度监测',
    description: '温度变化趋势图',
    component: TemperatureTrendChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 40, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'temperature-distribution': {
    id: 'temperature-distribution',
    title: '温度分布',
    icon: 'fas fa-chart-pie',
    category: '温度监测',
    description: '温度分布统计图',
    component: TemperatureDistributionChart as React.ComponentType<any>,
    defaultLayout: { x: 6, y: 40, w: 6, h: 4, minW: 4, minH: 4, maxH: 4 },
  },
  'temperature-range': {
    id: 'temperature-range',
    title: '温度范围',
    icon: 'fas fa-arrows-alt-h',
    category: '温度监测',
    description: '温度范围变化图',
    component: TemperatureRangeChart as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 44, w: 12, h: 4, minW: 6, minH: 4, maxH: 4 },
  },

  // 振动监测卡片
  'vibration-overview': {
    id: 'vibration-overview',
    title: '振动监测概况',
    icon: 'fas fa-wave-square',
    category: '振动监测',
    description: '振动数据总览和统计',
    component: VibrationOverviewCard as React.ComponentType<any>,
    defaultLayout: { x: 0, y: 48, w: 12, h: 4, minW: 6, minH: 4, maxH: 4 },
  },
};

export const CARD_CATEGORIES = Array.from(new Set(Object.values(CARD_REGISTRY).map(c => c.category)));

export function getCardsByCategory(category: string): CardRegistryItem[] {
  return Object.values(CARD_REGISTRY).filter(c => c.category === category);
}

export function getCardById(id: string): CardRegistryItem | undefined {
  return CARD_REGISTRY[id];
}
