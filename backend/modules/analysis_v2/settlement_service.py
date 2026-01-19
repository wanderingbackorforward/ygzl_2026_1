# -*- coding: utf-8 -*-
"""
沉降二级数据分析服务
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


class SettlementAnalysisService(BaseAnalysisService):
    """沉降分析服务 - 从原始数据实时计算"""

    # 阈值配置
    THRESHOLDS = {
        'daily_rate_critical': 0.15,     # 日沉降速率严重阈值 (mm/day)
        'daily_rate_high': 0.08,         # 日沉降速率高风险阈值
        'daily_rate_medium': 0.03,       # 日沉降速率中等阈值
        'cumulative_warning': -3.0,      # 累计沉降警戒值 (mm)
        'cumulative_alert': -5.0,        # 累计沉降报警值 (mm)
        'prediction_30d_warning': -3.0,  # 30天预测警戒值
        'prediction_30d_alert': -5.0,    # 30天预测报警值
    }

    def __init__(self):
        super().__init__('settlement')
        self._processed_data = None
        self._point_stats = None

    def _fetch_processed_data(self) -> List[Dict]:
        """获取处理后的沉降数据"""
        if self._processed_data is not None:
            return self._processed_data

        try:
            # 获取所有处理后的数据，按时间排序
            r = requests.get(
                _url('/rest/v1/processed_settlement_data?select=point_id,measurement_date,value,daily_change,cumulative_change&order=measurement_date.asc'),
                headers=_headers()
            )
            r.raise_for_status()
            self._processed_data = r.json()
            return self._processed_data
        except Exception as e:
            print(f"[SettlementAnalysisService] Fetch processed data failed: {e}")
            return []

    def _calculate_point_stats(self) -> Dict[str, Dict]:
        """从原始数据计算每个监测点的统计信息"""
        if self._point_stats is not None:
            return self._point_stats

        processed_data = self._fetch_processed_data()
        if not processed_data:
            return {}

        # 按监测点分组
        point_data = defaultdict(list)
        for record in processed_data:
            point_id = record.get('point_id')
            if point_id:
                point_data[point_id].append(record)

        self._point_stats = {}

        for point_id, records in point_data.items():
            if len(records) < 2:
                continue

            # 按时间排序
            records.sort(key=lambda x: x.get('measurement_date', ''))

            # 提取数值
            values = []
            dates = []
            daily_changes = []
            cumulative_changes = []

            for r in records:
                val = r.get('value')
                if val is not None:
                    values.append(float(val))
                    dates.append(r.get('measurement_date'))

                dc = r.get('daily_change')
                if dc is not None:
                    daily_changes.append(float(dc))

                cc = r.get('cumulative_change')
                if cc is not None:
                    cumulative_changes.append(float(cc))

            if len(values) < 2:
                continue

            # 计算基本统计
            min_val = min(values)
            max_val = max(values)
            avg_val = sum(values) / len(values)
            std_val = np.std(values) if len(values) > 1 else 0

            # 计算累计变化（相对于第一个值）
            initial_value = values[0]
            current_value = values[-1]
            total_change = current_value - initial_value

            # 计算日变化率（使用线性回归）
            if len(values) >= 3:
                x = np.arange(len(values))
                slope, intercept = np.polyfit(x, values, 1)

                # 计算R方
                y_pred = slope * x + intercept
                ss_res = np.sum((np.array(values) - y_pred) ** 2)
                ss_tot = np.sum((np.array(values) - avg_val) ** 2)
                r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

                # 预测30天后的值
                days_in_data = len(values)
                predicted_30d = slope * (days_in_data + 30) + intercept
                predicted_change_30d = predicted_30d - current_value
            else:
                slope = 0
                r_squared = 0
                predicted_30d = current_value
                predicted_change_30d = 0

            # 确定趋势类型
            if abs(slope) < 0.01:
                trend_type = "无显著趋势"
            elif slope < -0.05:
                trend_type = "显著下沉"
            elif slope < -0.01:
                trend_type = "轻微下沉"
            elif slope > 0.05:
                trend_type = "显著隆起"
            elif slope > 0.01:
                trend_type = "轻微隆起"
            else:
                trend_type = "轻微变化"

            # 确定告警级别
            if total_change <= self.THRESHOLDS['cumulative_alert']:
                alert_level = "alert"
            elif total_change <= self.THRESHOLDS['cumulative_warning']:
                alert_level = "warning"
            elif abs(slope) >= self.THRESHOLDS['daily_rate_high']:
                alert_level = "warning"
            else:
                alert_level = "normal"

            # 计算最大日变化率
            max_daily_rate = max(abs(dc) for dc in daily_changes) if daily_changes else 0

            self._point_stats[point_id] = {
                'point_id': point_id,
                'min_value': min_val,
                'max_value': max_val,
                'avg_value': avg_val,
                'std_deviation': std_val,
                'trend_slope': slope,
                'r_squared': r_squared,
                'trend_type': trend_type,
                'total_change': total_change,
                'cumulative_change': total_change,  # 累计沉降量
                'avg_daily_rate': slope,
                'max_daily_rate': max_daily_rate,
                'alert_level': alert_level,
                'predicted_value_30d': predicted_30d,
                'predicted_change_30d': predicted_change_30d,
                'data_count': len(values),
                'last_value': current_value,
                'first_date': dates[0] if dates else None,
                'last_date': dates[-1] if dates else None,
            }

        return self._point_stats

    def analyze(self) -> AnalysisResult:
        """执行完整分析 - 从原始数据实时计算"""
        point_stats = self._calculate_point_stats()

        # 检测异常
        anomalies = self.detect_anomalies()

        # 生成建议
        recommendations = self.generate_recommendations(anomalies)

        # 计算统计
        stats = self._calculate_stats(anomalies, len(point_stats))

        # 构建汇总信息
        summary = self._build_summary(point_stats, anomalies)

        return AnalysisResult(
            data_type=self.data_type,
            analysis_time=self._get_current_time(),
            stats=stats,
            anomalies=anomalies,
            recommendations=recommendations,
            summary=summary,
            metadata={
                'thresholds': self.THRESHOLDS,
                'data_source': 'processed_settlement_data',
                'calculation_method': 'realtime',
            }
        )

    def detect_anomalies(self) -> List[AnomalyItem]:
        """从原始数据检测所有类型的异常"""
        anomalies = []
        point_stats = self._calculate_point_stats()

        for point_id, stats in point_stats.items():
            trend_slope = stats.get('trend_slope', 0)
            total_change = stats.get('total_change', 0)
            predicted_value_30d = stats.get('predicted_value_30d')
            predicted_change_30d = stats.get('predicted_change_30d')
            trend_type = stats.get('trend_type', '')

            # 1. 检测日沉降速率异常
            rate_anomaly = self._check_rate_anomaly(point_id, trend_slope, stats)
            if rate_anomaly:
                anomalies.append(rate_anomaly)

            # 2. 检测累计沉降异常
            cumulative_anomaly = self._check_cumulative_anomaly(point_id, total_change, stats)
            if cumulative_anomaly:
                anomalies.append(cumulative_anomaly)

            # 3. 检测预测预警
            if predicted_value_30d is not None:
                # 预测值需要考虑当前值+预测变化
                future_cumulative = total_change + (predicted_change_30d or 0)
                prediction_anomaly = self._check_prediction_anomaly(
                    point_id, future_cumulative, predicted_change_30d, stats
                )
                if prediction_anomaly:
                    anomalies.append(prediction_anomaly)

            # 4. 检测趋势异常
            if trend_type and '显著' in trend_type:
                trend_anomaly = self._check_trend_anomaly(point_id, trend_type, trend_slope, stats)
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

    def _check_rate_anomaly(self, point_id: str, trend_slope: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查沉降速率异常"""
        abs_rate = abs(trend_slope)

        if abs_rate >= self.THRESHOLDS['daily_rate_critical']:
            severity = SeverityLevel.CRITICAL.value
            title = f"[{point_id}] 沉降速率严重超标"
            description = f"日沉降速率 {trend_slope:.4f} mm/day，超过严重阈值 {self.THRESHOLDS['daily_rate_critical']} mm/day"
        elif abs_rate >= self.THRESHOLDS['daily_rate_high']:
            severity = SeverityLevel.HIGH.value
            title = f"[{point_id}] 沉降速率偏高"
            description = f"日沉降速率 {trend_slope:.4f} mm/day，超过高风险阈值 {self.THRESHOLDS['daily_rate_high']} mm/day"
        elif abs_rate >= self.THRESHOLDS['daily_rate_medium']:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{point_id}] 沉降速率需关注"
            description = f"日沉降速率 {trend_slope:.4f} mm/day，超过中等阈值 {self.THRESHOLDS['daily_rate_medium']} mm/day"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('rate'),
            point_id=point_id,
            anomaly_type=AnomalyType.RATE_ABNORMAL.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            current_value=trend_slope,
            threshold=self.THRESHOLDS['daily_rate_critical'] if severity == SeverityLevel.CRITICAL.value else self.THRESHOLDS['daily_rate_high'],
            deviation=abs_rate,
            trend='down' if trend_slope < 0 else 'up',
            metadata={
                'alert_level': stats.get('alert_level'),
                'trend_type': stats.get('trend_type'),
                'r_squared': stats.get('r_squared'),
                'data_count': stats.get('data_count'),
            }
        )

    def _check_cumulative_anomaly(self, point_id: str, total_change: float, stats: Dict) -> Optional[AnomalyItem]:
        """检查累计沉降异常"""
        if total_change <= self.THRESHOLDS['cumulative_alert']:
            severity = SeverityLevel.CRITICAL.value
            title = f"[{point_id}] 累计沉降超过报警值"
            description = f"累计沉降已达 {total_change:.2f} mm，超过报警阈值 {self.THRESHOLDS['cumulative_alert']} mm"
        elif total_change <= self.THRESHOLDS['cumulative_warning']:
            severity = SeverityLevel.HIGH.value
            title = f"[{point_id}] 累计沉降超过警戒值"
            description = f"累计沉降已达 {total_change:.2f} mm，超过警戒阈值 {self.THRESHOLDS['cumulative_warning']} mm"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('cum'),
            point_id=point_id,
            anomaly_type=AnomalyType.THRESHOLD_EXCEEDED.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            current_value=total_change,
            threshold=self.THRESHOLDS['cumulative_alert'] if severity == SeverityLevel.CRITICAL.value else self.THRESHOLDS['cumulative_warning'],
            metadata={
                'max_value': stats.get('max_value'),
                'avg_value': stats.get('avg_value'),
                'last_value': stats.get('last_value'),
                'data_count': stats.get('data_count'),
            }
        )

    def _check_prediction_anomaly(self, point_id: str, future_cumulative: float, predicted_change: Optional[float], stats: Dict) -> Optional[AnomalyItem]:
        """检查预测预警"""
        if future_cumulative <= self.THRESHOLDS['prediction_30d_alert']:
            severity = SeverityLevel.HIGH.value
            title = f"[{point_id}] 30天预测超过报警值"
            description = f"30天后预测累计沉降 {future_cumulative:.2f} mm，将超过报警阈值"
        elif future_cumulative <= self.THRESHOLDS['prediction_30d_warning']:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{point_id}] 30天预测超过警戒值"
            description = f"30天后预测累计沉降 {future_cumulative:.2f} mm，将超过警戒阈值"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('pred'),
            point_id=point_id,
            anomaly_type=AnomalyType.PREDICTION_WARNING.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            current_value=future_cumulative,
            threshold=self.THRESHOLDS['prediction_30d_alert'] if severity == SeverityLevel.HIGH.value else self.THRESHOLDS['prediction_30d_warning'],
            metadata={
                'predicted_change_30d': predicted_change,
                'trend_slope': stats.get('trend_slope'),
                'current_cumulative': stats.get('total_change'),
            }
        )

    def _check_trend_anomaly(self, point_id: str, trend_type: str, trend_slope: Optional[float], stats: Dict) -> Optional[AnomalyItem]:
        """检查趋势异常"""
        if '显著下沉' in trend_type:
            severity = SeverityLevel.MEDIUM.value
            title = f"[{point_id}] 检测到显著下沉趋势"
            description = f"监测点呈现{trend_type}，日沉降速率 {trend_slope:.4f} mm/day" if trend_slope else f"监测点呈现{trend_type}"
        elif '显著隆起' in trend_type:
            severity = SeverityLevel.LOW.value
            title = f"[{point_id}] 检测到显著隆起趋势"
            description = f"监测点呈现{trend_type}，需关注异常隆起原因"
        else:
            return None

        return AnomalyItem(
            id=self._generate_id('trend'),
            point_id=point_id,
            anomaly_type=AnomalyType.TREND_ABNORMAL.value,
            severity=severity,
            title=title,
            description=description,
            detected_at=self._get_current_time(),
            trend='down' if '下沉' in trend_type else 'up',
            metadata={
                'trend_type': trend_type,
                'r_squared': stats.get('r_squared'),
                'data_count': stats.get('data_count'),
            }
        )

    def generate_recommendations(self, anomalies: List[AnomalyItem]) -> List[Recommendation]:
        """基于异常生成处置建议"""
        recommendations = []

        # 统计各严重程度的异常
        critical_anomalies = [a for a in anomalies if a.severity == SeverityLevel.CRITICAL.value]
        high_anomalies = [a for a in anomalies if a.severity == SeverityLevel.HIGH.value]
        medium_anomalies = [a for a in anomalies if a.severity == SeverityLevel.MEDIUM.value]

        # 1. 严重异常建议
        if critical_anomalies:
            critical_points = list(set(a.point_id for a in critical_anomalies))
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.URGENT.value,
                title="紧急现场检查",
                description=f"发现 {len(critical_anomalies)} 个严重异常，涉及监测点: {', '.join(critical_points[:5])}{'...' if len(critical_points) > 5 else ''}。建议立即安排现场检查，评估结构安全。",
                action_type="inspect",
                target_points=critical_points,
                estimated_urgency="24小时内",
                reference_anomalies=[a.id for a in critical_anomalies],
            ))

        # 2. 高风险异常建议
        if high_anomalies:
            high_points = list(set(a.point_id for a in high_anomalies))
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.HIGH.value,
                title="增加监测频率",
                description=f"发现 {len(high_anomalies)} 个高风险异常，建议对相关监测点增加监测频率，密切关注变化趋势。",
                action_type="monitor",
                target_points=high_points,
                estimated_urgency="3天内",
                reference_anomalies=[a.id for a in high_anomalies],
            ))

        # 3. 预测预警建议
        prediction_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.PREDICTION_WARNING.value]
        if prediction_anomalies:
            pred_points = list(set(a.point_id for a in prediction_anomalies))
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.MEDIUM.value,
                title="制定预防措施",
                description=f"根据趋势预测，{len(pred_points)} 个监测点可能在30天内超过阈值。建议提前制定预防和应对措施。",
                action_type="report",
                target_points=pred_points,
                reference_anomalies=[a.id for a in prediction_anomalies],
            ))

        # 4. 中等风险建议
        if medium_anomalies and not critical_anomalies and not high_anomalies:
            medium_points = list(set(a.point_id for a in medium_anomalies))
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.LOW.value,
                title="持续监控",
                description=f"发现 {len(medium_anomalies)} 个中等风险异常，建议保持当前监测频率并持续关注。",
                action_type="monitor",
                target_points=medium_points,
                reference_anomalies=[a.id for a in medium_anomalies],
            ))

        # 5. 无异常时的建议
        if not anomalies:
            recommendations.append(Recommendation(
                id=self._generate_id('rec'),
                priority=RecommendationPriority.LOW.value,
                title="维持常规监测",
                description="当前所有监测点指标正常，建议继续保持常规监测频率。",
                action_type="monitor",
                target_points=[],
            ))

        return recommendations

    def _build_summary(self, point_stats: Dict[str, Dict], anomalies: List[AnomalyItem]) -> Dict[str, Any]:
        """构建汇总信息"""
        if not point_stats:
            return {}

        # 统计趋势分布
        trend_distribution = defaultdict(int)
        alert_distribution = defaultdict(int)

        slopes = []
        total_changes = []

        for point_id, stats in point_stats.items():
            trend_type = stats.get('trend_type', 'unknown')
            trend_distribution[trend_type] += 1

            alert_level = stats.get('alert_level', 'unknown')
            alert_distribution[alert_level] += 1

            if stats.get('trend_slope') is not None:
                slopes.append(stats['trend_slope'])
            if stats.get('total_change') is not None:
                total_changes.append(stats['total_change'])

        avg_slope = sum(slopes) / len(slopes) if slopes else 0
        max_settlement = min(total_changes) if total_changes else 0

        return {
            'total_points': len(point_stats),
            'anomaly_points': len(set(a.point_id for a in anomalies)),
            'trend_distribution': dict(trend_distribution),
            'alert_distribution': dict(alert_distribution),
            'avg_daily_rate': round(avg_slope, 4),
            'max_cumulative_settlement': round(max_settlement, 2),
            'critical_count': len([a for a in anomalies if a.severity == SeverityLevel.CRITICAL.value]),
            'high_count': len([a for a in anomalies if a.severity == SeverityLevel.HIGH.value]),
        }
