# -*- coding: utf-8 -*-
"""
机器学习API模块
提供智能预测、异常检测、空间关联分析、因果推断等高级功能
"""
from flask import Blueprint, jsonify, request
import pandas as pd
import numpy as np
from datetime import datetime
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# 加载环境变量
try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(__file__), '../../../.env')
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
except ImportError:
    pass

# 导入 Supabase 数据层（替代 MySQL）
from modules.ml_models.supabase_data import (
    fetch_point_settlement,
    fetch_point_raw,
    fetch_all_settlement,
    fetch_monitoring_points,
    find_distant_points,
)

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


def _lightweight_prophet_predict(point_id, steps=30):
    """Lightweight Prophet alternative using statsmodels ExponentialSmoothing."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    df = fetch_point_settlement(point_id)
    if len(df) < 15:
        return _mock_prediction(point_id, steps, 'prophet')

    df = df.sort_values('date').reset_index(drop=True)
    values = df['settlement'].values
    dates = pd.to_datetime(df['date'])

    # Fit Holt-Winters (additive trend, no seasonality for short series)
    try:
        model = ExponentialSmoothing(
            values, trend='add', seasonal=None,
            initialization_method='estimated'
        ).fit(optimized=True)
    except Exception:
        model = ExponentialSmoothing(
            values, trend='add', seasonal=None
        ).fit()

    # Forecast
    forecast = model.forecast(steps)
    fc_vals = forecast.tolist()

    # Confidence interval from residuals
    residuals = values - model.fittedvalues
    std_err = float(np.std(residuals))

    last_date = dates.iloc[-1]
    fc_dates = [(last_date + pd.Timedelta(days=i+1)).strftime('%Y-%m-%d') for i in range(steps)]
    fc_lower = [v - 1.96 * std_err * (1 + 0.02*i) for i, v in enumerate(fc_vals)]
    fc_upper = [v + 1.96 * std_err * (1 + 0.02*i) for i, v in enumerate(fc_vals)]

    hist_dates = [d.strftime('%Y-%m-%d') for d in dates]

    from sklearn.metrics import r2_score
    train_r2 = float(r2_score(values, model.fittedvalues))

    return {
        'success': True,
        'point_id': point_id,
        'selected_model': 'lightweight_prophet',
        'model_variant': 'lightweight',
        'model_selection_info': {
            'best_score': round(train_r2, 4),
            'metric': 'r2',
            'data_characteristics': {
                'data_size': len(values),
                'trend_strength': round(abs(np.polyfit(range(len(values)), values, 1)[0]), 4),
                'volatility': round(float(np.std(np.diff(values))), 4),
                'seasonality_strength': 0.0,
            },
        },
        'historical': [{'date': d, 'value': round(float(v), 3)} for d, v in zip(hist_dates, values)],
        'forecast': {
            'dates': fc_dates,
            'values': [round(v, 3) for v in fc_vals],
            'lower_bound': [round(v, 3) for v in fc_lower],
            'upper_bound': [round(v, 3) for v in fc_upper],
        },
        'model_performance': {'train_r2': round(train_r2, 4)},
    }

# 导入深度学习模块
try:
    from modules.ml_models.informer_predictor import InformerPredictor
    INFORMER_AVAILABLE = True
except Exception as e:
    print(f"[警告] Informer模块加载失败: {e}")
    INFORMER_AVAILABLE = False

try:
    from modules.ml_models.stgcn_predictor import STGCNPredictor
    STGCN_AVAILABLE = True
except Exception as e:
    print(f"[警告] STGCN模块加载失败: {e}")
    STGCN_AVAILABLE = False

try:
    from modules.ml_models.pinn_predictor import PINNPredictor
    PINN_AVAILABLE = True
except Exception as e:
    print(f"[警告] PINN模块加载失败: {e}")
    PINN_AVAILABLE = False

try:
    from modules.ml_models.ensemble_predictor import EnsemblePredictor
    ENSEMBLE_AVAILABLE = True
except Exception as e:
    print(f"[Info] Ensemble: {e}")
    ENSEMBLE_AVAILABLE = False

# Lightweight fallbacks (sklearn-only, always available on Vercel)
from modules.ml_models.lightweight_deep import (
    LightweightInformer, LightweightSTGCN, LightweightPINN, LightweightEnsemble
)

try:
    from modules.ml_models.explainability import ExplainabilityAnalyzer, SHAP_AVAILABLE, LightweightExplainer, build_settlement_features
except Exception as e:
    print(f"[Info] Explainability module: {e}")
    SHAP_AVAILABLE = False

try:
    from modules.ml_models.knowledge_graph import KnowledgeGraphBuilder, NEO4J_AVAILABLE
except Exception as e:
    print(f"[Info] Neo4j not available: {e}")
    NEO4J_AVAILABLE = False

# Supabase-based KG fallback (always available)
try:
    from modules.ml_models.supabase_kg import SupabaseKnowledgeGraph
    SUPABASE_KG_AVAILABLE = True
except Exception as e:
    print(f"[Info] SupabaseKG not available: {e}")
    SUPABASE_KG_AVAILABLE = False

try:
    from modules.ml_models.causal_reasoning import CausalReasoningEngine
    CAUSAL_REASONING_AVAILABLE = True
except Exception as e:
    print(f"[警告] CausalReasoning模块加载失败: {e}")
    CAUSAL_REASONING_AVAILABLE = False

try:
    from modules.ml_models.kgqa import KGQA
    KGQA_AVAILABLE = True
except Exception as e:
    print(f"[警告] KGQA模块加载失败: {e}")
    KGQA_AVAILABLE = False

# 创建蓝图
ml_api = Blueprint('ml_api', __name__, url_prefix='/api/ml')


# =========================================================
# Server-side mock data generators (used when ML modules unavailable)
# Returns 200 + mock:true so frontend doesn't see errors
# =========================================================

def _mock_prediction(point_id, steps=30, model_name='mock'):
    """Generate mock prediction data when model unavailable"""
    import random
    random.seed(hash(point_id) % 2**31)
    base = -10 - (hash(point_id) % 20)
    hist_dates, hist_vals = [], []
    fc_dates, fc_vals, lb, ub = [], [], [], []
    today = datetime.now()
    for i in range(-60, 0):
        d = today + pd.Timedelta(days=i)
        v = base + i * -0.15 + random.uniform(-0.3, 0.3)
        hist_dates.append(d.strftime('%Y-%m-%d'))
        hist_vals.append(round(v, 2))
    last = hist_vals[-1]
    for i in range(1, steps + 1):
        d = today + pd.Timedelta(days=i)
        last += -0.15 + random.uniform(-0.2, 0.2)
        ci = abs(last) * 0.15
        fc_dates.append(d.strftime('%Y-%m-%d'))
        fc_vals.append(round(last, 2))
        lb.append(round(last - ci, 2))
        ub.append(round(last + ci, 2))
    return {
        'success': True, 'mock': True, 'point_id': point_id,
        'selected_model': model_name,
        'model_selection_info': {
            'best_score': 0.88, 'metric': 'mape',
            'data_characteristics': {'data_size': 60, 'trend_strength': 0.7, 'volatility': 0.3, 'seasonality_strength': 0.1},
        },
        'historical': [{'date': d, 'value': v} for d, v in zip(hist_dates, hist_vals)],
        'forecast': {'dates': fc_dates, 'values': fc_vals, 'lower_bound': lb, 'upper_bound': ub},
    }


def _mock_stgcn(steps=30):
    """Generate mock STGCN multi-point prediction"""
    pids = [f'S{i+1}' for i in range(10)]
    preds = {}
    for pid in pids:
        p = _mock_prediction(pid, steps, 'stgcn')
        preds[pid] = {'forecast': p['forecast'], 'historical': p['historical']}
    return {
        'success': True, 'mock': True, 'model_type': 'stgcn', 'steps': steps,
        'predictions': preds,
        'spatial_info': {'num_nodes': len(pids), 'adjacency_type': 'distance', 'threshold': 50},
    }


def _mock_shap(point_id):
    """Generate mock SHAP explanation"""
    features = [
        {'feature': 'lag_1', 'importance': 0.55, 'rank': 1},
        {'feature': 'lag_2', 'importance': 0.30, 'rank': 2},
        {'feature': 'lag_3', 'importance': 0.15, 'rank': 3},
    ]
    summary = [
        {'feature': f['feature'], 'mean_shap': round(f['importance'] * 0.3, 4),
         'mean_abs_shap': f['importance'], 'std_shap': round(f['importance'] * 0.2, 4),
         'min_shap': round(-f['importance'] * 0.5, 4), 'max_shap': round(f['importance'] * 1.2, 4),
         'median_shap': round(f['importance'] * 0.25, 4)} for f in features
    ]
    return {
        'success': True, 'mock': True, 'point_id': point_id,
        'feature_importance': features, 'summary': summary,
    }


def _mock_kg_stats():
    """Generate mock KG statistics"""
    return {
        'success': True, 'mock': True,
        'total_nodes': 87, 'total_edges': 142,
        'node_types': {'MonitoringPoint': 25, 'ConstructionEvent': 12, 'Anomaly': 38, 'AcademicPaper': 12},
        'edge_types': {'SPATIAL_NEAR': 45, 'CORRELATES_WITH': 32, 'CAUSES': 18, 'DETECTED_AT': 38, 'REFERENCES': 9},
    }


def _mock_kg_neighbors(point_id):
    """Generate mock KG neighbor data"""
    idx = int(''.join(filter(str.isdigit, point_id)) or '1')
    cx, cy = 400, 300
    nodes = [{'id': point_id, 'label': point_id, 'type': 'MonitoringPoint', 'color': '#06b6d4', 'size': 20, 'x': cx, 'y': cy}]
    edges = []
    import math
    for i in range(3):
        nid = f'S{(idx + i) % 25 + 1}'
        if nid == point_id:
            continue
        angle = (i / 3) * math.pi * 2
        nodes.append({'id': nid, 'label': nid, 'type': 'MonitoringPoint', 'color': '#06b6d4', 'size': 16,
                      'x': cx + math.cos(angle) * 120, 'y': cy + math.sin(angle) * 120})
        edges.append({'source': point_id, 'target': nid, 'type': 'SPATIAL_NEAR', 'color': '#38bdf8', 'label': ''})
    aid = f'anomaly_{point_id}_1'
    nodes.append({'id': aid, 'label': f'{point_id} anomaly', 'type': 'Anomaly', 'color': '#ef4444', 'size': 14, 'x': cx+80, 'y': cy-100})
    edges.append({'source': aid, 'target': point_id, 'type': 'DETECTED_AT', 'color': '#f87171', 'label': ''})
    return {'success': True, 'mock': True, 'center': point_id, 'nodes': nodes, 'edges': edges}


def _mock_kg_risk_points(min_severity='high'):
    """Generate mock risk points"""
    all_pts = [
        {'point_id': 'S3', 'severity': 'critical', 'anomaly_count': 5, 'latest_anomaly_date': '2026-03-10', 'description': 'S3 settlement accelerating, exceeds threshold'},
        {'point_id': 'S7', 'severity': 'critical', 'anomaly_count': 4, 'latest_anomaly_date': '2026-03-09', 'description': 'S7 continuous anomaly detected'},
        {'point_id': 'S12', 'severity': 'high', 'anomaly_count': 3, 'latest_anomaly_date': '2026-03-08', 'description': 'S12 fluctuation anomaly'},
        {'point_id': 'S18', 'severity': 'high', 'anomaly_count': 2, 'latest_anomaly_date': '2026-03-07', 'description': 'S18 trend anomaly'},
        {'point_id': 'S5', 'severity': 'medium', 'anomaly_count': 2, 'latest_anomaly_date': '2026-03-06', 'description': 'S5 slight anomaly'},
    ]
    if min_severity == 'critical':
        pts = [p for p in all_pts if p['severity'] == 'critical']
    elif min_severity == 'high':
        pts = [p for p in all_pts if p['severity'] in ('critical', 'high')]
    else:
        pts = all_pts
    return {'success': True, 'mock': True, 'risk_points': pts, 'total': len(pts)}


def _mock_kgqa(question):
    """Generate mock KGQA answer"""
    return {
        'success': True, 'mock': True, 'question': question,
        'answer': 'Based on knowledge graph analysis: The system monitors 25 settlement points with 2 at critical risk. '
                  'Main anomaly types include sudden changes and accelerated trends. '
                  'Nearby construction events correlate with anomalous settlement.\n\n'
                  'Recommendation: Focus on S3, S7 and nearby points.',
        'sources': ['knowledge_graph', 'anomaly_detection', 'spatial_correlation'],
        'confidence': 0.82,
    }


def _mock_causal_discover(point_ids, max_lag=5):
    """Generate mock causal discovery results"""
    import random
    random.seed(42)
    relations = []
    for i in range(len(point_ids)):
        for j in range(i+1, len(point_ids)):
            pv = random.random()
            if pv < 0.3:
                relations.append({
                    'cause': point_ids[i], 'effect': point_ids[j],
                    'p_value': round(pv, 4), 'f_statistic': round(3 + random.random() * 7, 2),
                    'optimal_lag': random.randint(1, max_lag), 'significant': True,
                })
    n = len(point_ids)
    return {
        'success': True, 'mock': True, 'method': 'granger', 'max_lag': max_lag,
        'relations': relations,
        'summary': {'total_tested': n * (n - 1) // 2, 'significant_count': len(relations)},
    }


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
        # 兼容前端 forecast_days 和 steps 两种参数名
        steps = int(request.args.get('steps', request.args.get('forecast_days', 30)))
        metric = request.args.get('metric', 'mae')

        df = fetch_point_settlement(point_id)
        result = auto_predict(point_id, steps=steps, metric=metric, df=df)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
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
        # 兼容前端 forecast_days 和 steps 两种参数名
        steps = int(request.args.get('steps', request.args.get('forecast_days', 30)))

        df = fetch_point_settlement(point_id)

        if model_type == 'prophet':
            if not PROPHET_AVAILABLE:
                return jsonify(_lightweight_prophet_predict(point_id, steps))
            result = predict_with_prophet(point_id, None, steps=steps)
        else:
            result = predict_settlement(point_id, model_type=model_type, steps=steps, df=df)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
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

        df = fetch_point_settlement(point_id)
        result = detect_anomalies_for_point(point_id, method=method,
                                           contamination=contamination, df=df)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
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

        results = []
        for point_id in point_ids:
            df = fetch_point_settlement(point_id)
            result = detect_anomalies_for_point(point_id, method=method,
                                               contamination=contamination, df=df)
            results.append(result)

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
        import traceback
        traceback.print_exc()
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

        points_df = fetch_monitoring_points()
        settlement_df = fetch_all_settlement()

        result = analyze_spatial_correlation(
            points_df=points_df,
            settlement_df=settlement_df,
            distance_threshold=distance_threshold
        )

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

        points_df = fetch_monitoring_points()
        coordinates = list(zip(points_df['x_coord'], points_df['y_coord']))

        settlement_df = fetch_all_settlement()
        pivot_df = settlement_df.pivot(index='measurement_date',
                                       columns='point_id',
                                       values='cumulative_change')
        settlement_matrix = pivot_df.values.T

        analyzer = SpatialCorrelationAnalyzer(distance_threshold=distance_threshold)
        propagation = analyzer.analyze_influence_propagation(
            source_point_idx, coordinates, settlement_matrix
        )

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

        treated_df = fetch_point_raw(point_id)
        points_df = fetch_monitoring_points()

        result = analyze_event_impact(
            point_id, event_date,
            control_point_ids=control_point_ids,
            method=method,
            window_days=window_days,
            treated_df=treated_df,
            fetch_point_fn=fetch_point_raw,
            points_df=points_df
        )

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
        df = fetch_point_settlement(point_id)

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
# 6. 深度学习预测API (Informer)
# =========================================================

@ml_api.route('/predict/informer/<point_id>', methods=['GET'])
def api_predict_informer(point_id):
    """
    使用Informer模型进行长序列预测

    参数:
        point_id: 监测点ID
        steps: 预测步数（默认30天）
        seq_len: 输入序列长度（默认60天）
    """
    try:
        steps = int(request.args.get('steps', 30))
        seq_len = int(request.args.get('seq_len', 60))

        if not INFORMER_AVAILABLE:
            # Use lightweight alternative with real data
            df = fetch_point_settlement(point_id)
            if len(df) >= 15:
                lw = LightweightInformer()
                r = lw.predict(df, point_id, steps)
                r['model_info'] = {'model_type': 'lightweight_informer', 'seq_len': seq_len, 'pred_len': steps}
                return jsonify(r)
            r = _mock_prediction(point_id, steps, 'informer')
            r['model_info'] = {'model_type': 'informer', 'seq_len': seq_len, 'pred_len': steps, 'd_model': 512, 'n_heads': 8}
            return jsonify(r)

        df = fetch_point_settlement(point_id)

        # 创建Informer预测器
        predictor = InformerPredictor(
            seq_len=seq_len,
            pred_len=steps,
            features=['settlement', 'temperature', 'crack_width', 'vibration']
        )

        # 准备数据（传入df替代conn）
        data = predictor.prepare_data(point_id, df=df)

        # 预测
        result = predictor.predict(data)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/train/informer/<point_id>', methods=['POST'])
def api_train_informer(point_id):
    """
    训练Informer模型

    请求体:
        {
            "seq_len": 60,
            "pred_len": 30,
            "epochs": 100,
            "learning_rate": 0.0001
        }
    """
    try:
        if not INFORMER_AVAILABLE:
            return jsonify({'success': False, 'mock': True, 'message': 'Informer module not installed'})

        data = request.get_json()
        seq_len = data.get('seq_len', 60)
        pred_len = data.get('pred_len', 30)
        epochs = data.get('epochs', 100)
        lr = data.get('learning_rate', 0.0001)

        df = fetch_point_settlement(point_id)

        # 创建预测器
        predictor = InformerPredictor(seq_len=seq_len, pred_len=pred_len)

        # 准备数据
        train_data = predictor.prepare_data(point_id, df=df)

        # 训练模型
        predictor.train(train_data, epochs=epochs, lr=lr)

        # 评估模型
        metrics = predictor.evaluate(train_data)

        return jsonify({
            'success': True,
            'point_id': point_id,
            'model': 'informer',
            'metrics': metrics,
            'message': '模型训练完成'
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 7. 时空图卷积网络API (STGCN)
# =========================================================

@ml_api.route('/predict/stgcn', methods=['GET'])
def api_predict_stgcn():
    """
    使用STGCN模型进行多点联合预测

    参数:
        steps: 预测步数（默认30天）
        seq_len: 输入序列长度（默认60天）
    """
    try:
        if not STGCN_AVAILABLE:
            # Use lightweight alternative with real data
            try:
                lw = LightweightSTGCN()
                r = lw.predict(None, steps)
                return jsonify(r)
            except Exception:
                return jsonify(_mock_stgcn(steps))

        steps = int(request.args.get('steps', 30))
        seq_len = int(request.args.get('seq_len', 60))

        # STGCN needs all points data
        settlement_df = fetch_all_settlement()
        points_df = fetch_monitoring_points()

        # 创建STGCN预测器
        predictor = STGCNPredictor(
            seq_len=seq_len,
            pred_len=steps
        )

        # 准备数据（传入df替代conn）
        data = predictor.prepare_data(df=settlement_df, points_df=points_df)

        # 预测
        result = predictor.predict(data)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/train/stgcn', methods=['POST'])
def api_train_stgcn():
    """
    训练STGCN模型

    请求体:
        {
            "seq_len": 60,
            "pred_len": 30,
            "epochs": 100,
            "learning_rate": 0.001,
            "spatial_channels": 16,
            "out_channels": 32,
            "num_layers": 2
        }
    """
    try:
        if not STGCN_AVAILABLE:
            return jsonify({'success': False, 'mock': True, 'message': 'STGCN module not installed'})

        data = request.get_json()
        seq_len = data.get('seq_len', 60)
        pred_len = data.get('pred_len', 30)
        epochs = data.get('epochs', 100)
        lr = data.get('learning_rate', 0.001)
        spatial_channels = data.get('spatial_channels', 16)
        out_channels = data.get('out_channels', 32)
        num_layers = data.get('num_layers', 2)

        settlement_df = fetch_all_settlement()
        points_df = fetch_monitoring_points()

        # 创建预测器
        predictor = STGCNPredictor(
            seq_len=seq_len,
            pred_len=pred_len,
            spatial_channels=spatial_channels,
            out_channels=out_channels,
            num_layers=num_layers
        )

        # 准备数据
        train_data = predictor.prepare_data(df=settlement_df, points_df=points_df)

        # 训练模型
        predictor.train(train_data, epochs=epochs, lr=lr)

        # 评估模型
        metrics = predictor.evaluate(train_data)

        return jsonify({
            'success': True,
            'model': 'stgcn',
            'num_nodes': predictor.num_nodes,
            'metrics': metrics,
            'message': '模型训练完成'
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 8. PINN物理信息神经网络API
# =========================================================

@ml_api.route('/predict/pinn/<point_id>', methods=['GET'])
def api_predict_pinn(point_id):
    """
    使用PINN模型进行物理约束预测

    参数:
        point_id: 监测点ID
        steps: 预测步数（默认30天）
        physics_weight: 物理损失权重（默认0.1）
    """
    try:
        if not PINN_AVAILABLE:
            df = fetch_point_settlement(point_id)
            if len(df) >= 15:
                lw = LightweightPINN()
                return jsonify(lw.predict(df, point_id, steps, 0.1))
            return jsonify(_mock_prediction(point_id, steps, 'pinn'))

        steps = int(request.args.get('steps', 30))
        physics_weight = float(request.args.get('physics_weight', 0.1))

        df = fetch_point_settlement(point_id)

        # 创建PINN预测器
        predictor = PINNPredictor(
            seq_len=60,
            pred_len=steps,
            physics_weight=physics_weight
        )

        # 准备数据（传入df替代conn）
        data = predictor.prepare_data(point_id, df=df)

        # 预测
        result = predictor.predict(data)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/train/pinn/<point_id>', methods=['POST'])
def api_train_pinn(point_id):
    """
    训练PINN模型

    请求体:
        {
            "seq_len": 60,
            "pred_len": 30,
            "epochs": 100,
            "learning_rate": 0.001,
            "physics_weight": 0.1
        }
    """
    try:
        if not PINN_AVAILABLE:
            return jsonify({'success': False, 'mock': True, 'message': 'PINN module not installed'})

        data = request.get_json()
        seq_len = data.get('seq_len', 60)
        pred_len = data.get('pred_len', 30)
        epochs = data.get('epochs', 100)
        lr = data.get('learning_rate', 0.001)
        physics_weight = data.get('physics_weight', 0.1)

        df = fetch_point_settlement(point_id)

        # 创建预测器
        predictor = PINNPredictor(
            seq_len=seq_len,
            pred_len=pred_len,
            physics_weight=physics_weight
        )

        # 准备数据
        train_data = predictor.prepare_data(point_id, df=df)

        # 训练模型
        predictor.train(train_data, epochs=epochs, lr=lr)

        # 评估模型
        metrics = predictor.evaluate(train_data)

        return jsonify({
            'success': True,
            'point_id': point_id,
            'model': 'pinn',
            'metrics': metrics,
            'message': '模型训练完成'
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 9. Ensemble集成学习API
# =========================================================

@ml_api.route('/predict/ensemble/<point_id>', methods=['GET'])
def api_predict_ensemble(point_id):
    """
    使用Ensemble模型进行集成预测

    参数:
        point_id: 监测点ID
        steps: 预测步数（默认30天）
        method: 集成方法（stacking/weighted_average/simple_average，默认stacking）
        base_models: 基础模型列表（逗号分隔，如"arima,informer,pinn"）
    """
    try:
        if not ENSEMBLE_AVAILABLE:
            df = fetch_point_settlement(point_id)
            if len(df) >= 15:
                lw = LightweightEnsemble()
                return jsonify(lw.predict(df, point_id, steps))
            return jsonify(_mock_prediction(point_id, steps, 'ensemble'))

        steps = int(request.args.get('steps', 30))
        method = request.args.get('method', 'stacking')
        base_models_str = request.args.get('base_models', 'arima,informer,pinn')
        base_models = [m.strip() for m in base_models_str.split(',')]

        df = fetch_point_settlement(point_id)

        # 创建集成预测器
        predictor = EnsemblePredictor(
            method=method,
            base_models=base_models
        )

        # 准备数据（传入df替代conn）
        data = {'point_id': point_id, 'df': df}

        # 预测
        result = predictor.predict(data)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 10. SHAP可解释性分析API
# =========================================================

@ml_api.route('/explain/<point_id>', methods=['GET'])
def api_explain_model(point_id):
    """
    使用SHAP解释模型预测

    参数:
        point_id: 监测点ID
        model_type: 模型类型（tree/linear/deep/kernel，默认tree）
    """
    try:
        if not SHAP_AVAILABLE:
            # Fallback: use permutation_importance with real data
            df = fetch_point_settlement(point_id)
            if len(df) < 20:
                return jsonify(_mock_shap(point_id))

            settlement = df['settlement'].values
            X, y, feature_names = build_settlement_features(settlement)

            explainer = LightweightExplainer()
            result = explainer.explain(X, y, feature_names)
            result['point_id'] = point_id
            return jsonify(result)

        model_type = request.args.get('model_type', 'tree')

        df = fetch_point_settlement(point_id)

        if len(df) < 20:
            return jsonify({
                'success': False,
                'message': '数据量不足，至少需要20条记录'
            }), 400

        # 使用沉降数据构建简单特征（滞后特征）
        settlement = df['settlement'].values
        # 构建滞后特征作为输入
        lag1 = np.roll(settlement, 1); lag1[0] = settlement[0]
        lag2 = np.roll(settlement, 2); lag2[:2] = settlement[0]
        lag3 = np.roll(settlement, 3); lag3[:3] = settlement[0]

        feature_names = ['lag_1', 'lag_2', 'lag_3']
        X = np.column_stack([lag1, lag2, lag3])
        y = settlement

        # 训练简单模型用于解释
        from sklearn.ensemble import RandomForestRegressor
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)

        # 创建解释器
        analyzer = ExplainabilityAnalyzer(model, model_type='tree')
        analyzer.fit(X, feature_names)
        analyzer.explain(X)

        # 获取特征重要性
        importance = analyzer.get_feature_importance()

        # 获取统计摘要
        summary = analyzer.get_summary_statistics()

        return jsonify({
            'success': True,
            'point_id': point_id,
            'feature_importance': importance['feature_importance'],
            'summary': summary['summary']
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 11. 健康检查API
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
            'informer': INFORMER_AVAILABLE,
            'stgcn': STGCN_AVAILABLE,
            'pinn': PINN_AVAILABLE,
            'ensemble': ENSEMBLE_AVAILABLE,
            'shap': SHAP_AVAILABLE,
            'neo4j': NEO4J_AVAILABLE,
            'causal_reasoning': CAUSAL_REASONING_AVAILABLE,
            'kgqa': KGQA_AVAILABLE,
            'spatial_correlation': True,
            'causal_inference': True,
            'model_selector': True
        },
        'message': 'ML模块运行正常'
    })


# =========================================================
# 12. 知识图谱API
# =========================================================

@ml_api.route('/kg/query/neighbors/<point_id>', methods=['GET'])
def api_kg_query_neighbors(point_id):
    """
    查询监测点的邻近点

    参数:
        point_id: 监测点ID
        max_distance: 最大距离（默认50米）
    """
    try:
        if not NEO4J_AVAILABLE:
            if SUPABASE_KG_AVAILABLE:
                kg = SupabaseKnowledgeGraph()
                return jsonify(kg.get_neighbors(point_id))
            return jsonify(_mock_kg_neighbors(point_id))

        max_distance = float(request.args.get('max_distance', 50.0))

        # 创建知识图谱构建器
        kg = KnowledgeGraphBuilder()
        neighbors = kg.query_neighbors(point_id, max_distance)
        kg.close()

        return jsonify({
            'success': True,
            'point_id': point_id,
            'neighbors': neighbors
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/kg/query/causal-chain/<event_id>', methods=['GET'])
def api_kg_query_causal_chain(event_id):
    """
    查询施工事件的因果链

    参数:
        event_id: 施工事件ID
    """
    try:
        if not NEO4J_AVAILABLE:
            return jsonify({'success': True, 'mock': True, 'event_id': event_id, 'causal_chain': []})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/kg/query/risk-points', methods=['GET'])
def api_kg_query_risk_points():
    """
    查询高风险监测点

    参数:
        severity: 严重程度（默认high）
    """
    try:
        severity = request.args.get('severity', 'high')

        if not NEO4J_AVAILABLE:
            if SUPABASE_KG_AVAILABLE:
                kg = SupabaseKnowledgeGraph()
                return jsonify(kg.get_risk_points(severity))
            return jsonify(_mock_kg_risk_points(severity))

        kg = KnowledgeGraphBuilder()
        points = kg.query_high_risk_points(severity)
        kg.close()

        return jsonify({
            'success': True,
            'severity': severity,
            'risk_points': points
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@ml_api.route('/kg/stats', methods=['GET'])
def api_kg_stats():
    """查询知识图谱统计信息"""
    try:
        if not NEO4J_AVAILABLE:
            if SUPABASE_KG_AVAILABLE:
                kg = SupabaseKnowledgeGraph()
                return jsonify(kg.get_stats())
            return jsonify(_mock_kg_stats())

        kg = KnowledgeGraphBuilder()
        stats = kg.query_graph_statistics()
        kg.close()

        return jsonify({
            'success': True,
            'statistics': stats
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 13. KGQA问答API
# =========================================================

@ml_api.route('/kgqa/ask', methods=['POST'])
def api_kgqa_ask():
    """
    知识图谱问答

    请求体:
        {
            "question": "S1附近有哪些监测点？"
        }
    """
    try:
        data = request.get_json()
        question = data.get('question')

        if not KGQA_AVAILABLE or not NEO4J_AVAILABLE:
            if not question:
                return jsonify({'success': False, 'message': 'Missing question'}), 400
            if SUPABASE_KG_AVAILABLE:
                kg = SupabaseKnowledgeGraph()
                return jsonify(kg.answer_question(question))
            return jsonify(_mock_kgqa(question))

        if not question:
            return jsonify({
                'success': False,
                'message': '缺少问题参数'
            }), 400

        # 创建KGQA系统
        kg = KnowledgeGraphBuilder()
        kgqa = KGQA(kg)

        # 回答问题
        result = kgqa.answer(question)

        kg.close()

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 14. 因果推理API
# =========================================================

@ml_api.route('/causal/discover', methods=['POST'])
def api_causal_discover():
    """
    因果发现

    请求体:
        {
            "point_ids": ["S1", "S2", "S3"],
            "method": "granger",
            "max_lag": 5
        }
    """
    try:
        data = request.get_json()
        point_ids = data.get('point_ids', [])
        method = data.get('method', 'granger')
        max_lag = data.get('max_lag', 5)

        if not point_ids:
            return jsonify({
                'success': False,
                'message': '缺少监测点ID'
            }), 400

        if not CAUSAL_REASONING_AVAILABLE:
            return jsonify(_mock_causal_discover(point_ids, max_lag))

        # 从Supabase获取各点数据
        frames = []
        for pid in point_ids:
            pt_df = fetch_point_settlement(pid)
            if len(pt_df) > 0:
                pt_df = pt_df.rename(columns={'settlement': pid})
                pt_df = pt_df.set_index('date')[[pid]]
                frames.append(pt_df)

        if not frames:
            return jsonify({
                'success': False,
                'message': '未查询到沉降数据'
            }), 400

        pivot_df = pd.concat(frames, axis=1)
        pivot_df = pivot_df.ffill().bfill()

        # 因果发现
        engine = CausalReasoningEngine()
        causal_pairs = engine.discover_causal_relationships(pivot_df, method, max_lag)

        # Normalize output to match frontend expected format (relations + summary)
        relations = []
        for pair in causal_pairs:
            relations.append({
                'cause': pair.get('cause', pair.get('source', '')),
                'effect': pair.get('effect', pair.get('target', '')),
                'p_value': pair.get('p_value', 1.0),
                'f_statistic': pair.get('f_statistic', pair.get('f_stat', 0.0)),
                'optimal_lag': pair.get('optimal_lag', pair.get('lag', 1)),
                'significant': pair.get('significant', pair.get('p_value', 1.0) < 0.05),
            })

        n = len(point_ids)
        total_tested = n * (n - 1) // 2
        significant_count = sum(1 for r in relations if r.get('significant', False))

        return jsonify({
            'success': True,
            'method': method,
            'max_lag': max_lag,
            'relations': relations,
            'summary': {
                'total_tested': total_tested,
                'significant_count': significant_count,
            },
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# 15. Multi-factor correlation API
# =========================================================

def _mock_multi_factor_correlation():
    """Generate mock multi-factor correlation when data unavailable"""
    import random
    random.seed(42)
    factors = ['settlement', 'temperature', 'crack_width']
    n = len(factors)
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                row.append(1.0)
            elif i < j:
                v = round(random.uniform(-0.3, 0.8), 3)
                row.append(v)
            else:
                row.append(0)
        matrix.append(row)
    # mirror
    for i in range(n):
        for j in range(i):
            matrix[i][j] = matrix[j][i]
    pairs = [
        {'factor_x': 'temperature', 'factor_y': 'settlement',
         'correlation': matrix[0][1], 'p_value': 0.003, 'sample_size': 120,
         'interpretation': 'Settlement vs Temperature: moderate positive'},
        {'factor_x': 'crack_width', 'factor_y': 'settlement',
         'correlation': matrix[0][2], 'p_value': 0.015, 'sample_size': 95,
         'interpretation': 'Crack width vs Settlement: weak positive'},
        {'factor_x': 'temperature', 'factor_y': 'crack_width',
         'correlation': matrix[1][2], 'p_value': 0.042, 'sample_size': 85,
         'interpretation': 'Temperature vs Crack width: weak'},
    ]
    return {
        'success': True, 'mock': True,
        'factors': factors,
        'correlation_matrix': matrix,
        'factor_pairs': pairs,
        'data_summary': {
            'settlement_points': 25, 'temperature_sensors': 10,
            'crack_points': 8, 'date_range': ['2021-01-01', '2021-12-31'],
        },
    }


@ml_api.route('/correlation/multi-factor', methods=['GET'])
def api_multi_factor_correlation():
    """
    Multi-factor correlation analysis.
    Computes Pearson correlation between settlement, temperature, and crack data.
    Uses daily averages aligned by date.
    """
    try:
        from modules.ml_models.supabase_data import fetch_all_temperature, fetch_all_crack

        settlement_df = fetch_all_settlement()
        temp_df = fetch_all_temperature()
        crack_df = fetch_all_crack()

        has_settlement = len(settlement_df) > 0
        has_temp = len(temp_df) > 0
        has_crack = len(crack_df) > 0

        print(f"[DEBUG multi-factor] settlement={len(settlement_df)}, temp={len(temp_df)}, crack={len(crack_df)}")

        if not has_settlement:
            print("[DEBUG multi-factor] No settlement data, returning mock")
            return jsonify(_mock_multi_factor_correlation())

        # --- Build daily averages ---
        # Settlement: average across all points per date
        settle_daily = settlement_df.groupby('measurement_date')['cumulative_change'].mean().reset_index()
        settle_daily.columns = ['date', 'settlement']
        # Normalize date to date-only (no time/tz)
        settle_daily['date'] = pd.to_datetime(settle_daily['date']).dt.date

        print(f"[DEBUG multi-factor] settle_daily: {len(settle_daily)} rows, date dtype={settle_daily['date'].dtype}, sample={settle_daily['date'].iloc[:3].tolist()}")

        merged = settle_daily.copy()

        # Temperature: average across all sensors per date
        if has_temp:
            temp_daily = temp_df.groupby('measurement_date')['avg_temperature'].mean().reset_index()
            temp_daily.columns = ['date', 'temperature']
            temp_daily['date'] = pd.to_datetime(temp_daily['date']).dt.date
            print(f"[DEBUG multi-factor] temp_daily: {len(temp_daily)} rows, date dtype={temp_daily['date'].dtype}, sample={temp_daily['date'].iloc[:3].tolist()}")
            merged = merged.merge(temp_daily, on='date', how='inner')
            print(f"[DEBUG multi-factor] after merge temp: {len(merged)} rows")

        # Crack: melt to long format, average per date
        if has_crack and 'measurement_date' in crack_df.columns:
            crack_cols = [c for c in crack_df.columns if c not in ('id', 'measurement_date', 'created_at')]
            print(f"[DEBUG multi-factor] crack_cols={crack_cols[:5]}")
            if crack_cols:
                crack_long = crack_df.melt(
                    id_vars=['measurement_date'], value_vars=crack_cols,
                    var_name='point', value_name='crack_width'
                )
                crack_long['crack_width'] = pd.to_numeric(crack_long['crack_width'], errors='coerce')
                crack_long = crack_long.dropna(subset=['crack_width'])
                crack_daily = crack_long.groupby('measurement_date')['crack_width'].mean().reset_index()
                crack_daily.columns = ['date', 'crack_width']
                crack_daily['date'] = pd.to_datetime(crack_daily['date']).dt.date
                print(f"[DEBUG multi-factor] crack_daily: {len(crack_daily)} rows, sample={crack_daily['date'].iloc[:3].tolist()}")
                merged = merged.merge(crack_daily, on='date', how='inner')
                print(f"[DEBUG multi-factor] after merge crack: {len(merged)} rows")

        # Available factor columns
        factor_cols = [c for c in ['settlement', 'temperature', 'crack_width'] if c in merged.columns]

        print(f"[DEBUG multi-factor] factor_cols={factor_cols}, merged={len(merged)} rows")

        if len(factor_cols) < 2 or len(merged) < 10:
            print(f"[DEBUG multi-factor] Insufficient: factors={len(factor_cols)}, rows={len(merged)}, returning mock")
            return jsonify(_mock_multi_factor_correlation())

        # --- Compute correlation matrix ---
        corr_df = merged[factor_cols].corr()
        matrix = corr_df.values.tolist()

        # --- Compute pairwise details ---
        from scipy import stats as sp_stats
        pairs = []
        for i in range(len(factor_cols)):
            for j in range(i + 1, len(factor_cols)):
                x = merged[factor_cols[i]].dropna()
                y = merged[factor_cols[j]].dropna()
                common = x.index.intersection(y.index)
                if len(common) < 10:
                    continue
                r_val, p_val = sp_stats.pearsonr(x.loc[common], y.loc[common])
                abs_r = abs(r_val)
                if abs_r >= 0.7:
                    strength = 'strong'
                elif abs_r >= 0.4:
                    strength = 'moderate'
                elif abs_r >= 0.2:
                    strength = 'weak'
                else:
                    strength = 'very weak'
                direction = 'positive' if r_val > 0 else 'negative'
                cn = {'settlement': 'Settlement', 'temperature': 'Temperature', 'crack_width': 'Crack width'}
                interp = f"{cn.get(factor_cols[i], factor_cols[i])} vs {cn.get(factor_cols[j], factor_cols[j])}: {strength} {direction}"
                pairs.append({
                    'factor_x': factor_cols[i],
                    'factor_y': factor_cols[j],
                    'correlation': round(r_val, 4),
                    'p_value': round(p_val, 6),
                    'sample_size': int(len(common)),
                    'interpretation': interp,
                })

        # Date range
        dates = merged['date']
        date_range = [dates.min().strftime('%Y-%m-%d'), dates.max().strftime('%Y-%m-%d')] if len(dates) > 0 else []

        return jsonify({
            'success': True,
            'factors': factor_cols,
            'correlation_matrix': [[round(v, 4) for v in row] for row in matrix],
            'factor_pairs': pairs,
            'data_summary': {
                'settlement_points': int(settlement_df['point_id'].nunique()) if has_settlement else 0,
                'temperature_sensors': int(temp_df['sensor_id'].nunique()) if has_temp else 0,
                'crack_points': len([c for c in crack_df.columns if c not in ('id', 'measurement_date', 'created_at')]) if has_crack else 0,
                'date_range': date_range,
                'merged_records': int(len(merged)),
            },
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify(_mock_multi_factor_correlation())


# 导出蓝图
__all__ = ['ml_api']
