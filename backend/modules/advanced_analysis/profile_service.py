# -*- coding: utf-8 -*-
"""
Profile Service - Tunnel profile data retrieval and processing
"""

import os
import requests
from datetime import datetime, timedelta
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


class ProfileService:
    """Service for tunnel profile data operations"""

    def get_profile_config(self) -> List[Dict]:
        """Get all tunnel profile configuration (point -> chainage mapping)"""
        r = requests.get(
            _url('/rest/v1/tunnel_profile_config?select=*&order=chainage_m'),
            headers=_headers()
        )
        r.raise_for_status()
        return r.json()

    def get_geological_layers(self) -> List[Dict]:
        """Get geological layer data for profile background"""
        r = requests.get(
            _url('/rest/v1/geological_layers?select=*&order=depth_top'),
            headers=_headers()
        )
        r.raise_for_status()
        return r.json()

    def get_profile_data(self, date: Optional[str] = None) -> Dict:
        """
        Get profile data for a specific date
        Returns chainage vs settlement for all points

        Args:
            date: Date string in YYYY-MM-DD format. If None, uses latest date.

        Returns:
            {
                "date": "2019-01-15",
                "profile": [
                    {"point_id": "S0", "chainage_m": 0, "value": -5.2, ...},
                    ...
                ],
                "layers": [...geological layers...]
            }
        """
        # Get profile config
        config = self.get_profile_config()
        chainage_map = {p['point_id']: p['chainage_m'] for p in config}

        # Get settlement data for the date
        if date:
            # Specific date
            query = f'/rest/v1/processed_settlement_data?select=*&measurement_date=gte.{date}T00:00:00&measurement_date=lt.{date}T23:59:59&order=point_id'
        else:
            # Get latest date first
            latest_r = requests.get(
                _url('/rest/v1/processed_settlement_data?select=measurement_date&order=measurement_date.desc&limit=1'),
                headers=_headers()
            )
            latest_r.raise_for_status()
            latest = latest_r.json()
            if not latest:
                return {"date": None, "profile": [], "layers": []}
            date = str(latest[0]['measurement_date']).split('T')[0]
            query = f'/rest/v1/processed_settlement_data?select=*&measurement_date=gte.{date}T00:00:00&measurement_date=lt.{date}T23:59:59&order=point_id'

        r = requests.get(_url(query), headers=_headers())
        r.raise_for_status()
        data = r.json()

        # Group by point_id and take latest reading of the day
        point_data = {}
        for row in data:
            pid = row.get('point_id')
            if pid not in point_data:
                point_data[pid] = row

        # Build profile with chainage
        profile = []
        for pid, row in point_data.items():
            chainage = chainage_map.get(pid)
            if chainage is not None:
                profile.append({
                    'point_id': pid,
                    'chainage_m': chainage,
                    'value': row.get('value'),
                    'cumulative_change': row.get('cumulative_change'),
                    'daily_change': row.get('daily_change'),
                })

        # Sort by chainage
        profile.sort(key=lambda x: x['chainage_m'])

        # Get layers
        layers = self.get_geological_layers()

        return {
            "date": date,
            "profile": profile,
            "layers": layers
        }

    def get_available_dates(self) -> List[str]:
        """Get list of available dates for profile visualization"""
        r = requests.get(
            _url('/rest/v1/processed_settlement_data?select=measurement_date&order=measurement_date'),
            headers=_headers()
        )
        r.raise_for_status()
        data = r.json()

        # Extract unique dates
        dates = set()
        for row in data:
            d = row.get('measurement_date')
            if d:
                dates.add(str(d).split('T')[0])

        return sorted(list(dates))

    def get_profile_animation_data(self, start_date: str, end_date: str, interval_days: int = 7) -> List[Dict]:
        """
        Get profile data for animation over a date range

        Args:
            start_date: Start date YYYY-MM-DD
            end_date: End date YYYY-MM-DD
            interval_days: Days between frames

        Returns:
            List of profile data for each frame date
        """
        frames = []
        current = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        while current <= end:
            date_str = current.strftime('%Y-%m-%d')
            frame = self.get_profile_data(date_str)
            if frame['profile']:  # Only include if data exists
                frames.append(frame)
            current += timedelta(days=interval_days)

        return frames

    def get_profile_statistics(self) -> Dict:
        """Get summary statistics for the profile"""
        config = self.get_profile_config()

        # Get latest settlement analysis
        r = requests.get(
            _url('/rest/v1/settlement_analysis?select=point_id,avg_value,total_change,trend_type,alert_level'),
            headers=_headers()
        )
        r.raise_for_status()
        analysis = {row['point_id']: row for row in r.json()}

        chainage_map = {p['point_id']: p['chainage_m'] for p in config}

        stats = []
        for pid, chainage in chainage_map.items():
            ana = analysis.get(pid, {})
            stats.append({
                'point_id': pid,
                'chainage_m': chainage,
                'avg_value': ana.get('avg_value'),
                'total_change': ana.get('total_change'),
                'trend_type': ana.get('trend_type'),
                'alert_level': ana.get('alert_level'),
            })

        stats.sort(key=lambda x: x['chainage_m'])

        # Find max settlement location
        max_settlement = min(stats, key=lambda x: x.get('total_change') or 0, default=None)

        return {
            'points': stats,
            'max_settlement_point': max_settlement,
            'total_points': len(stats),
        }
