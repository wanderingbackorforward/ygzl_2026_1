# -*- coding: utf-8 -*-
"""
温度二级数据分析服务
从原始数据实时计算异常检测、深度分析、建议生成
"""

import os
import requests
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict

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


def _headers():
    """Supabase HTTP请求头"""
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h


def _url(path):
    """构建Supabase API URL"""
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


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
        self._processed_data = None
        self._sensor_stats = None

    def _fetch_processed_data(self) -> List[Dict]:
        """获取处理后的温度数据"""
        if self._processed_data is not None:
            return self._processed_data

        try:
            # 获取所有处理后的数据，按时间排序
            # 注意: 温度表使用 SID 作为传感器ID, avg_temp/min_temp/max_temp 作为字段名
            r = requests.get(
                _url('/rest/v1/processed_temperature_data?select=SID,measurement_date,avg_temp,min_temp,max_temp&order=measurement_date.asc'),
                headers=_headers()
            )
            r.raise_for_status()
            data = r.json()

            # 标准化字段名
            for row in data:
                if 'avg_temp' in row and 'avg_temperature' not in row:
                    row['avg_temperature'] = row['avg_temp']
                if 'min_temp' in row and 'min_temperature' not in row:
                    row['min_temperature'] = row['min_temp']
                if 'max_temp' in row and 'max_temperature' not in row:
                    row['max_temperature'] = row['max_temp']
                # 计算温差
                if row.get('max_temperature') is not None and row.get('min_temperature') is not None:
                    row['temperature_range'] = row['max_temperature'] - row['min_temperature']

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

            # 按时间排序
            records.sort(key=lambda x: x.get('measurement_date', ''))

            # 提取数值
            avg_temps = []
            max_temps = []
            min_temps = []
            temp_ranges = []
            dates = []

            for r in records:
                avg_t = r.get('avg_temperature')
                max_t = r.get('max_temperature')
                min_t = r.get('min_temperature')
                tr = r.get('temperature_range')

                if avg_t is not None:
                    avg_temps.append(float(avg_t))
                    dates.append(r.get('measurement_date'))
                if max_t is not None:
                    max_temps.append(float(max_t))
                if min_t is not None:
                    min_temps.append(float(min_t))
                if tr is not None:
                    temp_ranges.append(float(tr))

            if len(avg_temps) < 2:
                continue

            # 计算基本统计
            current_avg = avg_temps[-1]
            current_max = max_temps[-1] if max_temps else None
            current_min = min_temps[-1] if min_temps else None
            current_range = temp_ranges[-1] if temp_ranges else None

            overall_avg = sum(avg_temps) / len(avg_temps)
            overall_max = max(max_temps) if max_temps else None
            overall_min = min(min_temps) if min_temps else None
            avg_range = sum(temp_ranges) / len(temp_ranges) if temp_ranges else None
            std_temp = np.std(avg_temps) if len(avg_temps) > 1 else 0

            # 计算温度变化趋势（使用线性回归）
            if len(avg_temps) >= 3:
                x = np.arange(len(avg_temps))
                slope, intercept = np.polyfit(x, avg_temps, 1)

                # 计算R方
                y_pred = slope * x + intercept
                ss_res = np.sum((np.array(avg_temps) - y_pred) ** 2)
                ss_tot = np.sum((np.array(avg_temps) - overall_avg) ** 2)
                r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

                # 预测7天后的温度
                days_in_data = len(avg_temps)
                predicted_7d = slope * (days_in_data + 7) + intercept
            else:
                slope = 0
                r_squared = 0
                predicted_7d = current_avg

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
            if current_avg is not None:
                if current_avg >= self.THRESHOLDS['temp_high_critical'] or current_avg <= self.THRESHOLDS['temp_low_critical']:
                    alert_level = "alert"
                elif current_avg >= self.THRESHOLDS['temp_high_warning'] or current_avg <= self.THRESHOLDS['temp_low_warning']:
                    alert_level = "warning"
            if current_range is not None and current_range >= self.THRESHOLDS['daily_range_critical']:
                alert_level = "alert"
            elif current_range is not None and current_range >= self.THRESHOLDS['daily_range_warning']:
                if alert_level != "alert":
                    alert_level = "warning"

            self._sensor_stats[sensor_id] = {
                'sensor_id': sensor_id,
                'current_avg': current_avg,
                'current_max': current_max,
                'current_min': current_min,
                'current_range': current_range,
                'overall_avg': overall_avg,
                'overall_max': overall_max,
                'overall_min': overall_min,
                'avg_range': avg_range,
                'std_deviation': std_temp,
                'trend_slope': slope,
                'r_squared': r_squared,
                'trend_type': trend_type,
                'alert_level': alert_level,
                'predicted_temp_7d': predicted_7d,
                'data_count': len(avg_temps),
                'first_date': dates[0] if dates else None,
                'last_date': dates[-1] if dates else None,
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
                'thresholds': self.THRESHOLDS,
                'data_source': 'processed_temperature_data',
                'calculation_method': 'realtime',
            }
        )

    def detect_anomalies(self) -> List[AnomalyItem]:
        """从原始数据检测所有类型的异常"""
        anomalies = []
        sensor_stats = self._calculate_sensor_stats()

        for sensor_id, stats in sensor_stats.items():
            current_avg = stats.get('current_avg')
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
            if abs(trend_slope) >= self.THRESHOLDS['rate_change_warning']:
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
        if current_max >= self.THRESHOLDS['temp_high_critical']:
            severity = SeverityLevel.CRITICAL.value
            title = f"[{sensor_id}] 高温严重超标"
            description = f"当前最高温度 {current_max:.1f}C，超过严重阈值 {self.THRESHOLDS['temp_high_critical']}C"
        elif current_max >= self.THRESHOLDS['temp_high_warning']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 高温预警"
            description = f"当前最高温度 {current_max:.1f}C，超过警戒阈值 {self.THRESHOLDS['temp_high_warning']}C"
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
            current_value=current_max,
            threshold=self.THRESHOLDS['temp_high_critical'] if severity == SeverityLevel.CRITICAL.value else self.THRESHOLDS['temp_high_warning'],
            trend='up',
            metadata={
                'alert_level': stats.get('alert_level'),
                'current_avg': stats.get('current_avg'),
                'anomaly_subtype': 'high_temperature',
            }
        )

    def _check_low_temp_anomaly(self, sensor_id: str, current_min: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查低温异常"""
        if current_min <= self.THRESHOLDS['temp_low_critical']:
            severity = SeverityLevel.CRITICAL.value
            title = f"[{sensor_id}] 低温严重超标"
            description = f"当前最低温度 {current_min:.1f}C，低于严重阈值 {self.THRESHOLDS['temp_low_critical']}C"
        elif current_min <= self.THRESHOLDS['temp_low_warning']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 低温预警"
            description = f"当前最低温度 {current_min:.1f}C，低于警戒阈值 {self.THRESHOLDS['temp_low_warning']}C"
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
            current_value=current_min,
            threshold=self.THRESHOLDS['temp_low_critical'] if severity == SeverityLevel.CRITICAL.value else self.THRESHOLDS['temp_low_warning'],
            trend='down',
            metadata={
                'alert_level': stats.get('alert_level'),
                'current_avg': stats.get('current_avg'),
                'anomaly_subtype': 'low_temperature',
            }
        )

    def _check_range_anomaly(self, sensor_id: str, current_range: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查日温差异常"""
        if current_range >= self.THRESHOLDS['daily_range_critical']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 日温差严重超标"
            description = f"当前日温差 {current_range:.1f}C，超过严重阈值 {self.THRESHOLDS['daily_range_critical']}C"
        elif current_range >= self.THRESHOLDS['daily_range_warning']:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{sensor_id}] 日温差偏大"
            description = f"当前日温差 {current_range:.1f}C，超过警戒阈值 {self.THRESHOLDS['daily_range_warning']}C"
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
            current_value=current_range,
            threshold=self.THRESHOLDS['daily_range_critical'] if severity == SeverityLevel.HIGH.value else self.THRESHOLDS['daily_range_warning'],
            metadata={
                'current_max': stats.get('current_max'),
                'current_min': stats.get('current_min'),
                'avg_range': stats.get('avg_range'),
            }
        )

    def _check_rate_anomaly(self, sensor_id: str, trend_slope: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查温度变化率异常"""
        abs_rate = abs(trend_slope)

        if abs_rate >= self.THRESHOLDS['rate_change_critical']:
            severity = SeverityLevel.HIGH.value
            title = f"[{sensor_id}] 温度变化率严重超标"
            direction = "升温" if trend_slope > 0 else "降温"
            description = f"日均{direction}速率 {abs_rate:.2f}C/天，超过严重阈值 {self.THRESHOLDS['rate_change_critical']}C/天"
        elif abs_rate >= self.THRESHOLDS['rate_change_warning']:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{sensor_id}] 温度变化率偏高"
            direction = "升温" if trend_slope > 0 else "降温"
            description = f"日均{direction}速率 {abs_rate:.2f}C/天，超过警戒阈值 {self.THRESHOLDS['rate_change_warning']}C/天"
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
            current_value=trend_slope,
            threshold=self.THRESHOLDS['rate_change_critical'] if severity == SeverityLevel.HIGH.value else self.THRESHOLDS['rate_change_warning'],
            trend='up' if trend_slope > 0 else 'down',
            metadata={
                'r_squared': stats.get('r_squared'),
                'data_count': stats.get('data_count'),
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
        temp_ranges = []

        for sensor_id, stats in sensor_stats.items():
            trend_type = stats.get('trend_type', 'unknown')
            trend_distribution[trend_type] += 1

            alert_level = stats.get('alert_level', 'unknown')
            alert_distribution[alert_level] += 1

            if stats.get('current_avg') is not None:
                current_temps.append(stats['current_avg'])
            if stats.get('current_range') is not None:
                temp_ranges.append(stats['current_range'])

        avg_temp = sum(current_temps) / len(current_temps) if current_temps else None
        max_temp = max(current_temps) if current_temps else None
        min_temp = min(current_temps) if current_temps else None
        avg_range = sum(temp_ranges) / len(temp_ranges) if temp_ranges else None

        return {
            'total_sensors': len(sensor_stats),
            'anomaly_sensors': len(set(a.point_id for a in anomalies)),
            'trend_distribution': dict(trend_distribution),
            'alert_distribution': dict(alert_distribution),
            'current_avg_temperature': round(avg_temp, 1) if avg_temp else None,
            'current_max_temperature': round(max_temp, 1) if max_temp else None,
            'current_min_temperature': round(min_temp, 1) if min_temp else None,
            'avg_daily_range': round(avg_range, 1) if avg_range else None,
            'critical_count': len([a for a in anomalies if a.severity == SeverityLevel.CRITICAL.value]),
            'high_count': len([a for a in anomalies if a.severity == SeverityLevel.HIGH.value]),
        }
