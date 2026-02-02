# -*- coding: utf-8 -*-
"""
机器学习API模块
提供智能预测、异常检测、空间关联分析、因果推断等高级功能
"""
from flask import Blueprint, jsonify, request
import mysql.connector
import pandas as pd
import numpy as np
from datetime import datetime
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 导入ML模块
from modules.ml_models.anomaly_detector import AnomalyDetector, detect_anomalies_for_point
from modules.ml_models.time_series_predictor import TimeSeriesPredictor, predict_settlement
from modules.ml_models.spatial_correlation import SpatialCorrelationAnalyzer, analyze_spatial_correlation
from modules.ml_models.causal_inference import CausalInference, analyze_event_impact
from modules.ml_models.model_selector import ModelSelector, auto_predict

try:
    from modules.ml_models.prophet_predictor import ProphetPredictor, predict_with_prophet, PROPHET_AVAILABLE
except:
    PROPHET_AVAILABLE = False

from modules.database.db_config import db_config

# 创建蓝图
ml_api = Blueprint('ml_api', __name__, url_prefix='/api/ml')


def get_db_connection():
    """创建数据库连接"""
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except Exception as e:
        print(f"[错误] 数据库连接失败: {str(e)}")
        return None


# =========================================================
# 1. 智能预测API（自动选择最优模型）
# =========================================================

@ml_api.route('/auto-predict/<point_id>', methods=['GET'])
def api_auto_predict(point_id):
    """
    自动选择最优模型并预测

    参数:
        point_id: 监测点ID
        steps: 预测步数（默认30天）
        metric: 评估指标（mae/rmse/mape，默认mae）
    """
    try:
        steps = int(request.args.get('steps', 30))
        metric = request.args.get('metric', 'mae')

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        result = auto_predict(point_id, conn, steps=steps, metric=metric)
        conn.close()

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/predict/<point_id>', methods=['GET'])
def api_predict(point_id):
    """
    使用指定模型预测

    参数:
        point_id: 监测点ID
        model: 模型类型（arima/sarima/prophet，默认arima）
        steps: 预测步数（默认30天）
    """
    try:
        model_type = request.args.get('model', 'arima')
        steps = int(request.args.get('steps', 30))

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        if model_type == 'prophet':
            if not PROPHET_AVAILABLE:
                return jsonify({
                    'success': False,
                    'message': 'Prophet未安装，请运行: pip install prophet'
                }), 400
            result = predict_with_prophet(point_id, conn, steps=steps)
        else:
            result = predict_settlement(point_id, conn, model_type=model_type, steps=steps)

        conn.close()

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 2. 智能异常检测API
# =========================================================

