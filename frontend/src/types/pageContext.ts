/**
 * 页面上下文类型定义
 */

export interface PageContext {
  pagePath: string;           // 当前页面路径
  pageTitle: string;          // 页面标题
  moduleKey: string;          // 模块标识
  dataSnapshot: DataSnapshot; // 数据快照
  metadata: PageMetadata;     // 元数据
}

export interface DataSnapshot {
  summary: Record<string, any>;     // 汇总数据
  selectedItems: any[];             // 选中的项目
  filters: Record<string, any>;     // 当前筛选条件
  dateRange?: [string, string];     // 时间范围
  statistics?: Record<string, number>; // 统计数据
}

export interface PageMetadata {
  lastUpdate: string;         // 最后更新时间
  dataSource: string;         // 数据源
  recordCount: number;        // 记录数
  hasAnomalies?: boolean;     // 是否有异常
  anomalyCount?: number;      // 异常数量
}

/**
 * 各模块特定的上下文类型
 */

// InSAR 模块上下文
export interface InsarContext extends PageContext {
  dataSnapshot: DataSnapshot & {
    summary: {
      totalPoints: number;
      avgVelocity: number;
      maxVelocity: number;
      minVelocity: number;
      velocityRange: [number, number];
    };
  };
}

// 沉降模块上下文
export interface SettlementContext extends PageContext {
  dataSnapshot: DataSnapshot & {
    summary: {
      totalPoints: number;
      avgSettlement: number;
      maxSettlement: number;
      trendType: string;
      riskLevel: string;
    };
  };
}

// 温度模块上下文
export interface TemperatureContext extends PageContext {
  dataSnapshot: DataSnapshot & {
    summary: {
      totalSensors: number;
      avgTemperature: number;
      maxTemperature: number;
      minTemperature: number;
      temperatureRange: [number, number];
    };
  };
}

// 裂缝模块上下文
export interface CracksContext extends PageContext {
  dataSnapshot: DataSnapshot & {
    summary: {
      totalCracks: number;
      avgWidth: number;
      maxWidth: number;
      growthRate: number;
    };
  };
}

// 振动模块上下文
export interface VibrationContext extends PageContext {
  dataSnapshot: DataSnapshot & {
    summary: {
      totalSensors: number;
      avgAmplitude: number;
      maxAmplitude: number;
      frequency: number;
    };
  };
}

// 总览模块上下文
export interface OverviewContext extends PageContext {
  dataSnapshot: DataSnapshot & {
    summary: {
      safetyScore: number;
      riskLevel: string;
      modulesStatus: Record<string, string>;
      totalAnomalies: number;
    };
  };
}
