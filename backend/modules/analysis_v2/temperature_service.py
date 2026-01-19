# -*- coding: utf-8 -*-
"""
温度二级数据分析服务
从原始数据实时计算异常检测、深度分析、建议生成
"""

import os
import json
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict

from modules.db.vendor import get_repo

from .base import (
    BaseAnalysisService,
    AnalysisResult,
    AnalysisStats,
    AnomalyItem,
    Recommendation,
    SeverityLevel,
    AnomalyType,
    RecommendationPriority
)

class TemperatureAnalysisService(BaseAnalysisService):
    """温度分析服务 - 从原始数据实时计算"""

    # 阈值配置 (温度单位: 摄氏度)
    THRESHOLDS = {
        'temp_high_critical': 45.0,      # 高温严重阈值
        'temp_high_warning': 38.0,       # 高温警戒阈值
        'temp_low_critical': -10.0,      # 低温严重阈值
        'temp_low_warning': 0.0,         # 低温警戒阈值
        'daily_range_critical': 25.0,    # 日温差严重阈值
        'daily_range_warning': 18.0,     # 日温差警戒阈值
        'rate_change_critical': 5.0,     # 温度变化率严重阈值 (度/天)
        'rate_change_warning': 3.0,      # 温度变化率警戒阈值
    }

    def __init__(self):
        super().__init__('temperature')
        self._repo = get_repo()
        self._window_days = int(os.environ.get('ANALYSIS_V2_TEMPERATURE_WINDOW_DAYS', '90') or 90)
        self._thresholds = self._load_thresholds()
        self._processed_data = None
        self._sensor_stats = None

    def _load_thresholds(self) -> Dict[str, float]:
        thresholds = dict(self.THRESHOLDS)

        raw = (os.environ.get('ANALYSIS_V2_TEMPERATURE_THRESHOLDS_JSON') or '').strip()
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    for k, v in parsed.items():
                        if k in thresholds and v is not None:
                            thresholds[k] = float(v)
            except Exception:
                pass

        env_map = {
            'ANALYSIS_V2_TEMP_HIGH_CRITICAL': 'temp_high_critical',
            'ANALYSIS_V2_TEMP_HIGH_WARNING': 'temp_high_warning',
            'ANALYSIS_V2_TEMP_LOW_CRITICAL': 'temp_low_critical',
            'ANALYSIS_V2_TEMP_LOW_WARNING': 'temp_low_warning',
            'ANALYSIS_V2_TEMP_DAILY_RANGE_CRITICAL': 'daily_range_critical',
            'ANALYSIS_V2_TEMP_DAILY_RANGE_WARNING': 'daily_range_warning',
            'ANALYSIS_V2_TEMP_RATE_CHANGE_CRITICAL': 'rate_change_critical',
            'ANALYSIS_V2_TEMP_RATE_CHANGE_WARNING': 'rate_change_warning',
        }
        for env_key, key in env_map.items():
            v = os.environ.get(env_key)
            if v is None:
                continue
            v = str(v).strip()
            if not v:
                continue
            try:
                thresholds[key] = float(v)
            except Exception:
                continue

        return thresholds

    def _normalize_date_str(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        s = str(value).split('T')[0].strip()
        if not s:
            return None
        try:
            return datetime.strptime(s, '%Y-%m-%d').date().isoformat()
        except Exception:
            return None

    def _fetch_processed_data(self) -> List[Dict]:
        """获取处理后的温度数据"""
        if self._processed_data is not None:
            return self._processed_data

        try:
            data = self._repo.temperature_get_processed_window(self._window_days)
            for row in data:
                sid = row.get('SID') or row.get('sensor_id')
                if sid is not None and 'SID' not in row:
                    row['SID'] = sid
                if 'avg_temp' in row and 'avg_temperature' not in row:
                    row['avg_temperature'] = row.get('avg_temp')
                if 'min_temp' in row and 'min_temperature' not in row:
                    row['min_temperature'] = row.get('min_temp')
                if 'max_temp' in row and 'max_temperature' not in row:
                    row['max_temperature'] = row.get('max_temp')
                row['measurement_date'] = self._normalize_date_str(row.get('measurement_date'))
                if row.get('temperature_range') is None and row.get('max_temperature') is not None and row.get('min_temperature') is not None:
                    row['temperature_range'] = float(row['max_temperature']) - float(row['min_temperature'])

            self._processed_data = data
            return self._processed_data
        except Exception as e:
            print(f"[TemperatureAnalysisService] Fetch processed data failed: {e}")
            return []

    def _calculate_sensor_stats(self) -> Dict[str, Dict]:
        """从原始数据计算每个传感器的统计信息"""
        if self._sensor_stats is not None:
            return self._sensor_stats

        processed_data = self._fetch_processed_data()
        if not processed_data:
            return {}

        # 按传感器分组
        sensor_data = defaultdict(list)
        for record in processed_data:
            sensor_id = record.get('SID')
            if sensor_id:
                sensor_data[sensor_id].append(record)

        self._sensor_stats = {}

        for sensor_id, records in sensor_data.items():
            if len(records) < 2:
                continue

            records.sort(key=lambda x: x.get('measurement_date') or '')

            latest_record = None
            for r in reversed(records):
                if r.get('measurement_date'):
                    latest_record = r
                    break
            latest_record = latest_record or (records[-1] if records else None)
            if not latest_record:
                continue

            def coerce_float(v: Any) -> Optional[float]:
                if v is None:
                    return None
                try:
                    return float(v)
                except Exception:
                    return None

            def last_non_null(key: str) -> Optional[float]:
                for r in reversed(records):
                    v = r.get(key)
                    if v is not None:
                        try:
                            return float(v)
                        except Exception:
                            return None
                return None

            current_max = coerce_float(latest_record.get('max_temperature'))
            if current_max is None:
                current_max = last_non_null('max_temperature')
            current_min = coerce_float(latest_record.get('min_temperature'))
            if current_min is None:
                current_min = last_non_null('min_temperature')
            current_range = coerce_float(latest_record.get('temperature_range'))
            if current_range is None:
                current_range = last_non_null('temperature_range')

            overall_max = None
            overall_min = None
            avg_range = None

            max_vals = [float(r.get('max_temperature')) for r in records if r.get('max_temperature') is not None]
            min_vals = [float(r.get('min_temperature')) for r in records if r.get('min_temperature') is not None]
            range_vals = [float(r.get('temperature_range')) for r in records if r.get('temperature_range') is not None]
            overall_max = max(max_vals) if max_vals else None
            overall_min = min(min_vals) if min_vals else None
            avg_range = sum(range_vals) / len(range_vals) if range_vals else None

            metric_key = 'max_temperature'
            by_date = {}
            for r in records:
                d = r.get('measurement_date')
                v = r.get(metric_key)
                if d and v is not None:
                    try:
                        dt = datetime.strptime(str(d), '%Y-%m-%d').date()
                        by_date[dt] = float(v)
                    except Exception:
                        continue

            if len(by_date) < 2:
                metric_key = 'min_temperature'
                by_date = {}
                for r in records:
                    d = r.get('measurement_date')
                    v = r.get(metric_key)
                    if d and v is not None:
                        try:
                            dt = datetime.strptime(str(d), '%Y-%m-%d').date()
                            by_date[dt] = float(v)
                        except Exception:
                            continue

            if len(by_date) < 2:
                metric_key = 'temperature_range'
                by_date = {}
                for r in records:
                    d = r.get('measurement_date')
                    v = r.get(metric_key)
                    if d and v is not None:
                        try:
                            dt = datetime.strptime(str(d), '%Y-%m-%d').date()
                            by_date[dt] = float(v)
                        except Exception:
                            continue

            if len(by_date) < 2:
                continue

            dates = sorted(by_date.keys())
            series = [by_date[d] for d in dates]

            if len(series) >= 3:
                base_date = dates[0]
                x = np.array([(d - base_date).days for d in dates], dtype=float)
                y = np.array(series, dtype=float)
                slope, intercept = np.polyfit(x, y, 1)
                y_pred = slope * x + intercept
                overall_mean = float(np.mean(y)) if len(y) else 0.0
                ss_res = float(np.sum((y - y_pred) ** 2))
                ss_tot = float(np.sum((y - overall_mean) ** 2))
                r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
                predicted_date = dates[-1] + timedelta(days=7)
                x_pred = float((predicted_date - base_date).days)
                predicted_7d = float(slope * x_pred + intercept)
            else:
                slope = 0
                r_squared = 0
                predicted_7d = series[-1] if series else None

            # 确定趋势类型
            if abs(slope) < 0.1:
                trend_type = "stable"
            elif slope > 0.5:
                trend_type = "rising_fast"
            elif slope > 0.1:
                trend_type = "rising"
            elif slope < -0.5:
                trend_type = "falling_fast"
            elif slope < -0.1:
                trend_type = "falling"
            else:
                trend_type = "stable"

            # 确定告警级别
            alert_level = "normal"
            if current_max is not None and current_max >= self._thresholds['temp_high_critical']:
                alert_level = "alert"
            elif current_min is not None and current_min <= self._thresholds['temp_low_critical']:
                alert_level = "alert"
            elif current_max is not None and current_max >= self._thresholds['temp_high_warning']:
                alert_level = "warning"
            elif current_min is not None and current_min <= self._thresholds['temp_low_warning']:
                alert_level = "warning"
            if current_range is not None and current_range >= self._thresholds['daily_range_critical']:
                alert_level = "alert"
            elif current_range is not None and current_range >= self._thresholds['daily_range_warning']:
                if alert_level != "alert":
                    alert_level = "warning"

            self._sensor_stats[sensor_id] = {
                'sensor_id': sensor_id,
                'current_max': current_max,
                'current_min': current_min,
                'current_range': current_range,
                'overall_max': overall_max,
                'overall_min': overall_min,
                'avg_range': avg_range,
                'trend_slope': slope,
                'r_squared': r_squared,
                'trend_type': trend_type,
                'alert_level': alert_level,
                'predicted_temp_7d': predicted_7d,
                'trend_metric': metric_key,
                'data_count': len(series),
                'first_date': dates[0].isoformat() if dates else None,
                'last_date': dates[-1].isoformat() if dates else None,
            }

        return self._sensor_stats

    def analyze(self) -> AnalysisResult:
        """执行完整分析 - 从原始数据实时计算"""
        sensor_stats = self._calculate_sensor_stats()

        # 检测异常
        anomalies = self.detect_anomalies()

        # 生成建议
        recommendations = self.generate_recommendations(anomalies)

        # 计算统计
        stats = self._calculate_stats(anomalies, len(sensor_stats))

        # 构建汇总信息
        summary = self._build_summary(sensor_stats, anomalies)

        return AnalysisResult(
            data_type=self.data_type,
            analysis_time=self._get_current_time(),
            stats=stats,
            anomalies=anomalies,
            recommendations=recommendations,
            summary=summary,
            metadata={
                'thresholds': self._thresholds,
                'data_source': 'processed_temperature_data',
                'calculation_method': 'realtime',
            }
        )

    def detect_anomalies(self) -> List[AnomalyItem]:
        """从原始数据检测所有类型的异常"""
        anomalies = []
        sensor_stats = self._calculate_sensor_stats()

        for sensor_id, stats in sensor_stats.items():
            current_max = stats.get('current_max')
            current_min = stats.get('current_min')
            current_range = stats.get('current_range')
            trend_slope = stats.get('trend_slope', 0)
            trend_type = stats.get('trend_type', '')

            # 1. 检测高温异常
            if current_max is not None:
                high_temp_anomaly = self._check_high_temp_anomaly(sensor_id, current_max, stats)
                if high_temp_anomaly:
                    anomalies.append(high_temp_anomaly)

            # 2. 检测低温异常
            if current_min is not None:
                low_temp_anomaly = self._check_low_temp_anomaly(sensor_id, current_min, stats)
                if low_temp_anomaly:
                    anomalies.append(low_temp_anomaly)

            # 3. 检测日温差异常
            if current_range is not None:
                range_anomaly = self._check_range_anomaly(sensor_id, current_range, stats)
                if range_anomaly:
                    anomalies.append(range_anomaly)

            # 4. 检测温度变化率异常
            if abs(trend_slope) >= self._thresholds['rate_change_warning']:
                rate_anomaly = self._check_rate_anomaly(sensor_id, trend_slope, stats)
                if rate_anomaly:
                    anomalies.append(rate_anomaly)

            # 5. 检测趋势异常
            if trend_type in ['rising_fast', 'falling_fast']:
                trend_anomaly = self._check_trend_anomaly(sensor_id, trend_type, trend_slope, stats)
                if trend_anomaly:
                    anomalies.append(trend_anomaly)

        # 按严重程度排序
        severity_order = {
            SeverityLevel.CRITICAL.value: 0,
            SeverityLevel.HIGH.value: 1,
            SeverityLevel.MEDIUM.value: 2,
            SeverityLevel.LOW.value: 3,
            SeverityLevel.NORMAL.value: 4,
        }
        anomalies.sort(key=lambda x: severity_order.get(x.severity, 5))

        return anomalies

    def _check_high_temp_anomaly(self, sensor_id: str, current_max: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查高温异常"""
        if current_max >= self._thresholds['temp_high_critical']:
            severity = SeverityLevel.CRITICAL.value
            title = f"[{sensor_id}] 高温严重超标"
            description = f"当前最高温度 {current_max:.1f}C，超过严重阈值 {self._thresholds['temp_high_critical']}C"
        elif current_max >= self._thresholds['temp_high_warning']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 高温预警"
            description = f"当前最高温度 {current_max:.1f}C，超过警戒阈值 {self._thresholds['temp_high_warning']}C"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('high'),
            point_id=sensor_id,
            anomaly_type=AnomalyType.THRESHOLD_EXCEEDED.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            data_time=stats.get('last_date'),
            current_value=current_max,
            threshold=self._thresholds['temp_high_critical'] if severity == SeverityLevel.CRITICAL.value else self._thresholds['temp_high_warning'],
            trend='up',
            metadata={
                'alert_level': stats.get('alert_level'),
                'anomaly_subtype': 'high_temperature',
            }
        )

    def _check_low_temp_anomaly(self, sensor_id: str, current_min: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查低温异常"""
        if current_min <= self._thresholds['temp_low_critical']:
            severity = SeverityLevel.CRITICAL.value
            title = f"[{sensor_id}] 低温严重超标"
            description = f"当前最低温度 {current_min:.1f}C，低于严重阈值 {self._thresholds['temp_low_critical']}C"
        elif current_min <= self._thresholds['temp_low_warning']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 低温预警"
            description = f"当前最低温度 {current_min:.1f}C，低于警戒阈值 {self._thresholds['temp_low_warning']}C"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('low'),
            point_id=sensor_id,
            anomaly_type=AnomalyType.THRESHOLD_EXCEEDED.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            data_time=stats.get('last_date'),
            current_value=current_min,
            threshold=self._thresholds['temp_low_critical'] if severity == SeverityLevel.CRITICAL.value else self._thresholds['temp_low_warning'],
            trend='down',
            metadata={
                'alert_level': stats.get('alert_level'),
                'anomaly_subtype': 'low_temperature',
            }
        )

    def _check_range_anomaly(self, sensor_id: str, current_range: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查日温差异常"""
        if current_range >= self._thresholds['daily_range_critical']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 日温差严重超标"
            description = f"当前日温差 {current_range:.1f}C，超过严重阈值 {self._thresholds['daily_range_critical']}C"
        elif current_range >= self._thresholds['daily_range_warning']:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{sensor_id}] 日温差偏大"
            description = f"当前日温差 {current_range:.1f}C，超过警戒阈值 {self._thresholds['daily_range_warning']}C"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('range'),
            point_id=sensor_id,
            anomaly_type='temperature_range_abnormal',
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            data_time=stats.get('last_date'),
            current_value=current_range,
            threshold=self._thresholds['daily_range_critical'] if severity == SeverityLevel.HIGH.value else self._thresholds['daily_range_warning'],
            metadata={
                'current_max': stats.get('current_max'),
                'current_min': stats.get('current_min'),
                'avg_range': stats.get('avg_range'),
            }
        )

    def _check_rate_anomaly(self, sensor_id: str, trend_slope: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查温度变化率异常"""
        abs_rate = abs(trend_slope)

        if abs_rate >= self._thresholds['rate_change_critical']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 温度变化率严重超标"
            direction = "升温" if trend_slope > 0 else "降温"
            description = f"日均{direction}速率 {abs_rate:.2f}C/天，超过严重阈值 {self._thresholds['rate_change_critical']}C/天"
        elif abs_rate >= self._thresholds['rate_change_warning']:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{sensor_id}] 温度变化率偏高"
            direction = "升温" if trend_slope > 0 else "降温"
            description = f"日均{direction}速率 {abs_rate:.2f}C/天，超过警戒阈值 {self._thresholds['rate_change_warning']}C/天"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('rate'),
            point_id=sensor_id,
            anomaly_type=AnomalyType.RATE_ABNORMAL.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            data_time=stats.get('last_date'),
            current_value=trend_slope,
            threshold=self._thresholds['rate_change_critical'] if severity == SeverityLevel.HIGH.value else self._thresholds['rate_change_warning'],
            trend='up' if trend_slope > 0 else 'down',
            metadata={
                'r_squared': stats.get('r_squared'),
                'data_count': stats.get('data_count'),
                'trend_metric': stats.get('trend_metric'),
            }
        )

    def _check_trend_anomaly(self, sensor_id: str, trend_type: str, trend_slope: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查趋势异常"""
        if trend_type == 'rising_fast':
            severity = SeverityLevel.MEDIUM.value
            title = f"[{sensor_id}] 检测到快速升温趋势"
            description = f"传感器呈现快速升温趋势，日均变化 {trend_slope:.2f}C"
        elif trend_type == 'falling_fast':
            severity = SeverityLevel.MEDIUM.value
            title = f"[{sensor_id}] 检测到快速降温趋势"
            description = f"传感器呈现快速降温趋势，日均变化 {trend_slope:.2f}C"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('trend'),
            point_id=sensor_id,
            anomaly_type=AnomalyType.TREND_ABNORMAL.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            data_time=stats.get('last_date'),
            trend='up' if trend_slope > 0 else 'down',
            metadata={
                'trend_type': trend_type,
                'r_squared': stats.get('r_squared'),
                'predicted_temp_7d': stats.get('predicted_temp_7d'),
            }
        )

    def generate_recommendations(self, anomalies: List[AnomalyItem]) -> List[Recommendation]:
        """基于异常生成处置建议"""
        recommendations = []

        # 统计各严重程度的异常
        critical_anomalies = [a for a in anomalies if a.severity == SeverityLevel.CRITICAL.value]
        high_anomalies = [a for a in anomalies if a.severity == SeverityLevel.HIGH.value]
        medium_anomalies = [a for a in anomalies if a.severity == SeverityLevel.MEDIUM.value]

        # 高温异常
        high_temp_anomalies = [a for a in anomalies if a.metadata and a.metadata.get('anomaly_subtype') == 'high_temperature']
        if high_temp_anomalies:
            points = list(set(a.point_id for a in high_temp_anomalies))
            priority = RecommendationPriority.URGENT.value if any(a.severity == SeverityLevel.CRITICAL.value for a in high_temp_anomalies) else RecommendationPriority.HIGH.value
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=priority,
                title="高温区域降温措施",
                description=f"发现 {len(high_temp_anomalies)} 个传感器高温预警。建议检查通风设备、遮阳措施，必要时启动降温设备。",
                action_type="inspect",
                target_points=points,
                estimated_urgency="24小时内" if priority == RecommendationPriority.URGENT.value else "3天内",
                reference_anomalies=[a.id for a in high_temp_anomalies],
            ))

        # 低温异常
        low_temp_anomalies = [a for a in anomalies if a.metadata and a.metadata.get('anomaly_subtype') == 'low_temperature']
        if low_temp_anomalies:
            points = list(set(a.point_id for a in low_temp_anomalies))
            priority = RecommendationPriority.URGENT.value if any(a.severity == SeverityLevel.CRITICAL.value for a in low_temp_anomalies) else RecommendationPriority.HIGH.value
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=priority,
                title="低温区域保温措施",
                description=f"发现 {len(low_temp_anomalies)} 个传感器低温预警。建议检查保温设施、加热设备，防止冻害。",
                action_type="inspect",
                target_points=points,
                estimated_urgency="24小时内" if priority == RecommendationPriority.URGENT.value else "3天内",
                reference_anomalies=[a.id for a in low_temp_anomalies],
            ))

        # 温差异常
        range_anomalies = [a for a in anomalies if a.anomaly_type == 'temperature_range_abnormal']
        if range_anomalies:
            points = list(set(a.point_id for a in range_anomalies))
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.MEDIUM.value,
                title="温差过大区域检查",
                description=f"发现 {len(range_anomalies)} 个传感器日温差超标。建议检查该区域保温性能、通风状况。",
                action_type="inspect",
                target_points=points,
                estimated_urgency="7天内",
                reference_anomalies=[a.id for a in range_anomalies],
            ))

        # 无异常时的建议
        if not anomalies:
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.LOW.value,
                title="维持常规监测",
                description="当前所有传感器温度指标正常，建议继续保持常规监测频率。",
                action_type="monitor",
                target_points=[],
            ))

        return recommendations

    def _build_summary(self, sensor_stats: Dict[str, Dict], anomalies: List[AnomalyItem]) -> Dict[str, Any]:
        """构建汇总信息"""
        if not sensor_stats:
            return {}

        # 统计趋势分布
        trend_distribution = defaultdict(int)
        alert_distribution = defaultdict(int)

        current_temps = []
        current_maxes = []
        current_mins = []
        temp_ranges = []
        slopes = []

        for sensor_id, stats in sensor_stats.items():
            trend_type = stats.get('trend_type', 'unknown')
            trend_distribution[trend_type] += 1

            alert_level = stats.get('alert_level', 'unknown')
            alert_distribution[alert_level] += 1

            if stats.get('current_max') is not None:
                current_maxes.append(stats['current_max'])
            if stats.get('current_min') is not None:
                current_mins.append(stats['current_min'])
            if stats.get('current_max') is not None and stats.get('current_min') is not None:
                current_temps.append((stats['current_max'] + stats['current_min']) / 2)
            if stats.get('current_range') is not None:
                temp_ranges.append(stats['current_range'])
            if stats.get('trend_slope') is not None:
                slopes.append(stats['trend_slope'])

        avg_temp = sum(current_temps) / len(current_temps) if current_temps else None
        max_temp = max(current_maxes) if current_maxes else None
        min_temp = min(current_mins) if current_mins else None
        avg_range = sum(temp_ranges) / len(temp_ranges) if temp_ranges else None
        avg_slope = sum(slopes) / len(slopes) if slopes else 0

        return {
            'total_points': len(sensor_stats),
            'anomaly_points': len(set(a.point_id for a in anomalies)),
            'trend_distribution': dict(trend_distribution),
            'alert_distribution': dict(alert_distribution),
            'avg_daily_rate': round(avg_slope, 4),
            'critical_count': len([a for a in anomalies if a.severity == SeverityLevel.CRITICAL.value]),
            'high_count': len([a for a in anomalies if a.severity == SeverityLevel.HIGH.value]),
            'current_avg_temperature': round(avg_temp, 1) if avg_temp is not None else None,
            'current_max_temperature': round(max_temp, 1) if max_temp is not None else None,
            'current_min_temperature': round(min_temp, 1) if min_temp is not None else None,
            'avg_daily_range': round(avg_range, 1) if avg_range is not None else None,
        }
