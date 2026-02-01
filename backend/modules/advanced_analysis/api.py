# -*- coding: utf-8 -*-
"""
Advanced Analysis API Routes
"""

from flask import Blueprint, jsonify, request
from .profile_service import ProfileService
from .joint_service import JointAnalysisService
from .event_service import EventService

advanced_bp = Blueprint('advanced', __name__, url_prefix='/api/advanced')

# Initialize services
profile_service = ProfileService()
joint_service = JointAnalysisService()
event_service = EventService()


# =====================================================
# Profile APIs
# =====================================================

@advanced_bp.route('/profile/config', methods=['GET'])
def get_profile_config():
    """Get tunnel profile configuration (point -> chainage mapping)"""
    try:
        config = profile_service.get_profile_config()
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/profile/layers', methods=['GET'])
def get_geological_layers():
    """Get geological layers for profile background"""
    try:
        layers = profile_service.get_geological_layers()
        return jsonify(layers)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/profile/data', methods=['GET'])
def get_profile_data():
    """
    Get profile data for a specific date
    Query params:
        - date: YYYY-MM-DD (optional, defaults to latest)
    """
    try:
        date = request.args.get('date')
        data = profile_service.get_profile_data(date)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/profile/dates', methods=['GET'])
def get_available_dates():
    """Get list of available dates for profile visualization"""
    try:
        dates = profile_service.get_available_dates()
        return jsonify({'dates': dates})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/profile/animation', methods=['GET'])
def get_profile_animation():
    """
    Get profile data for animation
    Query params:
        - start: Start date YYYY-MM-DD
        - end: End date YYYY-MM-DD
        - interval: Days between frames (default 7)
    """
    try:
        start = request.args.get('start')
        end = request.args.get('end')
        interval = int(request.args.get('interval', 7))

        if not start or not end:
            return jsonify({'error': 'start and end dates required'}), 400

        frames = profile_service.get_profile_animation_data(start, end, interval)
        return jsonify({'frames': frames})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/profile/statistics', methods=['GET'])
def get_profile_statistics():
    """Get summary statistics for the profile"""
    try:
        stats = profile_service.get_profile_statistics()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# Joint Analysis APIs
# =====================================================

@advanced_bp.route('/joint/mapping', methods=['GET'])
def get_joint_mapping():
    """Get settlement-crack point mapping"""
    try:
        mapping = joint_service.get_mapping()
        return jsonify(mapping)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/joint/data/<settlement_point>', methods=['GET'])
def get_joint_data(settlement_point):
    """Get joint time series for a settlement point and related cracks"""
    try:
        data = joint_service.get_joint_time_series(settlement_point)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/joint/correlation/<settlement_point>', methods=['GET'])
def get_joint_correlation(settlement_point):
    """Analyze correlation between settlement and crack changes"""
    try:
        analysis = joint_service.analyze_correlation(settlement_point)
        return jsonify(analysis)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/joint/alerts', methods=['GET'])
def get_joint_alerts():
    """Get joint alerts where both settlement and crack are abnormal"""
    try:
        alerts = joint_service.get_joint_alerts()
        return jsonify({'alerts': alerts, 'count': len(alerts)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/joint/summary', methods=['GET'])
def get_joint_summary():
    """Get summary of joint analysis data"""
    try:
        summary = joint_service.get_summary()
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =====================================================
# Construction Event APIs
# =====================================================

@advanced_bp.route('/events/types', methods=['GET'])
def get_event_types():
    """Get available event types"""
    try:
        types = event_service.get_event_types()
        return jsonify(types)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events', methods=['GET'])
def list_events():
    """
    List construction events
    Query params:
        - start: Start date filter
        - end: End date filter
        - type: Event type filter
    """
    try:
        start = request.args.get('start')
        end = request.args.get('end')
        event_type = request.args.get('type')

        events = event_service.list_events(
            start_date=start,
            end_date=end,
            event_type=event_type
        )
        return jsonify({'events': events, 'count': len(events)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    """Get a single event by ID"""
    try:
        event = event_service.get_event(event_id)
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        return jsonify(event)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events', methods=['POST'])
def create_event():
    """Create a new construction event"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        required = ['event_date', 'event_type', 'title']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        event = event_service.create_event(data)
        return jsonify(event), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events/<int:event_id>', methods=['PUT', 'PATCH'])
def update_event(event_id):
    """Update an existing event"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        event = event_service.update_event(event_id, data)
        return jsonify(event)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    """Delete an event"""
    try:
        event_service.delete_event(event_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events/<int:event_id>/impact', methods=['GET'])
def analyze_event_impact(event_id):
    """
    Analyze the impact of a construction event on settlement
    Query params:
        - window: Analysis window in hours (default 72)
    """
    try:
        window = request.args.get('window', type=int)
        analysis = event_service.analyze_event_impact(event_id, window)
        return jsonify(analysis)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events/timeline', methods=['GET'])
def get_events_timeline():
    """
    Get events for timeline overlay
    Query params:
        - start: Start date
        - end: End date
    """
    try:
        start = request.args.get('start')
        end = request.args.get('end')

        if not start or not end:
            return jsonify({'error': 'start and end dates required'}), 400

        timeline = event_service.get_events_for_timeline(start, end)
        return jsonify({'events': timeline})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/events/summary', methods=['GET'])
def get_events_summary():
    """Get summary of construction events"""
    try:
        summary = event_service.get_summary()
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
