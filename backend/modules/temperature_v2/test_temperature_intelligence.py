# -*- coding: utf-8 -*-

import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..', '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from modules.temperature_v2.intelligence import TemperatureIntelligenceService


class FakeRepo:
    def __init__(self):
        self.sensor_id = 'T-01'
        self.point_id = 'DB-01'
        self.temperature_rows = []
        avg_values = [-5, -4, -2, 1, 5, 9, 14, 19, 24, 30, 37, 42]
        for idx, avg in enumerate(avg_values, start=1):
            self.temperature_rows.append({
                'measurement_date': f'2026-01-{idx:02d}',
                'SID': self.sensor_id,
                'avg_temperature': float(avg),
                'max_temperature': float(avg + 4),
                'min_temperature': float(avg - 16 if idx == len(avg_values) else avg - 2),
            })

    def temperature_get_points(self):
        return [{
            'point_id': self.sensor_id,
            'point_name': '温度点T-01',
            'x_coord': 10.0,
            'y_coord': 5.0,
            'z_coord': 1.5,
            'status': 'active',
        }]

    def temperature_get_summary(self):
        latest = self.temperature_rows[-1]
        return [{
            'sensor_id': self.sensor_id,
            'avg_temperature': latest['avg_temperature'],
            'max_temperature': latest['max_temperature'],
            'min_temperature': latest['min_temperature'],
            'temperature_range': latest['max_temperature'] - latest['min_temperature'],
            'trend_type': 'rising',
            'alert_level': 'warning',
        }]

    def temperature_get_stats(self):
        latest = self.temperature_rows[-1]
        return {
            'current_temperature': {
                'avg': latest['avg_temperature'],
                'max': latest['max_temperature'],
                'min': latest['min_temperature'],
                'sensor_count': 1,
                'date_range': '2026-01-01 ~ 2026-01-12',
            },
            'trends': {'rising': 1},
            'alerts': {'warning': 1},
        }

    def temperature_get_data(self, sensor_id):
        if sensor_id != self.sensor_id:
            return {'timeSeriesData': [], 'analysisData': {}}
        return {'timeSeriesData': self.temperature_rows, 'analysisData': self.temperature_get_summary()[0]}

    def get_all_points(self):
        return [{'point_id': self.point_id}]

    def get_point_detail(self, point_id):
        if point_id != self.point_id:
            return {'timeSeriesData': []}
        rows = []
        for idx, row in enumerate(self.temperature_rows, start=1):
            rows.append({
                'measurement_date': row['measurement_date'],
                'cumulative_change': round(idx * 1.8 + row['avg_temperature'] * 0.35, 3),
            })
        return {'timeSeriesData': rows}


class TemperatureIntelligenceServiceTest(unittest.TestCase):
    def setUp(self):
        TemperatureIntelligenceService.FEEDBACK_LOG.clear()
        TemperatureIntelligenceService.ADAPTIVE_OFFSETS.clear()
        self.service = TemperatureIntelligenceService(repo=FakeRepo(), analysis_service=False)

    def test_snapshot_contains_freeze_thaw_summary(self):
        result = self.service.get_snapshot()
        self.assertTrue(result['success'])
        self.assertEqual(result['overview']['sensor_count'], 1)
        self.assertGreaterEqual(result['overview']['freeze_thaw_cycle_total'], 1)

    def test_risk_evaluation_detects_critical_sensor(self):
        result = self.service.evaluate_risk(sensor_id='T-01')
        self.assertTrue(result['success'])
        self.assertEqual(result['count'], 1)
        item = result['items'][0]
        self.assertEqual(item['sensor_id'], 'T-01')
        self.assertEqual(item['risk_level'], 'critical')
        self.assertGreaterEqual(item['risk_score'], 75)
        self.assertTrue(any(event['event_type'] == 'temp_settlement_coupling' for event in item['events']))

    def test_action_plan_contains_ticket_for_critical_risk(self):
        result = self.service.plan_actions(sensor_id='T-01')
        self.assertTrue(result['success'])
        plan = result['plans'][0]
        action_types = [action['action_type'] for action in plan['actions']]
        self.assertIn('create_ticket', action_types)
        self.assertIn('inspect_sensor', action_types)

    def test_feedback_loosen_high_temperature_threshold(self):
        before = self.service.thresholds['temp_high_warning']
        result = self.service.record_feedback(
            sensor_id='T-01',
            event_type='extreme_high',
            verdict='false_positive',
            notes='高温告警被人工判定为可接受波动',
        )
        self.assertTrue(result['success'])
        self.assertGreater(result['active_thresholds']['temp_high_warning'], before)


if __name__ == '__main__':
    unittest.main()
