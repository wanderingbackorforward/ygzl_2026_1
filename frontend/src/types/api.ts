// Settlement API Types
export interface SummaryDataItem {
  point_id: string;
  trend_slope: number;
  trend_type: string;
  alert_level: string;
  avg_value: number;
  total_change: number;
  avg_daily_rate: number;
}

export interface PointTimeSeriesData {
  date: string;
  original_value: number;
  daily_change: number;
  cumulative_change: number;
}

export interface PointAnalysisData {
  avg_value: number;
  total_change: number;
  avg_daily_rate: number;
  trend_type: string;
  alert_level: string;
}

export interface PointDetailData {
  timeSeriesData: PointTimeSeriesData[];
  analysisData: PointAnalysisData;
}

export interface TrendStats {
  rising: number;
  stable: number;
  falling: number;
}

// Prediction API Types
export interface ConfidenceInterval {
  day: number;
  lower: number;
  upper: number;
}

export interface PredictionHistorical {
  dates: string[];
  days: number[];
  values: number[];
  fitted_values: number[];
}

export interface PredictionRegression {
  slope: number;
  intercept: number;
  r_squared: number;
  equation: string;
}

export interface PredictionForecast {
  dates: string[];
  days: number[];
  values: number[];
  confidence_intervals: ConfidenceInterval[];
  end_prediction: number;
  predicted_change: number;
}

export interface RiskAssessment {
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'normal';
  risk_score: number;
  warnings: string[];
  trend_type: string;
  alert_level: string;
}

export interface ModelQuality {
  mse: number;
  rmse: number;
  data_points: number;
}

export interface PointPredictionData {
  point_id: string;
  historical: PredictionHistorical;
  regression: PredictionRegression;
  prediction: PredictionForecast;
  risk_assessment: RiskAssessment;
  model_quality: ModelQuality;
}

export interface PredictionSummaryItem {
  point_id: string;
  trend_slope: number;
  r_squared: number;
  trend_type: string;
  alert_level: string;
  risk_score: number;
  risk_level: string;
  predicted_change_30d: number;
  predicted_value_30d: number;
  warnings: string;
}

export interface RiskAlertStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  normal: number;
  total: number;
}

export interface RiskAlertsResponse {
  alerts: PredictionSummaryItem[];
  stats: RiskAlertStats;
}

// Temperature API Types
export interface TemperatureSensor {
  sensor_id: string;
  location?: string;
  elevation?: number;
  avg_temp: number;
  min_temp: number;
  max_temp: number;
  trend_type: string;
  alert_status: string;
}

export interface TemperatureDataPoint {
  measurement_date: string;
  avg_temperature: number;
  min_temperature: number;
  max_temperature: number;
  temperature_range: number;
}

export interface TemperatureSummary {
  total_sensors: number;
  avg_temp: number;
  min_temp: number;
  max_temp: number;
  date_range: {
    start: string;
    end: string;
  };
}

export interface TemperatureAnalysisData {
  sensor_id?: string;
  sensor_name?: string;
  avg_temperature?: number;
  min_temperature?: number;
  max_temperature?: number;
  std_deviation?: number;
  avg_daily_range?: number;
  data_count?: number;
  trend_type?: string;
  trend_slope?: number;
  r_squared?: number;
  p_value?: number;
  alert_level?: string;
  last_updated?: string;
}

export interface TemperatureDetailData {
  timeSeriesData: TemperatureDataPoint[];
  analysisData: TemperatureAnalysisData;
}

// Crack API Types
export interface CrackMonitoringPoint {
  point_id: string;
  status: string;
  trend_type: string;
  change_type: string;
}

export interface CrackDataPoint {
  measurement_date: string;
  value: number;
  daily_change: number;
  cumulative_change: number;
}

export interface CrackAnalysisResult {
  point_id: string;
  avg_value?: number;
  mean_value?: number;
  total_change?: number;
  avg_daily_rate?: number;
  average_change_rate?: number;
  trend_slope?: number;
  slope?: number;
  trend_type?: string;
  change_type?: string;
  alert_level?: string;
  analysis_date?: string;
}

export interface CrackStatsOverview {
  total_points: number;
  expanding: number;
  stable: number;
  contracting: number;
  avg_daily_change: number;
  max_change_point: string;
}

// Vibration API Types
export interface VibrationChannel {
  channel_id: string;
  name: string;
  unit: string;
}

export interface VibrationData {
  timestamps: (number | string)[];
  values: number[];
  sample_rate: number;
  unit?: string;
}

export interface VibrationMetrics {
  mean: number;
  std: number;
  peak: number;
  rms: number;
  center_freq: number;
  crest_factor: number;
  impulse_factor: number;
}

// Common Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface DateRange {
  start: string;
  end: string;
}
