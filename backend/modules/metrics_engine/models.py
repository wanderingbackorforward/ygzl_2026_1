# -*- coding: utf-8 -*-
"""
Data Models for Metrics Engine

Provides data access layer for:
- Monitoring Points
- Raw Data
- Engineering Metrics
- Metric Configurations
- Alert Rules
- Metric Snapshots
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import requests


class BaseModel:
    """Base model with Supabase HTTP client"""

    def __init__(self):
        self.base_url = os.environ.get('SUPABASE_URL', '')
        self.api_key = os.environ.get('SUPABASE_ANON_KEY', '')
        self.service_key = os.environ.get('SUPABASE_SERVICE_ROLE', self.api_key)

    def _get_headers(self, use_service_key: bool = False) -> Dict[str, str]:
        key = self.service_key if use_service_key else self.api_key
        return {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

    def _request(
        self,
        method: str,
        table: str,
        params: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None,
        use_service_key: bool = False
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._get_headers(use_service_key)

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=data,
                timeout=30
            )
            response.raise_for_status()

            if response.text:
                return response.json()
            return {}
        except requests.exceptions.HTTPError as e:
            error_detail = ''
            try:
                error_detail = e.response.text
            except:
                pass
            raise Exception(f"HTTP Error: {e} - {error_detail}")
        except Exception as e:
            raise Exception(f"Request failed: {str(e)}")


class MonitoringPointModel(BaseModel):
    """Model for monitoring_points table"""

    TABLE = 'monitoring_points'

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new monitoring point"""
        result = self._request('POST', self.TABLE, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def get_all(
        self,
        point_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get all monitoring points with optional filters"""
        params = {
            'select': '*',
            'order': 'point_id.asc',
            'limit': str(limit),
            'offset': str(offset)
        }

        if point_type:
            params['point_type'] = f'eq.{point_type}'
        if status:
            params['status'] = f'eq.{status}'

        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_by_id(self, point_id: str) -> Optional[Dict[str, Any]]:
        """Get monitoring point by point_id"""
        params = {
            'select': '*',
            'point_id': f'eq.{point_id}',
            'limit': '1'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result[0] if isinstance(result, list) and result else None

    def update(self, point_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update monitoring point"""
        params = {'point_id': f'eq.{point_id}'}
        result = self._request('PATCH', self.TABLE, params=params, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def delete(self, point_id: str) -> bool:
        """Delete monitoring point"""
        params = {'point_id': f'eq.{point_id}'}
        self._request('DELETE', self.TABLE, params=params, use_service_key=True)
        return True

    def get_by_type(self, point_type: str) -> List[Dict[str, Any]]:
        """Get all points of a specific type"""
        return self.get_all(point_type=point_type)

    def get_active_points(self) -> List[Dict[str, Any]]:
        """Get all active monitoring points"""
        return self.get_all(status='active')


class RawDataModel(BaseModel):
    """Model for raw_data table (Layer 1 data)"""

    TABLE = 'raw_data'

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new raw data entry"""
        result = self._request('POST', self.TABLE, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def create_batch(self, data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create multiple raw data entries"""
        result = self._request('POST', self.TABLE, data=data_list, use_service_key=True)
        return result if isinstance(result, list) else []

    def get_by_point(
        self,
        point_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get raw data for a specific point within time range"""
        params = {
            'select': '*',
            'point_id': f'eq.{point_id}',
            'order': 'measured_at.desc',
            'limit': str(limit)
        }

        if start_time:
            params['measured_at'] = f'gte.{start_time.isoformat()}'
        if end_time:
            if 'measured_at' in params:
                params['measured_at'] = f'gte.{start_time.isoformat()}'
                params['and'] = f'(measured_at.lte.{end_time.isoformat()})'
            else:
                params['measured_at'] = f'lte.{end_time.isoformat()}'

        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_latest(self, point_id: str, count: int = 1) -> List[Dict[str, Any]]:
        """Get latest raw data for a point"""
        params = {
            'select': '*',
            'point_id': f'eq.{point_id}',
            'order': 'measured_at.desc',
            'limit': str(count)
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_range(
        self,
        point_id: str,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """Get raw data for the last N hours"""
        start_time = datetime.utcnow() - timedelta(hours=hours)
        return self.get_by_point(point_id, start_time=start_time)

    def get_statistics(self, point_id: str) -> Dict[str, Any]:
        """Get statistics for a monitoring point"""
        params = {
            'select': '*',
            'point_id': f'eq.{point_id}'
        }
        result = self._request('GET', 'v_raw_data_stats', params=params)
        return result[0] if isinstance(result, list) and result else {}


class EngineeringMetricModel(BaseModel):
    """Model for engineering_metrics table (Layer 2 data)"""

    TABLE = 'engineering_metrics'

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new engineering metric"""
        # Ensure calculated_at is set
        if 'calculated_at' not in data:
            data['calculated_at'] = datetime.utcnow().isoformat()

        result = self._request('POST', self.TABLE, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def get_by_point(
        self,
        point_id: str,
        metric_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get engineering metrics for a point"""
        params = {
            'select': '*',
            'point_id': f'eq.{point_id}',
            'order': 'calculated_at.desc',
            'limit': str(limit)
        }

        if metric_type:
            params['metric_type'] = f'eq.{metric_type}'

        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_latest(
        self,
        point_id: str,
        metric_type: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get latest metric for a point"""
        metrics = self.get_by_point(point_id, metric_type, limit=1)
        return metrics[0] if metrics else None

    def get_by_threshold_status(
        self,
        status: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get metrics by threshold status (normal/warning/critical)"""
        params = {
            'select': '*',
            'threshold_status': f'eq.{status}',
            'order': 'calculated_at.desc',
            'limit': str(limit)
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_warnings_and_criticals(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get all warning and critical metrics from last N hours"""
        since = datetime.utcnow() - timedelta(hours=hours)
        params = {
            'select': '*',
            'threshold_status': 'neq.normal',
            'calculated_at': f'gte.{since.isoformat()}',
            'order': 'calculated_at.desc'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def update_verification(
        self,
        metric_id: int,
        status: str,
        verified_by: str
    ) -> Dict[str, Any]:
        """Update verification status of a metric"""
        params = {'id': f'eq.{metric_id}'}
        data = {
            'verification_status': status,
            'verified_by': verified_by,
            'verified_at': datetime.utcnow().isoformat()
        }
        result = self._request('PATCH', self.TABLE, params=params, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result


class MetricConfigModel(BaseModel):
    """Model for metric_configs table"""

    TABLE = 'metric_configs'

    def get_all(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all metric configurations"""
        params = {'select': '*', 'order': 'metric_type.asc'}
        if active_only:
            params['is_active'] = 'eq.true'

        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_by_type(self, metric_type: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific metric type"""
        params = {
            'select': '*',
            'metric_type': f'eq.{metric_type}',
            'limit': '1'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result[0] if isinstance(result, list) and result else None

    def get_by_point_type(self, point_type: str) -> List[Dict[str, Any]]:
        """Get all configs applicable to a point type"""
        params = {
            'select': '*',
            'applicable_point_types': f'cs.{{"\\"{point_type}\\""}}'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new metric configuration"""
        result = self._request('POST', self.TABLE, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def update(self, metric_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update metric configuration"""
        params = {'metric_type': f'eq.{metric_type}'}
        result = self._request('PATCH', self.TABLE, params=params, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result


class AlertRuleModel(BaseModel):
    """Model for alert_rules table"""

    TABLE = 'alert_rules'

    def get_all(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all alert rules"""
        params = {'select': '*', 'order': 'id.asc'}
        if active_only:
            params['is_active'] = 'eq.true'

        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_by_metric_type(self, metric_type: str) -> List[Dict[str, Any]]:
        """Get rules for a specific metric type"""
        params = {
            'select': '*',
            'trigger_metric_type': f'eq.{metric_type}',
            'is_active': 'eq.true'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new alert rule"""
        result = self._request('POST', self.TABLE, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def update(self, rule_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update alert rule"""
        params = {'id': f'eq.{rule_id}'}
        result = self._request('PATCH', self.TABLE, params=params, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def update_trigger_time(self, rule_id: int) -> None:
        """Update last triggered timestamp"""
        params = {'id': f'eq.{rule_id}'}
        data = {'last_triggered_at': datetime.utcnow().isoformat()}
        self._request('PATCH', self.TABLE, params=params, data=data, use_service_key=True)

    def increment_trigger_count(self, rule_id: int) -> None:
        """Increment trigger count for a rule"""
        # Get current count
        params = {'select': 'trigger_count', 'id': f'eq.{rule_id}'}
        result = self._request('GET', self.TABLE, params=params)
        current = result[0].get('trigger_count', 0) if result else 0

        # Update count
        update_params = {'id': f'eq.{rule_id}'}
        data = {'trigger_count': current + 1}
        self._request('PATCH', self.TABLE, params=update_params, data=data, use_service_key=True)


class MetricSnapshotModel(BaseModel):
    """Model for metric_snapshots table"""

    TABLE = 'metric_snapshots'

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new metric snapshot"""
        # Calculate data size
        if 'snapshot_data' in data:
            data['data_size_bytes'] = len(json.dumps(data['snapshot_data']))

        if 'snapshot_at' not in data:
            data['snapshot_at'] = datetime.utcnow().isoformat()

        result = self._request('POST', self.TABLE, data=data, use_service_key=True)
        return result[0] if isinstance(result, list) and result else result

    def get_by_ticket(self, ticket_id: int) -> List[Dict[str, Any]]:
        """Get snapshots associated with a ticket"""
        params = {
            'select': '*',
            'ticket_id': f'eq.{ticket_id}',
            'order': 'snapshot_at.desc'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_by_ticket_number(self, ticket_number: str) -> List[Dict[str, Any]]:
        """Get snapshots by ticket number"""
        params = {
            'select': '*',
            'ticket_number': f'eq.{ticket_number}',
            'order': 'snapshot_at.desc'
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_by_type(
        self,
        snapshot_type: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get snapshots by type"""
        params = {
            'select': '*',
            'snapshot_type': f'eq.{snapshot_type}',
            'order': 'snapshot_at.desc',
            'limit': str(limit)
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def get_recent(self, hours: int = 24, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent snapshots"""
        since = datetime.utcnow() - timedelta(hours=hours)
        params = {
            'select': '*',
            'snapshot_at': f'gte.{since.isoformat()}',
            'order': 'snapshot_at.desc',
            'limit': str(limit)
        }
        result = self._request('GET', self.TABLE, params=params)
        return result if isinstance(result, list) else []

    def cleanup_expired(self) -> int:
        """Delete expired snapshots"""
        now = datetime.utcnow().isoformat()
        params = {
            'expires_at': f'lt.{now}',
            'expires_at': 'not.is.null'
        }
        try:
            self._request('DELETE', self.TABLE, params=params, use_service_key=True)
            return 1  # Success indicator
        except:
            return 0
