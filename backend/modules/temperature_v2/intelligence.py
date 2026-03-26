# -*- coding: utf-8 -*-
"""
温度智能统一能力层
"""

import re
from collections import defaultdict, deque
from datetime import datetime

from modules.db.vendor import get_repo

from .algorithms import TemperatureAlgorithms
from .construction_guide import ConstructionGuide


class TemperatureIntelligenceService:
    BASE_THRESHOLDS = {
        'temp_high_critical': 45.0,
        'temp_high_warning': 38.0,
        'temp_low_critical': -10.0,
        'temp_low_warning': 0.0,
        'daily_range_critical': 25.0,
        'daily_range_warning': 18.0,
        'rate_change_critical': 5.0,
        'rate_change_warning': 3.0,
        'gradient_critical': 2.5,
        'gradient_warning': 1.5,
        'freeze_thaw_annual_critical': 40.0,
        'freeze_thaw_annual_warning': 18.0,
        'risk_critical': 75.0,
        'risk_warning': 55.0,
        'risk_watch': 30.0,
    }

    FEEDBACK_LOG = deque(maxlen=200)
    ADAPTIVE_OFFSETS = defaultdict(float)

    def __init__(self, repo=None, algorithms=None, guide=None, analysis_service=None):
        self.repo = repo or get_repo()
        self.algorithms = algorithms or TemperatureAlgorithms()
        self.guide = guide or ConstructionGuide()
        self.analysis_service = analysis_service
        self.thresholds = self._build_thresholds()

    def _build_thresholds(self):
        thresholds = dict(self.BASE_THRESHOLDS)
        if self.analysis_service is None:
            try:
                from modules.analysis_v2.temperature_service import TemperatureAnalysisService
                self.analysis_service = TemperatureAnalysisService()
            except Exception:
                self.analysis_service = None
        if self.analysis_service is not None:
            loaded = getattr(self.analysis_service, '_thresholds', None)
            if isinstance(loaded, dict):
                thresholds.update(loaded)
        for key, delta in self.ADAPTIVE_OFFSETS.items():
            if key in thresholds:
                thresholds[key] = float(thresholds[key]) + float(delta)
        return thresholds

    @staticmethod
    def _to_float(value, default=None):
        try:
            if value is None or value == '':
                return default
            return float(value)
        except Exception:
            return default

    @staticmethod
    def _date_text(value):
        if value is None:
            return None
        return str(value).split('T')[0]

    @staticmethod
    def _severity_weight(level):
        return {
            'normal': 0,
            'watch': 20,
            'low': 30,
            'medium': 50,
            'warning': 65,
            'high': 80,
            'critical': 100,
            'severe': 100,
        }.get(str(level or '').lower(), 0)

    def _quality_score(self, series):
        count = len(series)
        if count <= 0:
            return 0.0
        dated = [row for row in series if row.get('measurement_date')]
        range_ready = [
            row for row in series
            if row.get('avg_temperature') is not None
            and row.get('max_temperature') is not None
            and row.get('min_temperature') is not None
        ]
        coverage = len(dated) / count
        completeness = len(range_ready) / count
        depth = min(count / 14.0, 1.0)
        return round(max(0.0, min(1.0, coverage * 0.35 + completeness * 0.35 + depth * 0.30)), 3)

    def _normalize_series(self, sensor_id, data):
        rows = data.get('timeSeriesData', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
        normalized = []
        for row in rows:
            measurement_date = self._date_text(row.get('measurement_date'))
            avg_temperature = self._to_float(row.get('avg_temperature', row.get('avg_temp')))
            max_temperature = self._to_float(row.get('max_temperature', row.get('max_temp')))
            min_temperature = self._to_float(row.get('min_temperature', row.get('min_temp')))
            temperature_range = row.get('temperature_range')
            if temperature_range is None and max_temperature is not None and min_temperature is not None:
                temperature_range = max_temperature - min_temperature
            temperature_range = self._to_float(temperature_range)
            normalized.append({
                'sensor_id': str(row.get('sensor_id') or row.get('SID') or sensor_id or ''),
                'measurement_date': measurement_date,
                'avg_temperature': avg_temperature,
                'max_temperature': max_temperature,
                'min_temperature': min_temperature,
                'temperature_range': temperature_range,
            })
        normalized.sort(key=lambda item: item.get('measurement_date') or '')
        return normalized

    def _normalize_sensor_row(self, row, points_map):
        sensor_id = str(row.get('sensor_id') or row.get('SID') or '')
        point = points_map.get(sensor_id, {})
        avg_temperature = self._to_float(row.get('avg_temperature', row.get('avg_temp')))
        max_temperature = self._to_float(row.get('max_temperature', row.get('max_temp')))
        min_temperature = self._to_float(row.get('min_temperature', row.get('min_temp')))
        daily_range = row.get('temperature_range')
        if daily_range is None and max_temperature is not None and min_temperature is not None:
            daily_range = max_temperature - min_temperature
        return {
            'sensor_id': sensor_id,
            'sensor_name': point.get('point_name') or row.get('sensor_name') or sensor_id,
            'avg_temperature': avg_temperature,
            'max_temperature': max_temperature,
            'min_temperature': min_temperature,
            'daily_range': self._to_float(daily_range),
            'trend_type': row.get('trend_type'),
            'alert_level': row.get('alert_level') or 'normal',
            'depth': self._to_float(row.get('depth', point.get('z_coord')), 0.0) or 0.0,
            'x_coord': self._to_float(point.get('x_coord')),
            'y_coord': self._to_float(point.get('y_coord')),
            'z_coord': self._to_float(point.get('z_coord')),
            'status': point.get('status') or 'active',
            'last_updated': row.get('last_updated'),
        }

    def _points_map(self):
        try:
            points = self.repo.temperature_get_points()
        except Exception:
            points = []
        result = {}
        for point in points or []:
            key = str(point.get('point_id') or point.get('sensor_id') or '')
            if key:
                result[key] = point
        return result

    def _sensor_inventory(self):
        points_map = self._points_map()
        try:
            summary = self.repo.temperature_get_summary()
        except Exception:
            summary = []
        sensors = []
        for row in summary or []:
            normalized = self._normalize_sensor_row(row, points_map)
            if normalized.get('sensor_id'):
                sensors.append(normalized)
        sensors.sort(key=lambda item: item.get('sensor_id') or '')
        return sensors

    def _sensor_series(self, sensor_id):
        try:
            data = self.repo.temperature_get_data(sensor_id)
        except Exception:
            data = {}
        return self._normalize_series(sensor_id, data)

    def _series_arrays(self, series):
        dates = []
        avg_vals = []
        max_vals = []
        min_vals = []
        for row in series:
            measurement_date = row.get('measurement_date')
            if not measurement_date:
                continue
            avg_temperature = row.get('avg_temperature')
            max_temperature = row.get('max_temperature')
            min_temperature = row.get('min_temperature')
            if avg_temperature is not None and max_temperature is not None and min_temperature is not None:
                dates.append(measurement_date)
                avg_vals.append(avg_temperature)
                max_vals.append(max_temperature)
                min_vals.append(min_temperature)
        return dates, avg_vals, max_vals, min_vals

    def _gradient_result(self, sensors):
        sensor_data = {}
        for sensor in sensors:
            sid = sensor.get('sensor_id')
            if not sid:
                continue
            sensor_data[sid] = {
                'current_temp': sensor.get('avg_temperature'),
                'depth': sensor.get('depth', 0),
            }
        return self.algorithms.temperature_gradient(sensor_data)

    def _freeze_thaw_summary(self, sensors, limit=20):
        total_cycles = 0
        affected = 0
        inspected = 0
        for sensor in sensors[:limit]:
            series = self._sensor_series(sensor.get('sensor_id'))
            dates, _, _, min_vals = self._series_arrays(series)
            if len(dates) < 3 or len(min_vals) < 3:
                continue
            result = self.algorithms.freeze_thaw_cycles(dates, min_vals)
            if result.get('success'):
                inspected += 1
                cycles = int(result.get('total_cycles', 0))
                total_cycles += cycles
                if cycles > 0:
                    affected += 1
        return {
            'sensor_samples': inspected,
            'freeze_thaw_sensor_count': affected,
            'freeze_thaw_cycle_total': total_cycles,
        }

    def get_snapshot(self, sensor_id=None):
        sensors = self._sensor_inventory()
        if sensor_id:
            sensors = [item for item in sensors if item.get('sensor_id') == sensor_id]
        try:
            raw_stats = self.repo.temperature_get_stats()
        except Exception:
            raw_stats = {}
        current_temperature = raw_stats.get('current_temperature', {}) if isinstance(raw_stats, dict) else {}
        trends = raw_stats.get('trends', {}) if isinstance(raw_stats, dict) else {}
        alerts = raw_stats.get('alerts', {}) if isinstance(raw_stats, dict) else {}
        current_avg = self._to_float(current_temperature.get('avg'))
        current_max = self._to_float(current_temperature.get('max'))
        current_min = self._to_float(current_temperature.get('min'))
        avg_range = None
        if current_max is not None and current_min is not None:
            avg_range = round(current_max - current_min, 2)
        dominant_trend = max(trends, key=trends.get) if trends else None
        freeze_summary = self._freeze_thaw_summary(sensors if sensors else self._sensor_inventory())
        overview = {
            'current_avg': current_avg,
            'current_max': current_max,
            'current_min': current_min,
            'avg_range': avg_range,
            'sensor_count': len(sensors),
            'date_range': current_temperature.get('date_range'),
            'dominant_trend': dominant_trend,
            'alerts': alerts,
            'trends': trends,
        }
        overview.update(freeze_summary)
        return {
            'success': True,
            'sensor_id': sensor_id,
            'overview': overview,
            'sensors': sensors,
            'thresholds': {k: round(v, 3) for k, v in self.thresholds.items()},
        }

    def _build_event(self, sensor_id, event_type, severity, title, description, confidence, evidence=None, metadata=None):
        event_time = datetime.now().isoformat()
        date_text = ''
        if isinstance(evidence, dict):
            date_text = evidence.get('measurement_date') or evidence.get('date') or ''
        event_id = f"{sensor_id or 'global'}:{event_type}:{date_text or event_time}"
        return {
            'id': event_id,
            'sensor_id': sensor_id,
            'event_type': event_type,
            'severity': severity,
            'title': title,
            'description': description,
            'confidence': round(float(confidence or 0), 3),
            'detected_at': event_time,
            'evidence': evidence or {},
            'metadata': metadata or {},
        }

    def _recent_rate_per_day(self, series):
        if len(series) < 2:
            return None
        prev = series[-2]
        curr = series[-1]
        prev_date = prev.get('measurement_date')
        curr_date = curr.get('measurement_date')
        prev_val = prev.get('avg_temperature')
        curr_val = curr.get('avg_temperature')
        if not prev_date or not curr_date or prev_val is None or curr_val is None:
            return None
        try:
            dt_prev = datetime.strptime(prev_date, '%Y-%m-%d')
            dt_curr = datetime.strptime(curr_date, '%Y-%m-%d')
        except Exception:
            return None
        span = max((dt_curr - dt_prev).days, 1)
        return round((curr_val - prev_val) / span, 3)

    def _extreme_events(self, sensor, series, quality_score):
        events = []
        latest = series[-1] if series else {}
        current_max = latest.get('max_temperature')
        current_min = latest.get('min_temperature')
        daily_range = latest.get('temperature_range')
        sensor_id = sensor.get('sensor_id')
        if current_max is not None:
            if current_max >= self.thresholds['temp_high_critical']:
                events.append(self._build_event(
                    sensor_id, 'extreme_high', 'critical',
                    '高温超限',
                    f'最新最高温 {current_max:.1f}°C，已超过严重阈值 {self.thresholds["temp_high_critical"]:.1f}°C',
                    quality_score, latest,
                ))
            elif current_max >= self.thresholds['temp_high_warning']:
                events.append(self._build_event(
                    sensor_id, 'extreme_high', 'warning',
                    '高温预警',
                    f'最新最高温 {current_max:.1f}°C，已超过预警阈值 {self.thresholds["temp_high_warning"]:.1f}°C',
                    quality_score, latest,
                ))
        if current_min is not None:
            if current_min <= self.thresholds['temp_low_critical']:
                events.append(self._build_event(
                    sensor_id, 'extreme_low', 'critical',
                    '低温超限',
                    f'最新最低温 {current_min:.1f}°C，已低于严重阈值 {self.thresholds["temp_low_critical"]:.1f}°C',
                    quality_score, latest,
                ))
            elif current_min <= self.thresholds['temp_low_warning']:
                events.append(self._build_event(
                    sensor_id, 'extreme_low', 'warning',
                    '低温预警',
                    f'最新最低温 {current_min:.1f}°C，已低于预警阈值 {self.thresholds["temp_low_warning"]:.1f}°C',
                    quality_score, latest,
                ))
        if daily_range is not None:
            if daily_range >= self.thresholds['daily_range_critical']:
                events.append(self._build_event(
                    sensor_id, 'wide_daily_range', 'critical',
                    '日温差过大',
                    f'最新日温差 {daily_range:.1f}°C，超过严重阈值 {self.thresholds["daily_range_critical"]:.1f}°C',
                    quality_score, latest,
                ))
            elif daily_range >= self.thresholds['daily_range_warning']:
                events.append(self._build_event(
                    sensor_id, 'wide_daily_range', 'warning',
                    '日温差预警',
                    f'最新日温差 {daily_range:.1f}°C，超过预警阈值 {self.thresholds["daily_range_warning"]:.1f}°C',
                    quality_score, latest,
                ))
        return events

    def _change_events(self, sensor, series, quality_score):
        events = []
        sensor_id = sensor.get('sensor_id')
        rate = self._recent_rate_per_day(series)
        latest = series[-1] if series else {}
        if rate is not None:
            abs_rate = abs(rate)
            if abs_rate >= self.thresholds['rate_change_critical']:
                events.append(self._build_event(
                    sensor_id, 'rapid_change', 'critical',
                    '温度突变',
                    f'最近变化率 {rate:.2f}°C/天，超过严重阈值 {self.thresholds["rate_change_critical"]:.2f}°C/天',
                    quality_score, {'measurement_date': latest.get('measurement_date'), 'rate_per_day': rate},
                ))
            elif abs_rate >= self.thresholds['rate_change_warning']:
                events.append(self._build_event(
                    sensor_id, 'rapid_change', 'warning',
                    '温度快速变化',
                    f'最近变化率 {rate:.2f}°C/天，超过预警阈值 {self.thresholds["rate_change_warning"]:.2f}°C/天',
                    quality_score, {'measurement_date': latest.get('measurement_date'), 'rate_per_day': rate},
                ))
        dates, avg_vals, _, min_vals = self._series_arrays(series)
        if len(dates) >= 10 and len(avg_vals) >= 10:
            baseline_days = min(30, max(5, len(avg_vals) // 2))
            result = self.algorithms.cusum_detection(dates, avg_vals, baseline_days=baseline_days)
            if result.get('success') and result.get('change_points'):
                latest_change = result['change_points'][-1]
                events.append(self._build_event(
                    sensor_id, 'trend_shift',
                    'warning' if result.get('current_status', 'normal').startswith('warning') else 'medium',
                    '温度均值发生偏移',
                    latest_change.get('description') or 'CUSUM 检测到温度基线发生变化',
                    quality_score, latest_change,
                ))
        if len(dates) >= 3 and len(min_vals) >= 3:
            freeze = self.algorithms.freeze_thaw_cycles(dates, min_vals)
            if freeze.get('success'):
                annual_rate = self._to_float(freeze.get('annual_rate'), 0.0) or 0.0
                if annual_rate >= self.thresholds['freeze_thaw_annual_critical']:
                    events.append(self._build_event(
                        sensor_id, 'freeze_thaw', 'critical',
                        '冻融风险严重',
                        f'年化冻融频率 {annual_rate:.1f} 次/年，属于高危冻融工况',
                        quality_score, freeze,
                    ))
                elif annual_rate >= self.thresholds['freeze_thaw_annual_warning']:
                    events.append(self._build_event(
                        sensor_id, 'freeze_thaw', 'warning',
                        '冻融风险预警',
                        f'年化冻融频率 {annual_rate:.1f} 次/年，建议加强保温与排水',
                        quality_score, freeze,
                    ))
        return events

    def _gradient_events(self, sensors):
        result = self._gradient_result(sensors)
        if not result.get('success'):
            return []
        max_gradient = self._to_float(result.get('max_gradient'), 0.0) or 0.0
        if max_gradient < self.thresholds['gradient_warning']:
            return []
        pair = result.get('max_pair') or {}
        severity = 'critical' if max_gradient >= self.thresholds['gradient_critical'] else 'warning'
        target_sensor = pair.get('sensor_a') or pair.get('sensor_b')
        return [self._build_event(
            target_sensor, 'abnormal_gradient', severity,
            '空间温度梯度异常',
            f'最大温度梯度 {max_gradient:.2f}°C/m，重点关注 {pair.get("sensor_a")} 与 {pair.get("sensor_b")} 的温差响应',
            0.9, pair, {'risk_summary': result.get('risk_summary', {})},
        )]

    def _candidate_settlement_points(self, sensor_id, related_point_ids=None):
        if related_point_ids:
            if isinstance(related_point_ids, str):
                return [related_point_ids]
            return [str(item) for item in related_point_ids if item]
        try:
            points = self.repo.get_all_points()
        except Exception:
            points = []
        sensor_digits = ''.join(re.findall(r'\d+', str(sensor_id or '')))
        if not sensor_digits:
            return []
        matched = []
        for point in points or []:
            point_id = str(point.get('point_id') or '')
            point_digits = ''.join(re.findall(r'\d+', point_id))
            if point_digits and point_digits == sensor_digits:
                matched.append(point_id)
        return matched[:3]

    def _coupling_events(self, sensor, series, related_point_ids=None):
        dates, avg_vals, _, _ = self._series_arrays(series)
        if len(dates) < 10 or len(avg_vals) < 10:
            return []
        events = []
        for point_id in self._candidate_settlement_points(sensor.get('sensor_id'), related_point_ids):
            try:
                detail = self.repo.get_point_detail(point_id)
            except Exception:
                detail = {}
            settlement_series = detail.get('timeSeriesData', []) if isinstance(detail, dict) else []
            settle_dates = []
            settle_values = []
            for row in settlement_series:
                measurement_date = self._date_text(row.get('measurement_date'))
                value = self._to_float(row.get('cumulative_change'))
                if measurement_date and value is not None:
                    settle_dates.append(measurement_date)
                    settle_values.append(value)
            if len(settle_dates) < 10:
                continue
            result = self.algorithms.temp_settlement_correlation(dates, avg_vals, settle_dates, settle_values)
            if not result.get('success'):
                continue
            correlation = abs(self._to_float(result.get('correlation'), 0.0) or 0.0)
            if correlation < 0.45:
                continue
            severity = 'critical' if correlation >= 0.75 else 'warning'
            events.append(self._build_event(
                sensor.get('sensor_id'), 'temp_settlement_coupling', severity,
                '温度-沉降耦合增强',
                f'与沉降点 {point_id} 的相关系数为 {result.get("correlation"):.2f}，{result.get("interpretation")}',
                self._quality_score(series), result, {'related_point_id': point_id},
            ))
        return events

    def detect_events(self, sensor_id=None, related_point_ids=None):
        sensors = self._sensor_inventory()
        if sensor_id:
            sensors = [item for item in sensors if item.get('sensor_id') == sensor_id]
        events = []
        for sensor in sensors:
            series = self._sensor_series(sensor.get('sensor_id'))
            quality_score = self._quality_score(series)
            events.extend(self._extreme_events(sensor, series, quality_score))
            events.extend(self._change_events(sensor, series, quality_score))
            events.extend(self._coupling_events(sensor, series, related_point_ids=related_point_ids))
            if quality_score < 0.45:
                events.append(self._build_event(
                    sensor.get('sensor_id'), 'data_quality', 'medium',
                    '数据质量不足',
                    f'当前质量分 {quality_score:.2f}，建议先复核传感器与补齐缺测数据',
                    quality_score, {'quality_score': quality_score},
                ))
        events.extend(self._gradient_events(sensors))
        events.sort(key=lambda item: (self._severity_weight(item.get('severity')), item.get('confidence', 0)), reverse=True)
        return {
            'success': True,
            'sensor_id': sensor_id,
            'count': len(events),
            'events': events,
        }

    def _construction_assessment(self, sensor):
        current_avg = sensor.get('avg_temperature')
        current_min = sensor.get('min_temperature')
        daily_range = sensor.get('daily_range')
        conditions = {
            'ambient_temp': current_avg,
            'ground_temp': current_min,
            'daily_range': daily_range,
        }
        if all(value is None for value in conditions.values()):
            return None
        return self.guide.full_assessment(conditions)

    def _score_from_snapshot(self, sensor):
        if not sensor:
            return 0.0
        scores = []
        current_max = sensor.get('max_temperature')
        current_min = sensor.get('min_temperature')
        daily_range = sensor.get('daily_range')
        if current_max is not None:
            if current_max >= self.thresholds['temp_high_critical']:
                scores.append(100.0)
            elif current_max >= self.thresholds['temp_high_warning']:
                scores.append(75.0)
        if current_min is not None:
            if current_min <= self.thresholds['temp_low_critical']:
                scores.append(100.0)
            elif current_min <= self.thresholds['temp_low_warning']:
                scores.append(75.0)
        if daily_range is not None:
            if daily_range >= self.thresholds['daily_range_critical']:
                scores.append(90.0)
            elif daily_range >= self.thresholds['daily_range_warning']:
                scores.append(65.0)
        return max(scores) if scores else 0.0

    def _risk_level(self, score):
        if score >= self.thresholds['risk_critical']:
            return 'critical'
        if score >= self.thresholds['risk_warning']:
            return 'warning'
        if score >= self.thresholds['risk_watch']:
            return 'watch'
        return 'normal'

    def evaluate_risk(self, sensor_id=None, related_point_ids=None):
        snapshot = self.get_snapshot(sensor_id=sensor_id)
        events_result = self.detect_events(sensor_id=sensor_id, related_point_ids=related_point_ids)
        sensors = snapshot.get('sensors', [])
        events = events_result.get('events', [])
        grouped_events = defaultdict(list)
        for event in events:
            grouped_events[event.get('sensor_id')].append(event)
        risk_items = []
        for sensor in sensors:
            sensor_events = grouped_events.get(sensor.get('sensor_id'), [])
            quality_score = self._quality_score(self._sensor_series(sensor.get('sensor_id')))
            level_score = self._score_from_snapshot(sensor)
            change_score = 0.0
            coupling_score = 0.0
            for event in sensor_events:
                weight = self._severity_weight(event.get('severity'))
                if event.get('event_type') == 'temp_settlement_coupling':
                    coupling_score = max(coupling_score, weight)
                elif event.get('event_type') != 'data_quality':
                    change_score = max(change_score, weight)
            assessment = self._construction_assessment(sensor)
            construction_score = {
                'red': 85.0,
                'yellow': 45.0,
                'green': 0.0,
            }.get((assessment or {}).get('overall_status'), 0.0)
            raw_score = 0.35 * level_score + 0.25 * change_score + 0.30 * coupling_score + 0.10 * construction_score
            risk_score = round(raw_score * (0.6 + 0.4 * quality_score), 1)
            risk_level = self._risk_level(risk_score)
            drivers = [event.get('title') for event in sensor_events[:4]]
            risk_items.append({
                'sensor_id': sensor.get('sensor_id'),
                'risk_score': risk_score,
                'risk_level': risk_level,
                'quality_score': quality_score,
                'level_score': round(level_score, 1),
                'change_score': round(change_score, 1),
                'coupling_score': round(coupling_score, 1),
                'construction_score': round(construction_score, 1),
                'drivers': drivers,
                'construction_assessment': assessment,
                'latest_snapshot': sensor,
                'events': sensor_events,
            })
        risk_items.sort(key=lambda item: item.get('risk_score', 0), reverse=True)
        return {
            'success': True,
            'sensor_id': sensor_id,
            'count': len(risk_items),
            'items': risk_items,
        }

    def plan_actions(self, sensor_id=None, related_point_ids=None):
        risk_result = self.evaluate_risk(sensor_id=sensor_id, related_point_ids=related_point_ids)
        planned = []
        for item in risk_result.get('items', []):
            actions = []
            risk_level = item.get('risk_level')
            sensor = item.get('latest_snapshot', {})
            if risk_level == 'critical':
                actions.append({
                    'priority': 'urgent',
                    'action_type': 'create_ticket',
                    'title': '创建温度异常工单',
                    'reason': f'{sensor.get("sensor_id")} 风险分 {item.get("risk_score")}，需立即闭环处理',
                })
                actions.append({
                    'priority': 'high',
                    'action_type': 'inspect_sensor',
                    'title': '现场复核传感器与周边工况',
                    'reason': '存在严重温度事件或空间梯度异常，需要确认是否为真实风险',
                })
            elif risk_level == 'warning':
                actions.append({
                    'priority': 'high',
                    'action_type': 'targeted_monitoring',
                    'title': '提高监测频率',
                    'reason': f'{sensor.get("sensor_id")} 已进入预警区间，建议缩短复测周期',
                })
            elif risk_level == 'watch':
                actions.append({
                    'priority': 'medium',
                    'action_type': 'observe',
                    'title': '继续观察趋势',
                    'reason': '当前存在轻度风险驱动，建议维持关注并观察后续变化',
                })
            assessment = item.get('construction_assessment') or {}
            for action in assessment.get('actions', [])[:3]:
                actions.append({
                    'priority': 'urgent' if action.get('priority') == 'critical' else 'high',
                    'action_type': 'construction_guidance',
                    'title': action.get('action'),
                    'reason': action.get('detail'),
                })
            planned.append({
                'sensor_id': sensor.get('sensor_id'),
                'risk_level': risk_level,
                'risk_score': item.get('risk_score'),
                'actions': actions,
            })
        return {
            'success': True,
            'sensor_id': sensor_id,
            'count': len(planned),
            'plans': planned,
        }

    def _threshold_keys_for_event(self, event_type):
        mapping = {
            'extreme_high': ['temp_high_warning', 'temp_high_critical'],
            'extreme_low': ['temp_low_warning', 'temp_low_critical'],
            'wide_daily_range': ['daily_range_warning', 'daily_range_critical'],
            'rapid_change': ['rate_change_warning', 'rate_change_critical'],
            'abnormal_gradient': ['gradient_warning', 'gradient_critical'],
            'freeze_thaw': ['freeze_thaw_annual_warning', 'freeze_thaw_annual_critical'],
        }
        return mapping.get(event_type, [])

    def _apply_feedback_offset(self, key, verdict):
        loosen = verdict in {'false_positive', 'ignored'}
        tighten = verdict in {'missed'}
        if not loosen and not tighten:
            return None
        step = 1.0
        if key.startswith('temp_low_'):
            delta = -step if loosen else step
        else:
            delta = step if loosen else -step
        self.ADAPTIVE_OFFSETS[key] = float(self.ADAPTIVE_OFFSETS.get(key, 0.0)) + delta
        return {
            'threshold_key': key,
            'delta': delta,
            'new_value': round(self.BASE_THRESHOLDS.get(key, self.thresholds.get(key, 0.0)) + self.ADAPTIVE_OFFSETS[key], 3),
        }

    def record_feedback(self, sensor_id, event_type, verdict, notes=None):
        verdict = str(verdict or '').strip().lower()
        feedback = {
            'sensor_id': sensor_id,
            'event_type': event_type,
            'verdict': verdict,
            'notes': notes or '',
            'created_at': datetime.now().isoformat(),
        }
        self.FEEDBACK_LOG.append(feedback)
        adjustments = []
        for key in self._threshold_keys_for_event(event_type):
            applied = self._apply_feedback_offset(key, verdict)
            if applied:
                adjustments.append(applied)
        recent = [
            item for item in self.FEEDBACK_LOG
            if item.get('sensor_id') == sensor_id and item.get('event_type') == event_type
        ]
        verdict_summary = defaultdict(int)
        for item in recent:
            verdict_summary[item.get('verdict')] += 1
        self.thresholds = self._build_thresholds()
        return {
            'success': True,
            'feedback': feedback,
            'recent_feedback_count': len(recent),
            'verdict_summary': dict(verdict_summary),
            'threshold_adjustments': adjustments,
            'active_thresholds': {
                key: self.thresholds.get(key)
                for key in self._threshold_keys_for_event(event_type)
            },
        }
