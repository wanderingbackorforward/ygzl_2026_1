# -*- coding: utf-8 -*-
"""
Joint Analysis Service - Settlement + Crack combined analysis
"""

import os
import requests
from datetime import datetime
from typing import List, Dict, Optional


def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h


def _url(path):
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


class JointAnalysisService:
    """Service for settlement + crack joint analysis"""

    # Thresholds for joint alerts
    SETTLEMENT_RATE_THRESHOLD = 0.05  # mm/day
    CRACK_RATE_THRESHOLD = 0.02  # mm/day

    def get_mapping(self) -> List[Dict]:
        """Get settlement-crack point mapping"""
        r = requests.get(
            _url('/rest/v1/settlement_crack_mapping?select=*&order=settlement_point'),
            headers=_headers()
        )
        r.raise_for_status()
        return r.json()

    def get_related_cracks(self, settlement_point: str) -> List[Dict]:
        """Get crack points related to a settlement point"""
        r = requests.get(
            _url(f'/rest/v1/settlement_crack_mapping?select=*&settlement_point=eq.{settlement_point}'),
            headers=_headers()
        )
        r.raise_for_status()
        return r.json()

    def get_related_settlement(self, crack_point: str) -> List[Dict]:
        """Get settlement points related to a crack point"""
        r = requests.get(
            _url(f'/rest/v1/settlement_crack_mapping?select=*&crack_point=eq.{crack_point}'),
            headers=_headers()
        )
        r.raise_for_status()
        return r.json()

    def get_joint_time_series(self, settlement_point: str) -> Dict:
        """
        Get joint time series for a settlement point and its related cracks

        Returns:
            {
                "settlement_point": "S5",
                "settlement_data": [...time series...],
                "related_cracks": [
                    {
                        "crack_point": "F3-1",
                        "correlation_strength": "strong",
                        "data": [...time series...]
                    }
                ]
            }
        """
        # Get settlement data
        s_r = requests.get(
            _url(f'/rest/v1/processed_settlement_data?select=*&point_id=eq.{settlement_point}&order=measurement_date'),
            headers=_headers()
        )
        s_r.raise_for_status()
        settlement_data = s_r.json()

        # Format dates
        for row in settlement_data:
            if row.get('measurement_date'):
                row['measurement_date'] = str(row['measurement_date']).split('T')[0]

        # Get related crack mappings
        mappings = self.get_related_cracks(settlement_point)

        related_cracks = []
        for m in mappings:
            crack_point = m['crack_point']

            # Get crack data
            c_r = requests.get(
                _url(f'/rest/v1/crack_monitoring_data?select=*&point_id=eq.{crack_point}&order=measurement_date'),
                headers=_headers()
            )
            c_r.raise_for_status()
            crack_data = c_r.json()

            # Format dates
            for row in crack_data:
                if row.get('measurement_date'):
                    row['measurement_date'] = str(row['measurement_date']).split('T')[0]

            related_cracks.append({
                'crack_point': crack_point,
                'crack_id': m.get('crack_id') or crack_point.split('-')[0],
                'correlation_strength': m.get('correlation_strength'),
                'distance_m': m.get('distance_m'),
                'data': crack_data
            })

        return {
            'settlement_point': settlement_point,
            'settlement_data': settlement_data,
            'related_cracks': related_cracks
        }

    def analyze_correlation(self, settlement_point: str) -> Dict:
        """
        Analyze correlation between settlement and crack changes

        Returns correlation metrics and trend comparison
        """
        joint_data = self.get_joint_time_series(settlement_point)

        settlement_data = joint_data['settlement_data']
        if not settlement_data:
            return {'error': 'No settlement data found'}

        # Calculate settlement statistics
        settlement_values = [r.get('cumulative_change', 0) for r in settlement_data if r.get('cumulative_change') is not None]
        settlement_changes = [r.get('daily_change', 0) for r in settlement_data if r.get('daily_change') is not None]

        settlement_stats = {
            'total_change': settlement_values[-1] if settlement_values else 0,
            'avg_daily_rate': sum(settlement_changes) / len(settlement_changes) if settlement_changes else 0,
            'max_daily_rate': min(settlement_changes) if settlement_changes else 0,  # min because negative = settling
        }

        # Analyze each related crack
        crack_analysis = []
        for crack in joint_data['related_cracks']:
            crack_data = crack['data']
            if not crack_data:
                continue

            crack_values = [r.get('value', 0) for r in crack_data if r.get('value') is not None]

            if len(crack_values) >= 2:
                total_change = crack_values[-1] - crack_values[0]
                avg_rate = total_change / len(crack_values) if crack_values else 0
            else:
                total_change = 0
                avg_rate = 0

            crack_analysis.append({
                'crack_point': crack['crack_point'],
                'correlation_strength': crack['correlation_strength'],
                'total_change': total_change,
                'avg_rate': avg_rate,
            })

        return {
            'settlement_point': settlement_point,
            'settlement_stats': settlement_stats,
            'crack_analysis': crack_analysis,
        }

    def get_joint_alerts(self) -> List[Dict]:
        """
        Get joint alerts where both settlement and crack are abnormal

        Returns list of alerts with combined severity
        """
        alerts = []

        # Get all mappings
        mappings = self.get_mapping()

        # Group by settlement point
        from collections import defaultdict
        point_cracks = defaultdict(list)
        for m in mappings:
            point_cracks[m['settlement_point']].append(m)

        # Get settlement analysis
        s_r = requests.get(
            _url('/rest/v1/settlement_analysis?select=*'),
            headers=_headers()
        )
        s_r.raise_for_status()
        settlement_analysis = {r['point_id']: r for r in s_r.json()}

        # Check each settlement point
        for settlement_point, crack_mappings in point_cracks.items():
            s_ana = settlement_analysis.get(settlement_point, {})
            s_alert_level = s_ana.get('alert_level', 'normal')
            s_trend = s_ana.get('trend_type', '')
            s_rate = abs(s_ana.get('avg_daily_rate', 0) or 0)

            # Skip if settlement is normal
            if s_alert_level == 'normal' and s_rate < self.SETTLEMENT_RATE_THRESHOLD:
                continue

            # Check related cracks
            for cm in crack_mappings:
                crack_point = cm['crack_point']

                # Get latest crack data
                c_r = requests.get(
                    _url(f'/rest/v1/crack_monitoring_data?select=*&point_id=eq.{crack_point}&order=measurement_date.desc&limit=10'),
                    headers=_headers()
                )
                if c_r.status_code != 200:
                    continue
                crack_data = c_r.json()

                if len(crack_data) < 2:
                    continue

                # Calculate crack rate
                crack_values = [r.get('value', 0) for r in crack_data]
                crack_rate = abs(crack_values[0] - crack_values[-1]) / len(crack_values)

                # Check if crack is also abnormal
                if crack_rate > self.CRACK_RATE_THRESHOLD:
                    # Generate joint alert
                    severity = 'critical' if s_alert_level == 'alert' else 'high'

                    alerts.append({
                        'settlement_point': settlement_point,
                        'crack_point': crack_point,
                        'severity': severity,
                        'settlement_alert_level': s_alert_level,
                        'settlement_trend': s_trend,
                        'settlement_rate': s_rate,
                        'crack_rate': crack_rate,
                        'message': f'{settlement_point} settlement abnormal ({s_trend}) with related crack {crack_point} expanding',
                        'recommendation': 'Urgent: Schedule joint inspection for settlement point and crack monitoring'
                    })

        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        alerts.sort(key=lambda x: severity_order.get(x['severity'], 99))

        return alerts

    def get_summary(self) -> Dict:
        """Get summary of joint analysis data"""
        mappings = self.get_mapping()

        # Count unique points
        settlement_points = set(m['settlement_point'] for m in mappings)
        crack_points = set(m['crack_point'] for m in mappings)

        # Get alerts count
        alerts = self.get_joint_alerts()

        return {
            'total_mappings': len(mappings),
            'settlement_points_with_cracks': len(settlement_points),
            'crack_points_monitored': len(crack_points),
            'active_joint_alerts': len(alerts),
            'critical_alerts': len([a for a in alerts if a['severity'] == 'critical']),
        }
