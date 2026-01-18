# -*- coding: utf-8 -*-
"""
Metrics Engine

The core orchestrator for metrics calculation, alert rule processing,
and snapshot management. Implements the three-layer data architecture:
- Layer 1: Raw Data (sensor readings)
- Layer 2: Engineering Metrics (computed values)
- Layer 3: Business Decisions (tickets, reports)
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import threading
import time

from .calculator import MetricsCalculator, CalculationResult
from .models import (
    MonitoringPointModel,
    RawDataModel,
    EngineeringMetricModel,
    MetricConfigModel,
    AlertRuleModel,
    MetricSnapshotModel
)


class MetricsEngine:
    """
    Main engine for metrics processing.

    Responsibilities:
    1. Fetch raw data from Layer 1
    2. Apply metric configurations to calculate Layer 2 metrics
    3. Evaluate alert rules and trigger actions
    4. Create snapshots for audit trail
    5. Support real-time and batch processing
    """

    def __init__(self):
        self.calculator = MetricsCalculator()

        # Models
        self.point_model = MonitoringPointModel()
        self.raw_data_model = RawDataModel()
        self.metric_model = EngineeringMetricModel()
        self.config_model = MetricConfigModel()
        self.alert_model = AlertRuleModel()
        self.snapshot_model = MetricSnapshotModel()

        # Caches
        self._config_cache: Dict[str, Dict[str, Any]] = {}
        self._config_cache_time: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)

        # Background processing
        self._processing_thread: Optional[threading.Thread] = None
        self._stop_flag = False
        self._processing_interval = 60  # seconds

    def calculate_metric_for_point(
        self,
        point_id: str,
        metric_type: str,
        hours: int = 24,
        save: bool = True
    ) -> CalculationResult:
        """
        Calculate a specific metric for a monitoring point.

        Args:
            point_id: The monitoring point ID
            metric_type: Type of metric to calculate
            hours: Hours of historical data to use
            save: Whether to save the result to database

        Returns:
            CalculationResult with computed value and metadata
        """
        # Get metric configuration
        config = self._get_config(metric_type)
        if not config:
            return CalculationResult(
                value=0.0,
                unit='',
                threshold_status='normal',
                calculation_method='unknown',
                calculation_params={},
                data_range_start=None,
                data_range_end=None,
                data_point_count=0,
                quality_score=0.0,
                error=f'Unknown metric type: {metric_type}'
            )

        # Get raw data
        raw_data = self.raw_data_model.get_range(point_id, hours=hours)
        if not raw_data:
            return CalculationResult(
                value=0.0,
                unit=config.get('unit', ''),
                threshold_status='normal',
                calculation_method=config.get('calculation_method', 'unknown'),
                calculation_params={},
                data_range_start=None,
                data_range_end=None,
                data_point_count=0,
                quality_score=0.0,
                error='No raw data available'
            )

        # Get previous metric value for change calculation
        previous = self.metric_model.get_latest(point_id, metric_type)
        previous_value = previous.get('computed_value') if previous else None
        previous_id = previous.get('id') if previous else None

        # Get baseline if needed
        baseline = self._get_baseline(point_id, metric_type, config)

        # Calculate metric
        result = self.calculator.calculate(
            raw_data=raw_data,
            metric_config=config,
            previous_value=previous_value,
            baseline_value=baseline
        )

        # Save to database
        if save and not result.error:
            metric_data = {
                'point_id': point_id,
                'metric_type': metric_type,
                'computed_value': result.value,
                'unit': result.unit,
                'threshold_status': result.threshold_status,
                'calculation_method': result.calculation_method,
                'calculation_params': result.calculation_params,
                'data_source_table': 'raw_data',
                'data_range_start': result.data_range_start.isoformat() if result.data_range_start else None,
                'data_range_end': result.data_range_end.isoformat() if result.data_range_end else None,
                'data_point_count': result.data_point_count,
                'quality_score': result.quality_score,
                'previous_metric_id': previous_id,
                'change_from_previous': result.change_from_previous,
                'change_percentage': result.change_percentage
            }
            self.metric_model.create(metric_data)

            # Check alert rules
            if result.threshold_status in ('warning', 'critical'):
                self._check_alert_rules(point_id, metric_type, result)

        return result

    def calculate_all_metrics_for_point(
        self,
        point_id: str,
        hours: int = 24,
        save: bool = True
    ) -> Dict[str, CalculationResult]:
        """Calculate all applicable metrics for a point"""
        # Get point info
        point = self.point_model.get_by_id(point_id)
        if not point:
            return {}

        point_type = point.get('point_type', '')

        # Get applicable metric configs
        configs = self._get_configs_for_point_type(point_type)

        results = {}
        for config in configs:
            metric_type = config.get('metric_type')
            result = self.calculate_metric_for_point(
                point_id=point_id,
                metric_type=metric_type,
                hours=hours,
                save=save
            )
            results[metric_type] = result

        return results

    def process_all_active_points(
        self,
        hours: int = 24,
        save: bool = True
    ) -> Dict[str, Dict[str, CalculationResult]]:
        """Process metrics for all active monitoring points"""
        points = self.point_model.get_active_points()

        all_results = {}
        for point in points:
            point_id = point.get('point_id')
            results = self.calculate_all_metrics_for_point(
                point_id=point_id,
                hours=hours,
                save=save
            )
            all_results[point_id] = results

        return all_results

    def create_snapshot(
        self,
        snapshot_type: str,
        point_ids: Optional[List[str]] = None,
        ticket_id: Optional[int] = None,
        ticket_number: Optional[str] = None,
        hours: int = 24,
        expires_in_days: int = 90,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a snapshot of current metric data.

        Args:
            snapshot_type: manual / ticket_related / scheduled / alert_triggered
            point_ids: List of point IDs to include (None = all active)
            ticket_id: Associated ticket ID
            ticket_number: Associated ticket number
            hours: Hours of historical data to include
            expires_in_days: Days until snapshot expires
            created_by: User who created the snapshot

        Returns:
            Created snapshot record
        """
        # Get points
        if point_ids:
            points = [self.point_model.get_by_id(pid) for pid in point_ids]
            points = [p for p in points if p]
        else:
            points = self.point_model.get_active_points()

        # Collect snapshot data
        snapshot_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'points': {}
        }

        time_range_start = datetime.utcnow() - timedelta(hours=hours)
        time_range_end = datetime.utcnow()

        for point in points:
            point_id = point.get('point_id')

            # Get recent raw data
            raw_data = self.raw_data_model.get_range(point_id, hours=hours)

            # Get recent metrics
            metrics = self.metric_model.get_by_point(point_id, limit=50)

            snapshot_data['points'][point_id] = {
                'point_info': point,
                'raw_data': raw_data[-100:] if len(raw_data) > 100 else raw_data,  # Limit size
                'metrics': metrics
            }

        # Create snapshot record
        snapshot = self.snapshot_model.create({
            'snapshot_name': f'{snapshot_type}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}',
            'snapshot_type': snapshot_type,
            'snapshot_data': snapshot_data,
            'trigger_source': 'metrics_engine',
            'ticket_id': ticket_id,
            'ticket_number': ticket_number,
            'scope_description': f'Snapshot of {len(points)} monitoring points',
            'included_points': [p.get('point_id') for p in points],
            'time_range_start': time_range_start.isoformat(),
            'time_range_end': time_range_end.isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(days=expires_in_days)).isoformat(),
            'created_by': created_by
        })

        return snapshot

    def get_point_summary(self, point_id: str) -> Dict[str, Any]:
        """
        Get a summary of a monitoring point including latest metrics.

        Returns comprehensive status for display in dashboards.
        """
        point = self.point_model.get_by_id(point_id)
        if not point:
            return {'error': f'Point {point_id} not found'}

        # Get statistics
        stats = self.raw_data_model.get_statistics(point_id)

        # Get latest metrics by type
        latest_metrics = {}
        configs = self._get_configs_for_point_type(point.get('point_type', ''))

        for config in configs:
            metric_type = config.get('metric_type')
            latest = self.metric_model.get_latest(point_id, metric_type)
            if latest:
                latest_metrics[metric_type] = {
                    'value': latest.get('computed_value'),
                    'unit': latest.get('unit'),
                    'status': latest.get('threshold_status'),
                    'calculated_at': latest.get('calculated_at'),
                    'config': {
                        'warning_threshold': config.get('warning_threshold'),
                        'critical_threshold': config.get('critical_threshold')
                    }
                }

        # Determine overall status
        statuses = [m.get('status', 'normal') for m in latest_metrics.values()]
        if 'critical' in statuses:
            overall_status = 'critical'
        elif 'warning' in statuses:
            overall_status = 'warning'
        else:
            overall_status = 'normal'

        return {
            'point': point,
            'statistics': stats,
            'latest_metrics': latest_metrics,
            'overall_status': overall_status,
            'last_updated': datetime.utcnow().isoformat()
        }

    def get_alerts_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get summary of all current alerts"""
        alerts = self.metric_model.get_warnings_and_criticals(hours=hours)

        # Group by status
        critical_count = sum(1 for a in alerts if a.get('threshold_status') == 'critical')
        warning_count = sum(1 for a in alerts if a.get('threshold_status') == 'warning')

        # Group by point
        by_point = {}
        for alert in alerts:
            point_id = alert.get('point_id')
            if point_id not in by_point:
                by_point[point_id] = []
            by_point[point_id].append(alert)

        return {
            'total_alerts': len(alerts),
            'critical_count': critical_count,
            'warning_count': warning_count,
            'affected_points': len(by_point),
            'by_point': by_point,
            'alerts': alerts[:50],  # Latest 50
            'generated_at': datetime.utcnow().isoformat()
        }

    def start_background_processing(self, interval_seconds: int = 60):
        """Start background processing thread"""
        if self._processing_thread and self._processing_thread.is_alive():
            return

        self._stop_flag = False
        self._processing_interval = interval_seconds
        self._processing_thread = threading.Thread(
            target=self._background_processor,
            daemon=True
        )
        self._processing_thread.start()

    def stop_background_processing(self):
        """Stop background processing thread"""
        self._stop_flag = True
        if self._processing_thread:
            self._processing_thread.join(timeout=5)

    def _background_processor(self):
        """Background processing loop"""
        while not self._stop_flag:
            try:
                self.process_all_active_points(hours=24, save=True)
            except Exception as e:
                print(f"[Metrics Engine] Background processing error: {e}")

            # Sleep in small intervals to check stop flag
            for _ in range(self._processing_interval):
                if self._stop_flag:
                    break
                time.sleep(1)

    def _get_config(self, metric_type: str) -> Optional[Dict[str, Any]]:
        """Get metric configuration with caching"""
        self._refresh_cache_if_needed()
        return self._config_cache.get(metric_type)

    def _get_configs_for_point_type(self, point_type: str) -> List[Dict[str, Any]]:
        """Get all configs applicable to a point type"""
        self._refresh_cache_if_needed()
        return [
            config for config in self._config_cache.values()
            if point_type in config.get('applicable_point_types', [])
        ]

    def _refresh_cache_if_needed(self):
        """Refresh configuration cache if expired"""
        now = datetime.utcnow()
        if (self._config_cache_time is None or
                now - self._config_cache_time > self._cache_ttl):
            configs = self.config_model.get_all(active_only=True)
            self._config_cache = {
                c.get('metric_type'): c for c in configs
            }
            self._config_cache_time = now

    def _get_baseline(
        self,
        point_id: str,
        metric_type: str,
        config: Dict[str, Any]
    ) -> Optional[float]:
        """Get baseline value for cumulative calculations"""
        method = config.get('calculation_method')
        if method not in ('cumulative', 'difference'):
            return None

        # Check point-specific threshold config
        point = self.point_model.get_by_id(point_id)
        if point:
            threshold_config = point.get('threshold_config', {})
            baseline = threshold_config.get(f'{metric_type}_baseline')
            if baseline is not None:
                return baseline

        # Use first recorded raw data value as baseline
        raw_data = self.raw_data_model.get_by_point(point_id, limit=1)
        if raw_data:
            # Get the oldest record by querying with ascending order
            oldest = self.raw_data_model._request(
                'GET',
                'raw_data',
                params={
                    'select': 'raw_value',
                    'point_id': f'eq.{point_id}',
                    'order': 'measured_at.asc',
                    'limit': '1'
                }
            )
            if oldest and isinstance(oldest, list) and oldest:
                return oldest[0].get('raw_value')

        return None

    def _check_alert_rules(
        self,
        point_id: str,
        metric_type: str,
        result: CalculationResult
    ):
        """Check and trigger alert rules based on metric result"""
        rules = self.alert_model.get_by_metric_type(metric_type)

        for rule in rules:
            # Check cooldown
            last_triggered = rule.get('last_triggered_at')
            cooldown_minutes = rule.get('cooldown_minutes', 60)

            if last_triggered:
                try:
                    last_time = datetime.fromisoformat(last_triggered.replace('Z', '+00:00'))
                    if datetime.utcnow() - last_time.replace(tzinfo=None) < timedelta(minutes=cooldown_minutes):
                        continue  # Still in cooldown
                except:
                    pass

            # Check if point matches rule
            specific_points = rule.get('trigger_specific_points')
            if specific_points and point_id not in specific_points:
                continue

            # Check condition
            condition_type = rule.get('condition_type')
            condition_params = rule.get('condition_params', {})

            triggered = self._evaluate_alert_condition(
                result=result,
                condition_type=condition_type,
                condition_params=condition_params
            )

            if triggered:
                self._trigger_alert_action(rule, point_id, result)
                self.alert_model.update_trigger_time(rule.get('id'))
                self.alert_model.increment_trigger_count(rule.get('id'))

    def _evaluate_alert_condition(
        self,
        result: CalculationResult,
        condition_type: str,
        condition_params: Dict[str, Any]
    ) -> bool:
        """Evaluate if an alert condition is met"""
        if condition_type == 'threshold_exceeded':
            threshold = condition_params.get('threshold')
            comparison = condition_params.get('comparison', 'greater_than')

            if threshold is None:
                return False

            if comparison == 'greater_than':
                return result.value > threshold
            elif comparison == 'less_than':
                return result.value < threshold
            elif comparison == 'greater_equal':
                return result.value >= threshold
            elif comparison == 'less_equal':
                return result.value <= threshold

        elif condition_type == 'rate_exceeded':
            rate_threshold = condition_params.get('rate_threshold')
            if rate_threshold is None or result.change_from_previous is None:
                return False
            return abs(result.change_from_previous) > rate_threshold

        elif condition_type == 'status_is':
            status = condition_params.get('status')
            return result.threshold_status == status

        return False

    def _trigger_alert_action(
        self,
        rule: Dict[str, Any],
        point_id: str,
        result: CalculationResult
    ):
        """Execute alert action (create ticket, send notification, etc.)"""
        action_type = rule.get('action_type', 'create_ticket')

        if action_type in ('create_ticket', 'both'):
            self._create_alert_ticket(rule, point_id, result)

        if action_type in ('send_notification', 'both'):
            # Notification logic would go here
            pass

    def _create_alert_ticket(
        self,
        rule: Dict[str, Any],
        point_id: str,
        result: CalculationResult
    ):
        """Create a ticket from an alert rule"""
        # Import here to avoid circular imports
        try:
            from modules.ticket_system.models.ticket import TicketModel

            ticket_model = TicketModel()

            # Get point info
            point = self.point_model.get_by_id(point_id)
            point_name = point.get('point_name', point_id) if point else point_id

            # Build ticket data
            ticket_data = {
                'title': f"{rule.get('rule_name', 'Alert')} - {point_name}",
                'description': (
                    f"Alert triggered by rule: {rule.get('rule_name')}\n\n"
                    f"Monitoring Point: {point_name} ({point_id})\n"
                    f"Metric Type: {result.calculation_method}\n"
                    f"Current Value: {result.value} {result.unit}\n"
                    f"Threshold Status: {result.threshold_status}\n"
                    f"Quality Score: {result.quality_score:.2f}\n"
                    f"Data Points: {result.data_point_count}"
                ),
                'ticket_type': rule.get('ticket_type', 'SETTLEMENT_ALERT'),
                'priority': rule.get('ticket_priority', 'MEDIUM'),
                'creator_id': 'system',
                'creator_name': 'Metrics Engine',
                'monitoring_point_id': point_id,
                'current_value': result.value,
                'alert_data': {
                    'rule_id': rule.get('id'),
                    'rule_name': rule.get('rule_name'),
                    'calculation_params': result.calculation_params,
                    'triggered_at': datetime.utcnow().isoformat()
                }
            }

            # Add assignee if specified in rule
            if rule.get('default_assignee_id'):
                ticket_data['assignee_id'] = rule.get('default_assignee_id')

            ticket_model.create_ticket(ticket_data)

            # Create snapshot for the ticket
            self.create_snapshot(
                snapshot_type='alert_triggered',
                point_ids=[point_id],
                created_by='metrics_engine'
            )

        except Exception as e:
            print(f"[Metrics Engine] Failed to create alert ticket: {e}")
