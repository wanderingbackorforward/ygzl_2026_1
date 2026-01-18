# -*- coding: utf-8 -*-
"""
Metrics Engine API

Flask Blueprint providing REST API endpoints for:
- Monitoring point management
- Raw data ingestion
- Metric calculation and retrieval
- Alert rule management
- Snapshot management
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from typing import Optional

from .engine import MetricsEngine
from .models import (
    MonitoringPointModel,
    RawDataModel,
    EngineeringMetricModel,
    MetricConfigModel,
    AlertRuleModel,
    MetricSnapshotModel
)

metrics_bp = Blueprint('metrics', __name__, url_prefix='/api/metrics')

# Initialize engine (singleton pattern)
_engine: Optional[MetricsEngine] = None


def get_engine() -> MetricsEngine:
    global _engine
    if _engine is None:
        _engine = MetricsEngine()
    return _engine


# =====================================================
# Monitoring Points Endpoints
# =====================================================

@metrics_bp.route('/points', methods=['GET'])
def get_monitoring_points():
    """Get all monitoring points with optional filters"""
    try:
        point_type = request.args.get('type')
        status = request.args.get('status')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))

        model = MonitoringPointModel()
        points = model.get_all(
            point_type=point_type,
            status=status,
            limit=limit,
            offset=offset
        )

        return jsonify({
            'success': True,
            'data': points,
            'count': len(points)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/points/<point_id>', methods=['GET'])
def get_monitoring_point(point_id: str):
    """Get a specific monitoring point with summary"""
    try:
        engine = get_engine()
        summary = engine.get_point_summary(point_id)

        if 'error' in summary:
            return jsonify({'success': False, 'error': summary['error']}), 404

        return jsonify({
            'success': True,
            'data': summary
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/points', methods=['POST'])
def create_monitoring_point():
    """Create a new monitoring point"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        required = ['point_id', 'point_name', 'point_type']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing}'
            }), 400

        model = MonitoringPointModel()
        result = model.create(data)

        return jsonify({
            'success': True,
            'data': result
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/points/<point_id>', methods=['PUT'])
def update_monitoring_point(point_id: str):
    """Update a monitoring point"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        model = MonitoringPointModel()
        result = model.update(point_id, data)

        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/points/<point_id>', methods=['DELETE'])
def delete_monitoring_point(point_id: str):
    """Delete a monitoring point"""
    try:
        model = MonitoringPointModel()
        model.delete(point_id)

        return jsonify({
            'success': True,
            'message': f'Point {point_id} deleted'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# Raw Data Endpoints
# =====================================================

@metrics_bp.route('/raw-data/<point_id>', methods=['GET'])
def get_raw_data(point_id: str):
    """Get raw data for a monitoring point"""
    try:
        hours = int(request.args.get('hours', 24))
        limit = int(request.args.get('limit', 1000))

        model = RawDataModel()
        data = model.get_range(point_id, hours=hours)

        return jsonify({
            'success': True,
            'data': data[:limit],
            'count': len(data)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/raw-data', methods=['POST'])
def create_raw_data():
    """Create a new raw data entry"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        required = ['point_id', 'raw_value']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing}'
            }), 400

        # Add measured_at if not provided
        if 'measured_at' not in data:
            data['measured_at'] = datetime.utcnow().isoformat()

        model = RawDataModel()
        result = model.create(data)

        return jsonify({
            'success': True,
            'data': result
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/raw-data/batch', methods=['POST'])
def create_raw_data_batch():
    """Create multiple raw data entries"""
    try:
        data_list = request.get_json()
        if not data_list or not isinstance(data_list, list):
            return jsonify({
                'success': False,
                'error': 'Expected array of data entries'
            }), 400

        # Add measured_at if not provided
        for item in data_list:
            if 'measured_at' not in item:
                item['measured_at'] = datetime.utcnow().isoformat()

        model = RawDataModel()
        result = model.create_batch(data_list)

        return jsonify({
            'success': True,
            'data': result,
            'count': len(result)
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/raw-data/<point_id>/statistics', methods=['GET'])
def get_raw_data_statistics(point_id: str):
    """Get statistics for a monitoring point's raw data"""
    try:
        model = RawDataModel()
        stats = model.get_statistics(point_id)

        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# Engineering Metrics Endpoints
# =====================================================

@metrics_bp.route('/engineering/<point_id>', methods=['GET'])
def get_engineering_metrics(point_id: str):
    """Get engineering metrics for a point"""
    try:
        metric_type = request.args.get('type')
        limit = int(request.args.get('limit', 100))

        model = EngineeringMetricModel()
        metrics = model.get_by_point(
            point_id=point_id,
            metric_type=metric_type,
            limit=limit
        )

        return jsonify({
            'success': True,
            'data': metrics,
            'count': len(metrics)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/engineering/<point_id>/latest', methods=['GET'])
def get_latest_metric(point_id: str):
    """Get latest engineering metric for a point"""
    try:
        metric_type = request.args.get('type')

        model = EngineeringMetricModel()
        metric = model.get_latest(point_id, metric_type)

        if not metric:
            return jsonify({
                'success': False,
                'error': 'No metrics found'
            }), 404

        return jsonify({
            'success': True,
            'data': metric
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/engineering/<point_id>/calculate', methods=['POST'])
def calculate_metrics(point_id: str):
    """Calculate metrics for a point"""
    try:
        data = request.get_json() or {}
        hours = int(data.get('hours', 24))
        metric_type = data.get('metric_type')
        save = data.get('save', True)

        engine = get_engine()

        if metric_type:
            result = engine.calculate_metric_for_point(
                point_id=point_id,
                metric_type=metric_type,
                hours=hours,
                save=save
            )
            results = {metric_type: {
                'value': result.value,
                'unit': result.unit,
                'threshold_status': result.threshold_status,
                'calculation_method': result.calculation_method,
                'data_point_count': result.data_point_count,
                'quality_score': result.quality_score,
                'error': result.error
            }}
        else:
            calc_results = engine.calculate_all_metrics_for_point(
                point_id=point_id,
                hours=hours,
                save=save
            )
            results = {
                k: {
                    'value': v.value,
                    'unit': v.unit,
                    'threshold_status': v.threshold_status,
                    'calculation_method': v.calculation_method,
                    'data_point_count': v.data_point_count,
                    'quality_score': v.quality_score,
                    'error': v.error
                }
                for k, v in calc_results.items()
            }

        return jsonify({
            'success': True,
            'data': results
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/engineering/process-all', methods=['POST'])
def process_all_points():
    """Process metrics for all active points"""
    try:
        data = request.get_json() or {}
        hours = int(data.get('hours', 24))
        save = data.get('save', True)

        engine = get_engine()
        results = engine.process_all_active_points(hours=hours, save=save)

        # Simplify results for response
        summary = {}
        for point_id, metrics in results.items():
            summary[point_id] = {
                k: {
                    'value': v.value,
                    'status': v.threshold_status,
                    'error': v.error
                }
                for k, v in metrics.items()
            }

        return jsonify({
            'success': True,
            'data': summary,
            'points_processed': len(results)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/engineering/alerts', methods=['GET'])
def get_alerts():
    """Get current alerts (warnings and criticals)"""
    try:
        hours = int(request.args.get('hours', 24))

        engine = get_engine()
        summary = engine.get_alerts_summary(hours=hours)

        return jsonify({
            'success': True,
            'data': summary
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# Metric Configuration Endpoints
# =====================================================

@metrics_bp.route('/configs', methods=['GET'])
def get_metric_configs():
    """Get all metric configurations"""
    try:
        active_only = request.args.get('active_only', 'true').lower() == 'true'

        model = MetricConfigModel()
        configs = model.get_all(active_only=active_only)

        return jsonify({
            'success': True,
            'data': configs,
            'count': len(configs)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/configs/<metric_type>', methods=['GET'])
def get_metric_config(metric_type: str):
    """Get configuration for a specific metric type"""
    try:
        model = MetricConfigModel()
        config = model.get_by_type(metric_type)

        if not config:
            return jsonify({
                'success': False,
                'error': f'Config not found for {metric_type}'
            }), 404

        return jsonify({
            'success': True,
            'data': config
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/configs', methods=['POST'])
def create_metric_config():
    """Create a new metric configuration"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        required = ['metric_type', 'metric_name', 'calculation_method']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing}'
            }), 400

        model = MetricConfigModel()
        result = model.create(data)

        return jsonify({
            'success': True,
            'data': result
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/configs/<metric_type>', methods=['PUT'])
def update_metric_config(metric_type: str):
    """Update a metric configuration"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        model = MetricConfigModel()
        result = model.update(metric_type, data)

        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# Alert Rules Endpoints
# =====================================================

@metrics_bp.route('/alert-rules', methods=['GET'])
def get_alert_rules():
    """Get all alert rules"""
    try:
        active_only = request.args.get('active_only', 'true').lower() == 'true'

        model = AlertRuleModel()
        rules = model.get_all(active_only=active_only)

        return jsonify({
            'success': True,
            'data': rules,
            'count': len(rules)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/alert-rules', methods=['POST'])
def create_alert_rule():
    """Create a new alert rule"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        required = ['rule_name', 'trigger_metric_type', 'condition_type', 'condition_params']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {missing}'
            }), 400

        model = AlertRuleModel()
        result = model.create(data)

        return jsonify({
            'success': True,
            'data': result
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/alert-rules/<int:rule_id>', methods=['PUT'])
def update_alert_rule(rule_id: int):
    """Update an alert rule"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        model = AlertRuleModel()
        result = model.update(rule_id, data)

        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# Snapshot Endpoints
# =====================================================

@metrics_bp.route('/snapshots', methods=['GET'])
def get_snapshots():
    """Get recent snapshots"""
    try:
        hours = int(request.args.get('hours', 24))
        limit = int(request.args.get('limit', 100))
        snapshot_type = request.args.get('type')

        model = MetricSnapshotModel()

        if snapshot_type:
            snapshots = model.get_by_type(snapshot_type, limit=limit)
        else:
            snapshots = model.get_recent(hours=hours, limit=limit)

        return jsonify({
            'success': True,
            'data': snapshots,
            'count': len(snapshots)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/snapshots', methods=['POST'])
def create_snapshot():
    """Create a new snapshot"""
    try:
        data = request.get_json() or {}

        snapshot_type = data.get('snapshot_type', 'manual')
        point_ids = data.get('point_ids')
        ticket_id = data.get('ticket_id')
        ticket_number = data.get('ticket_number')
        hours = int(data.get('hours', 24))
        expires_in_days = int(data.get('expires_in_days', 90))
        created_by = data.get('created_by')

        engine = get_engine()
        snapshot = engine.create_snapshot(
            snapshot_type=snapshot_type,
            point_ids=point_ids,
            ticket_id=ticket_id,
            ticket_number=ticket_number,
            hours=hours,
            expires_in_days=expires_in_days,
            created_by=created_by
        )

        return jsonify({
            'success': True,
            'data': snapshot
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/snapshots/ticket/<int:ticket_id>', methods=['GET'])
def get_snapshots_by_ticket(ticket_id: int):
    """Get snapshots associated with a ticket"""
    try:
        model = MetricSnapshotModel()
        snapshots = model.get_by_ticket(ticket_id)

        return jsonify({
            'success': True,
            'data': snapshots,
            'count': len(snapshots)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/snapshots/cleanup', methods=['POST'])
def cleanup_expired_snapshots():
    """Delete expired snapshots"""
    try:
        model = MetricSnapshotModel()
        result = model.cleanup_expired()

        return jsonify({
            'success': True,
            'message': 'Expired snapshots cleaned up'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =====================================================
# Engine Control Endpoints
# =====================================================

@metrics_bp.route('/engine/status', methods=['GET'])
def get_engine_status():
    """Get metrics engine status"""
    try:
        engine = get_engine()

        return jsonify({
            'success': True,
            'data': {
                'background_processing': engine._processing_thread is not None and engine._processing_thread.is_alive(),
                'processing_interval': engine._processing_interval,
                'config_cache_size': len(engine._config_cache),
                'config_cache_age': (
                    (datetime.utcnow() - engine._config_cache_time).total_seconds()
                    if engine._config_cache_time else None
                )
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/engine/start', methods=['POST'])
def start_engine():
    """Start background processing"""
    try:
        data = request.get_json() or {}
        interval = int(data.get('interval', 60))

        engine = get_engine()
        engine.start_background_processing(interval_seconds=interval)

        return jsonify({
            'success': True,
            'message': f'Background processing started with {interval}s interval'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@metrics_bp.route('/engine/stop', methods=['POST'])
def stop_engine():
    """Stop background processing"""
    try:
        engine = get_engine()
        engine.stop_background_processing()

        return jsonify({
            'success': True,
            'message': 'Background processing stopped'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
