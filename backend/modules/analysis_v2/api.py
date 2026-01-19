# -*- coding: utf-8 -*-
"""
二级数据分析 API 路由
提供四类监测数据的深度分析接口
"""

from flask import Blueprint, jsonify, request
from datetime import datetime
import traceback

# 创建蓝图
analysis_v2_bp = Blueprint('analysis_v2', __name__, url_prefix='/api/analysis/v2')

# 严重程度到工单优先级的映射
SEVERITY_TO_PRIORITY = {
    'critical': 'CRITICAL',
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW',
    'normal': 'LOW',
}

# 异常类型到工单子类型的映射
ANOMALY_TYPE_TO_SUBTYPE = {
    'threshold_exceeded': '沉降量超限',
    'rate_abnormal': '沉降速率异常',
    'trend_abnormal': '差异沉降过大',
    'prediction_warning': '监测点数据异常',
}


@analysis_v2_bp.route('/settlement', methods=['GET'])
def get_settlement_analysis():
    """
    获取沉降二级分析数据

    返回:
        - data_type: 数据类型
        - analysis_time: 分析时间
        - stats: 统计信息 (总点数、异常数等)
        - anomalies: 异常列表
        - recommendations: 建议列表
        - summary: 汇总信息
    """
    try:
        from .settlement_service import SettlementAnalysisService

        service = SettlementAnalysisService()
        result = service.analyze()

        return jsonify(result.to_dict())

    except Exception as e:
        print(f"[Analysis V2] Settlement analysis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'data_type': 'settlement',
            'analysis_time': datetime.now().isoformat(),
            'stats': {'total_points': 0, 'anomaly_count': 0},
            'anomalies': [],
            'recommendations': [],
            'summary': {},
        }), 500


@analysis_v2_bp.route('/settlement/anomalies', methods=['GET'])
def get_settlement_anomalies():
    """
    仅获取沉降异常列表

    查询参数:
        - severity: 按严重程度过滤 (critical/high/medium/low)
        - type: 按异常类型过滤
        - limit: 返回数量限制
    """
    try:
        from .settlement_service import SettlementAnalysisService

        service = SettlementAnalysisService()
        anomalies = service.detect_anomalies()

        # 应用过滤
        severity_filter = request.args.get('severity')
        type_filter = request.args.get('type')
        limit = request.args.get('limit', type=int)

        if severity_filter:
            anomalies = [a for a in anomalies if a.severity == severity_filter]

        if type_filter:
            anomalies = [a for a in anomalies if a.anomaly_type == type_filter]

        if limit:
            anomalies = anomalies[:limit]

        return jsonify({
            'count': len(anomalies),
            'anomalies': [a.to_dict() for a in anomalies],
        })

    except Exception as e:
        print(f"[Analysis V2] Get anomalies error: {e}")
        return jsonify({'error': str(e), 'count': 0, 'anomalies': []}), 500


@analysis_v2_bp.route('/settlement/recommendations', methods=['GET'])
def get_settlement_recommendations():
    """
    仅获取沉降处置建议
    """
    try:
        from .settlement_service import SettlementAnalysisService

        service = SettlementAnalysisService()
        anomalies = service.detect_anomalies()
        recommendations = service.generate_recommendations(anomalies)

        return jsonify({
            'count': len(recommendations),
            'recommendations': [r.to_dict() for r in recommendations],
        })

    except Exception as e:
        print(f"[Analysis V2] Get recommendations error: {e}")
        return jsonify({'error': str(e), 'count': 0, 'recommendations': []}), 500


@analysis_v2_bp.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'module': 'analysis_v2',
        'timestamp': datetime.now().isoformat(),
        'available_endpoints': [
            '/api/analysis/v2/settlement',
            '/api/analysis/v2/settlement/anomalies',
            '/api/analysis/v2/settlement/recommendations',
            '/api/analysis/v2/settlement/create-ticket',
        ]
    })


@analysis_v2_bp.route('/settlement/create-ticket', methods=['POST'])
def create_ticket_from_anomaly():
    """
    从异常创建工单

    请求体:
        - anomaly_id: 异常ID
        - point_id: 监测点ID
        - title: 工单标题
        - description: 描述
        - severity: 严重程度
        - anomaly_type: 异常类型
        - creator_id: 创建人ID (可选，默认 'system')
        - creator_name: 创建人名称 (可选，默认 '系统自动')
    """
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': '请求数据不能为空'}), 400

        # 获取参数
        anomaly_id = data.get('anomaly_id', '')
        point_id = data.get('point_id', '')
        title = data.get('title', '')
        description = data.get('description', '')
        severity = data.get('severity', 'medium')
        anomaly_type = data.get('anomaly_type', '')
        creator_id = data.get('creator_id', 'system')
        creator_name = data.get('creator_name', '系统自动')
        current_value = data.get('current_value')
        threshold = data.get('threshold')

        # 验证必填字段
        if not point_id:
            return jsonify({'success': False, 'message': '缺少监测点ID'}), 400
        if not title:
            title = f"[{point_id}] 沉降异常预警"

        # 映射优先级
        priority = SEVERITY_TO_PRIORITY.get(severity, 'MEDIUM')

        # 映射子类型
        sub_type = ANOMALY_TYPE_TO_SUBTYPE.get(anomaly_type, '监测点数据异常')

        # 构建工单数据
        ticket_data = {
            'title': title,
            'description': description or f"监测点 {point_id} 检测到异常: {title}",
            'ticket_type': 'SETTLEMENT_ALERT',
            'sub_type': sub_type,
            'priority': priority,
            'status': 'PENDING',
            'creator_id': creator_id,
            'creator_name': creator_name,
            'monitoring_point_id': point_id,
            'current_value': current_value,
            'threshold_value': threshold,
            'alert_data': {
                'anomaly_id': anomaly_id,
                'anomaly_type': anomaly_type,
                'severity': severity,
                'detected_at': datetime.now().isoformat(),
            },
            'metadata': {
                'source': 'analysis_v2',
                'auto_created': True,
            }
        }

        # 创建工单
        ticket = repo.ticket_create(ticket_data)

        return jsonify({
            'success': True,
            'message': '工单创建成功',
            'data': {
                'ticket_id': ticket.get('id'),
                'ticket_number': ticket.get('ticket_number'),
                'point_id': point_id,
                'priority': priority,
            }
        }), 201

    except Exception as e:
        print(f"[Analysis V2] Create ticket error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'创建工单失败: {str(e)}'}), 500
