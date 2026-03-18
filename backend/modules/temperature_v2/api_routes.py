# -*- coding: utf-8 -*-
"""
温度V2 API路由
提供科研算法 + 施工指导的 REST API
"""

from flask import Blueprint, request, jsonify
from modules.db.vendor import get_repo
from .algorithms import TemperatureAlgorithms
from .construction_guide import ConstructionGuide

temperature_v2_api = Blueprint('temperature_v2_api', __name__, url_prefix='/api')
repo = get_repo()
algo = TemperatureAlgorithms()
guide = ConstructionGuide()


def _sensor_time_series(sensor_id: str):
    """获取单个传感器的时间序列数据"""
    data = repo.temperature_get_data(sensor_id)
    rows = data.get('timeSeriesData', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    dates = []
    avg_vals = []
    max_vals = []
    min_vals = []
    for r in rows:
        d = r.get('measurement_date')
        if not d:
            continue
        dates.append(str(d)[:10])
        avg_vals.append(float(r.get('avg_temperature') or r.get('avg_temp') or 0))
        max_vals.append(float(r.get('max_temperature') or r.get('max_temp') or 0))
        min_vals.append(float(r.get('min_temperature') or r.get('min_temp') or 0))
    return dates, avg_vals, max_vals, min_vals


@temperature_v2_api.route('/temperature/v2/overview', methods=['GET'])
def v2_overview():
    """V2总览: KPI + 所有传感器状态"""
    try:
        summary = repo.temperature_get_summary()
        stats = repo.temperature_get_stats()
        points = repo.temperature_get_points()

        # 从最新数据计算施工指导
        conditions = {}
        if isinstance(stats, dict):
            conditions['ambient_temp'] = stats.get('current_avg')
            conditions['daily_range'] = stats.get('avg_range')
            conditions['ground_temp'] = stats.get('current_min')

        assessment = guide.full_assessment(conditions) if any(v is not None for v in conditions.values()) else None

        return jsonify({
            'success': True,
            'data': {
                'summary': summary if isinstance(summary, list) else [],
                'stats': stats if isinstance(stats, dict) else {},
                'points': points if isinstance(points, list) else [],
                'construction_assessment': assessment,
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})
@temperature_v2_api.route('/temperature/v2/stl/<sensor_id>', methods=['GET'])
def v2_stl(sensor_id):
    """STL季节性分解"""
    try:
        period = int(request.args.get('period', 7))
        dates, avg_vals, _, _ = _sensor_time_series(sensor_id)
        if len(dates) < 5:
            return jsonify({'success': False, 'message': '数据量不足'})
        result = algo.stl_decomposition(dates, avg_vals, period=period)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@temperature_v2_api.route('/temperature/v2/cusum/<sensor_id>', methods=['GET'])
def v2_cusum(sensor_id):
    """CUSUM变点检测"""
    try:
        k = float(request.args.get('k', 0.5))
        h = float(request.args.get('h', 3.0))
        dates, avg_vals, _, _ = _sensor_time_series(sensor_id)
        if len(dates) < 10:
            return jsonify({'success': False, 'message': '数据量不足'})
        result = algo.cusum_detection(dates, avg_vals, k=k, h=h)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@temperature_v2_api.route('/temperature/v2/freeze-thaw/<sensor_id>', methods=['GET'])
def v2_freeze_thaw(sensor_id):
    """冻融周期分析"""
    try:
        threshold = float(request.args.get('threshold', 0.0))
        dates, _, _, min_vals = _sensor_time_series(sensor_id)
        if len(dates) < 3:
            return jsonify({'success': False, 'message': '数据量不足'})
        result = algo.freeze_thaw_cycles(dates, min_vals, threshold=threshold)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@temperature_v2_api.route('/temperature/v2/maturity/<sensor_id>', methods=['GET'])
def v2_maturity(sensor_id):
    """养护成熟度追踪"""
    try:
        target = float(request.args.get('target', 4800))
        dates, avg_vals, _, _ = _sensor_time_series(sensor_id)
        if len(dates) < 2:
            return jsonify({'success': False, 'message': '数据量不足'})
        result = algo.curing_maturity(dates, avg_vals, target_maturity=target)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@temperature_v2_api.route('/temperature/v2/construction-guide', methods=['POST'])
def v2_construction_guide():
    """施工指导评估"""
    try:
        conditions = request.get_json(force=True) or {}
        result = guide.full_assessment(conditions)
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@temperature_v2_api.route('/temperature/v2/temp-correction', methods=['POST'])
def v2_temp_correction():
    """沉降温度修正计算"""
    try:
        body = request.get_json(force=True) or {}
        result = guide.temperature_correction(
            measured_settlement=float(body.get('measured', 0)),
            rod_length=float(body.get('rod_length', 10)),
            current_temp=float(body.get('current_temp', 20)),
            install_temp=float(body.get('install_temp', 20)),
            material=body.get('material', 'steel'),
        )
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@temperature_v2_api.route('/temperature/v2/gradient', methods=['GET'])
def v2_gradient():
    """温度梯度分析(全站)"""
    try:
        summary = repo.temperature_get_summary()
        if not isinstance(summary, list) or len(summary) < 2:
            return jsonify({'success': False, 'message': '传感器数据不足'})

        sensor_data = {}
        for row in summary:
            sid = str(row.get('sensor_id') or row.get('SID') or '')
            if not sid:
                continue
            sensor_data[sid] = {
                'current_temp': row.get('avg_temperature') or row.get('avg_temp'),
                'depth': row.get('depth', 0) or 0,
            }

        result = algo.temperature_gradient(sensor_data)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})
