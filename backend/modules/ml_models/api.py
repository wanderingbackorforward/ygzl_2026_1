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
    print(f"[警告] Ensemble模块加载失败: {e}")
    ENSEMBLE_AVAILABLE = False

try:
    from modules.ml_models.explainability import ExplainabilityAnalyzer, SHAP_AVAILABLE
except Exception as e:
    print(f"[警告] Explainability模块加载失败: {e}")
    SHAP_AVAILABLE = False

try:
    from modules.ml_models.knowledge_graph import KnowledgeGraphBuilder, NEO4J_AVAILABLE
except Exception as e:
    print(f"[警告] KnowledgeGraph模块加载失败: {e}")
    NEO4J_AVAILABLE = False

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
        steps = int(request.args.get('steps', 30))

        df = fetch_point_settlement(point_id)

        if model_type == 'prophet':
            if not PROPHET_AVAILABLE:
                return jsonify({
                    'success': False,
                    'message': 'Prophet未安装，请运行: pip install prophet'
                }), 400
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
        if not INFORMER_AVAILABLE:
            return jsonify({
                'success': False,
                'message': 'Informer模块未安装，请运行: pip install torch'
            }), 400

        steps = int(request.args.get('steps', 30))
        seq_len = int(request.args.get('seq_len', 60))

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
            return jsonify({
                'success': False,
                'message': 'Informer模块未安装'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'STGCN模块未安装，请运行: pip install torch scipy'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'STGCN模块未安装'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'PINN模块未安装，请运行: pip install torch'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'PINN模块未安装'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'Ensemble模块未安装'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'SHAP未安装，请运行: pip install shap'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'Neo4j未安装'
            }), 400

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
            return jsonify({
                'success': False,
                'message': 'Neo4j未安装'
            }), 400

        kg = KnowledgeGraphBuilder()
        chain = kg.query_causal_chain(event_id)
        kg.close()

        return jsonify({
            'success': True,
            'event_id': event_id,
            'causal_chain': chain
        })

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
        if not NEO4J_AVAILABLE:
            return jsonify({
                'success': False,
                'message': 'Neo4j未安装'
            }), 400

        severity = request.args.get('severity', 'high')

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
            return jsonify({
                'success': False,
                'message': 'Neo4j未安装'
            }), 400

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
        if not KGQA_AVAILABLE or not NEO4J_AVAILABLE:
            return jsonify({
                'success': False,
                'message': 'KGQA或Neo4j未安装'
            }), 400

        data = request.get_json()
        question = data.get('question')

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
        if not CAUSAL_REASONING_AVAILABLE:
            return jsonify({
                'success': False,
                'message': 'CausalReasoning模块未安装'
            }), 400

        data = request.get_json()
        point_ids = data.get('point_ids', [])
        method = data.get('method', 'granger')
        max_lag = data.get('max_lag', 5)

        if not point_ids:
            return jsonify({
                'success': False,
                'message': '缺少监测点ID'
            }), 400

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
        pivot_df = pivot_df.fillna(method='ffill').fillna(method='bfill')

        # 因果发现
        engine = CausalReasoningEngine()
        causal_pairs = engine.discover_causal_relationships(pivot_df, method, max_lag)

        return jsonify({
            'success': True,
            'method': method,
            'causal_pairs': causal_pairs
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# 导出蓝图
__all__ = ['ml_api']
