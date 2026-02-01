# -*- coding: utf-8 -*-
"""
Event Service - Construction event management and impact analysis
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


def _post_headers():
    h = _headers()
    h['Content-Type'] = 'application/json'
    h['Prefer'] = 'return=representation'
    return h


def _url(path):
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


class EventService:
    """Service for construction event management and causal analysis"""

    # Event types
    EVENT_TYPES = [
        {'value': 'pile', 'label': 'Pile Driving', 'label_cn': 'Pile Driving'},
        {'value': 'excavation', 'label': 'Excavation', 'label_cn': 'Excavation'},
        {'value': 'grouting', 'label': 'Grouting', 'label_cn': 'Grouting'},
        {'value': 'dewatering', 'label': 'Dewatering', 'label_cn': 'Dewatering'},
        {'value': 'loading', 'label': 'Surface Loading', 'label_cn': 'Surface Loading'},
        {'value': 'other', 'label': 'Other', 'label_cn': 'Other'},
    ]

    # Impact analysis window (hours after event)
    IMPACT_WINDOW_HOURS = 72

    def get_event_types(self) -> List[Dict]:
        """Get available event types"""
        return self.EVENT_TYPES

    def list_events(self, start_date: Optional[str] = None, end_date: Optional[str] = None,
                    event_type: Optional[str] = None) -> List[Dict]:
        """List construction events with optional filters"""
        query = '/rest/v1/construction_events?select=*&order=event_date.desc'

        filters = []
        if start_date:
            filters.append(f'event_date=gte.{start_date}')
        if end_date:
            filters.append(f'event_date=lte.{end_date}')
        if event_type:
            filters.append(f'event_type=eq.{event_type}')

        if filters:
            query += '&' + '&'.join(filters)

        r = requests.get(_url(query), headers=_headers())
        r.raise_for_status()
        events = r.json()

        # Format dates
        for e in events:
            if e.get('event_date'):
                e['event_date'] = str(e['event_date']).replace('T', ' ').split('.')[0]
            if e.get('event_end_date'):
                e['event_end_date'] = str(e['event_end_date']).replace('T', ' ').split('.')[0]

        return events

    def get_event(self, event_id: int) -> Optional[Dict]:
        """Get a single event by ID"""
        r = requests.get(
            _url(f'/rest/v1/construction_events?select=*&event_id=eq.{event_id}'),
            headers=_headers()
        )
        r.raise_for_status()
        events = r.json()
        return events[0] if events else None

    def create_event(self, event_data: Dict) -> Dict:
        """Create a new construction event"""
        r = requests.post(
            _url('/rest/v1/construction_events'),
            headers=_post_headers(),
            json=event_data
        )
        r.raise_for_status()
        result = r.json()
        return result[0] if isinstance(result, list) and result else result

    def update_event(self, event_id: int, event_data: Dict) -> Dict:
        """Update an existing event"""
        event_data['updated_at'] = datetime.now().isoformat()
        r = requests.patch(
            _url(f'/rest/v1/construction_events?event_id=eq.{event_id}'),
            headers=_post_headers(),
            json=event_data
        )
        r.raise_for_status()
        result = r.json()
        return result[0] if isinstance(result, list) and result else result

    def delete_event(self, event_id: int) -> bool:
        """Delete an event"""
        r = requests.delete(
            _url(f'/rest/v1/construction_events?event_id=eq.{event_id}'),
            headers=_headers()
        )
        r.raise_for_status()
        return True

    def analyze_event_impact(self, event_id: int, window_hours: int = None) -> Dict:
        """
        Analyze the impact of a construction event on settlement

        Compares settlement before and after the event within a time window

        Returns:
            {
                "event": {...event details...},
                "affected_points": [
                    {
                        "point_id": "S5",
                        "before_rate": 0.02,
                        "after_rate": 0.08,
                        "rate_change": 0.06,
                        "before_values": [...],
                        "after_values": [...],
                        "impact_level": "high"
                    }
                ],
                "summary": {
                    "total_affected": 5,
                    "high_impact": 2,
                    "max_rate_change": 0.12
                }
            }
        """
        window = window_hours or self.IMPACT_WINDOW_HOURS

        # Get event
        event = self.get_event(event_id)
        if not event:
            return {'error': 'Event not found'}

        event_date = event.get('event_date')
        if not event_date:
            return {'error': 'Event date not set'}

        # Parse event date
        if isinstance(event_date, str):
            event_dt = datetime.fromisoformat(event_date.replace(' ', 'T').split('.')[0])
        else:
            event_dt = event_date

        # Calculate time windows
        before_start = (event_dt - timedelta(hours=window)).isoformat()
        before_end = event_dt.isoformat()
        after_start = event_dt.isoformat()
        after_end = (event_dt + timedelta(hours=window)).isoformat()

        # Get affected points (if specified) or all points
        affected_points = event.get('affected_points') or []

        # If no specific points, use all settlement points
        if not affected_points:
            config_r = requests.get(
                _url('/rest/v1/tunnel_profile_config?select=point_id'),
                headers=_headers()
            )
            if config_r.status_code == 200:
                affected_points = [p['point_id'] for p in config_r.json()]

        results = []
        for point_id in affected_points:
            # Get data before event
            before_r = requests.get(
                _url(f'/rest/v1/processed_settlement_data?select=*&point_id=eq.{point_id}&measurement_date=gte.{before_start}&measurement_date=lt.{before_end}&order=measurement_date'),
                headers=_headers()
            )
            before_data = before_r.json() if before_r.status_code == 200 else []

            # Get data after event
            after_r = requests.get(
                _url(f'/rest/v1/processed_settlement_data?select=*&point_id=eq.{point_id}&measurement_date=gte.{after_start}&measurement_date=lt.{after_end}&order=measurement_date'),
                headers=_headers()
            )
            after_data = after_r.json() if after_r.status_code == 200 else []

            if not before_data or not after_data:
                continue

            # Calculate rates
            def calc_rate(data):
                if len(data) < 2:
                    return 0
                changes = [r.get('daily_change', 0) or 0 for r in data]
                return sum(changes) / len(changes)

            before_rate = calc_rate(before_data)
            after_rate = calc_rate(after_data)
            rate_change = after_rate - before_rate

            # Determine impact level
            if abs(rate_change) > 0.1:
                impact_level = 'high'
            elif abs(rate_change) > 0.05:
                impact_level = 'medium'
            elif abs(rate_change) > 0.02:
                impact_level = 'low'
            else:
                impact_level = 'none'

            results.append({
                'point_id': point_id,
                'before_rate': round(before_rate, 4),
                'after_rate': round(after_rate, 4),
                'rate_change': round(rate_change, 4),
                'before_values': [r.get('value') for r in before_data[-5:]],  # Last 5
                'after_values': [r.get('value') for r in after_data[:5]],  # First 5
                'impact_level': impact_level,
            })

        # Sort by impact
        impact_order = {'high': 0, 'medium': 1, 'low': 2, 'none': 3}
        results.sort(key=lambda x: (impact_order.get(x['impact_level'], 99), -abs(x['rate_change'])))

        # Summary
        high_impact = len([r for r in results if r['impact_level'] == 'high'])
        medium_impact = len([r for r in results if r['impact_level'] == 'medium'])
        max_change = max([abs(r['rate_change']) for r in results], default=0)

        return {
            'event': event,
            'window_hours': window,
            'affected_points': results,
            'summary': {
                'total_analyzed': len(results),
                'high_impact': high_impact,
                'medium_impact': medium_impact,
                'max_rate_change': round(max_change, 4),
            }
        }

    def get_events_for_timeline(self, start_date: str, end_date: str) -> List[Dict]:
        """
        Get events formatted for timeline overlay on charts

        Returns simplified event data for chart annotations
        """
        events = self.list_events(start_date=start_date, end_date=end_date)

        timeline = []
        for e in events:
            timeline.append({
                'date': e.get('event_date'),
                'type': e.get('event_type'),
                'title': e.get('title'),
                'intensity': e.get('intensity'),
                'event_id': e.get('event_id'),
            })

        return timeline

    def get_summary(self) -> Dict:
        """Get summary of construction events"""
        r = requests.get(
            _url('/rest/v1/construction_events?select=event_id,event_type'),
            headers=_headers()
        )
        r.raise_for_status()
        events = r.json()

        # Count by type
        type_counts = {}
        for e in events:
            t = e.get('event_type', 'other')
            type_counts[t] = type_counts.get(t, 0) + 1

        return {
            'total_events': len(events),
            'by_type': type_counts,
        }