@ml_api.route('/anomalies/<point_id>', methods=['GET'])
def api_detect_anomalies(point_id):
    """
    检测异常点

    参数:
        point_id: 监测点ID
        method: 检测方法（isolation_forest/lof，默认isolation_forest）
        contamination: 异常比例（默认0.05）
    """
    try:
        method = request.args.get('method', 'isolation_forest')
        contamination = float(request.args.get('contamination', 0.05))

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        result = detect_anomalies_for_point(point_id, conn, method=method,
                                           contamination=contamination)
        conn.close()

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/anomalies/batch', methods=['POST'])
def api_batch_detect_anomalies():
    """
    批量检测多个监测点的异常

    请求体:
        {
            "point_ids": ["S1", "S2", "S3"],
            "method": "isolation_forest",
            "contamination": 0.05
        }
    """
    try:
        data = request.get_json()
        point_ids = data.get('point_ids', [])
        method = data.get('method', 'isolation_forest')
        contamination = data.get('contamination', 0.05)

        if not point_ids:
            return jsonify({'success': False, 'message': '未提供监测点ID'}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        results = []
        for point_id in point_ids:
            result = detect_anomalies_for_point(point_id, conn, method=method,
                                               contamination=contamination)
            results.append(result)

        conn.close()

        # 汇总统计
        total_anomalies = sum(r.get('anomaly_count', 0) for r in results if r.get('success'))

        return jsonify({
            'success': True,
            'results': results,
            'summary': {
                'total_points': len(point_ids),
                'total_anomalies': total_anomalies
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 3. 空间关联分析API
# =========================================================

@ml_api.route('/spatial/correlation', methods=['GET'])
def api_spatial_correlation():
    """
    分析所有监测点的空间关联

    参数:
        distance_threshold: 距离阈值（米，默认50）
    """
    try:
        distance_threshold = float(request.args.get('distance_threshold', 50.0))

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        result = analyze_spatial_correlation(conn, distance_threshold=distance_threshold)
        conn.close()

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/spatial/influence/<int:source_point_idx>', methods=['GET'])
def api_influence_propagation(source_point_idx):
    """
    分析异常从源点的影响传播路径

    参数:
        source_point_idx: 源点索引
        distance_threshold: 距离阈值（米，默认50）
    """
    try:
        distance_threshold = float(request.args.get('distance_threshold', 50.0))

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        # 查询监测点坐标
        query_points = """
            SELECT DISTINCT point_id, x_coord, y_coord
            FROM monitoring_points
            ORDER BY point_id
        """
        points_df = pd.read_sql(query_points, conn)
        coordinates = list(zip(points_df['x_coord'], points_df['y_coord']))

        # 查询沉降数据
        query_settlement = """
            SELECT point_id, measurement_date, cumulative_change
            FROM processed_settlement_data
            ORDER BY point_id, measurement_date
        """
        settlement_df = pd.read_sql(query_settlement, conn)
        pivot_df = settlement_df.pivot(index='measurement_date',
                                       columns='point_id',
                                       values='cumulative_change')
        settlement_matrix = pivot_df.values.T

        # 分析影响传播
        analyzer = SpatialCorrelationAnalyzer(distance_threshold=distance_threshold)
        propagation = analyzer.analyze_influence_propagation(
            source_point_idx, coordinates, settlement_matrix
        )

        conn.close()

        return jsonify({
            'success': True,
            'source_point_idx': source_point_idx,
            'propagation_path': propagation
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 4. 因果推断API（施工事件影响量化）
# =========================================================

@ml_api.route('/causal/event-impact', methods=['POST'])
def api_event_impact():
    """
    分析施工事件的因果影响

    请求体:
        {
            "point_id": "S1",
            "event_date": "2024-06-15",
            "control_point_ids": ["S5", "S6", "S7"],  // 可选
            "method": "DID",  // DID或SCM
            "window_days": 30
        }
    """
    try:
        data = request.get_json()
        point_id = data.get('point_id')
        event_date = data.get('event_date')
        control_point_ids = data.get('control_point_ids')
        method = data.get('method', 'DID')
        window_days = data.get('window_days', 30)

        if not point_id or not event_date:
            return jsonify({
                'success': False,
                'message': '缺少必要参数：point_id和event_date'
            }), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        result = analyze_event_impact(
            point_id, event_date, conn,
            control_point_ids=control_point_ids,
            method=method,
            window_days=window_days
        )

        conn.close()

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 5. 模型对比API
# =========================================================

@ml_api.route('/compare-models/<point_id>', methods=['GET'])
def api_compare_models(point_id):
    """
    对比多个模型的性能

    参数:
        point_id: 监测点ID
    """
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'message': '数据库连接失败'}), 500

        # 查询数据
        query = """
            SELECT measurement_date as date, cumulative_change as settlement
            FROM processed_settlement_data
            WHERE point_id = %s
            ORDER BY measurement_date
        """
        df = pd.read_sql(query, conn, params=(point_id,))
        conn.close()

        if len(df) < 20:
            return jsonify({
                'success': False,
                'message': '数据量不足，至少需要20条记录'
            }), 400

        settlement_data = df['settlement'].values

        # 创建模型选择器并评估
        selector = ModelSelector()
        evaluation = selector.evaluate_models(settlement_data, test_size=0.2)
        characteristics = selector.analyze_data_characteristics(settlement_data)

        return jsonify({
            'success': True,
            'point_id': point_id,
            'data_characteristics': characteristics,
            'model_evaluation': evaluation
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 6. 健康检查API
# =========================================================

@ml_api.route('/health', methods=['GET'])
def api_health():
    """检查ML模块健康状态"""
    return jsonify({
        'success': True,
        'modules': {
            'anomaly_detector': True,
            'time_series_predictor': True,
            'prophet': PROPHET_AVAILABLE,
            'spatial_correlation': True,
            'causal_inference': True,
            'model_selector': True
        },
        'message': 'ML模块运行正常'
    })


# 导出蓝图
__all__ = ['ml_api']
