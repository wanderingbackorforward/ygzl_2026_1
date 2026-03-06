# -*- coding: utf-8 -*-
"""
盾构机轨迹展示API
"""
from flask import Blueprint, request, jsonify, send_file
import json
import os
from datetime import datetime

shield_bp = Blueprint('shield', __name__, url_prefix='/api/shield')

# 配置
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'shield')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), '..', '..', 'outputs', 'shield')
STATIC_FOLDER = os.path.join(os.path.dirname(__file__), '..', '..', 'static', 'shield')

# 确保必要的文件夹存在
for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, STATIC_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)


@shield_bp.route('/trajectory/status', methods=['GET'])
def get_status():
    """获取服务器状态"""
    return jsonify({
        'status': 'running',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'message': '盾构机轨迹服务运行中'
    })


@shield_bp.route('/trajectory/calculate', methods=['POST'])
def calculate_trajectory():
    """
    计算盾构机轨迹（演示模式）
    由于缺少实际的计算脚本，返回模拟数据
    """
    try:
        # 获取请求数据
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求数据为空'}), 400

        # 验证必要字段
        required_fields = ['type', 'last_num', 'data']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'缺少必要字段: {field}'}), 400

        # 返回演示数据
        # 实际项目中，这里应该调用真实的计算脚本
        demo_result = {
            'success': True,
            'data': {
                'trajectory_data': generate_demo_trajectory(data['last_num']),
                'statistics': {
                    'total_points': min(data['last_num'], len(data['data'])),
                    'start_time': datetime.now().isoformat(),
                    'end_time': datetime.now().isoformat()
                },
                'message': '轨迹计算完成（演示模式）'
            }
        }

        return jsonify(demo_result)

    except Exception as e:
        return jsonify({'error': f'服务器内部错误: {str(e)}'}), 500


def generate_demo_trajectory(num_points):
    """
    生成演示轨迹数据
    """
    import random

    # 上海杨高中路附近的坐标
    base_lat = 31.2304
    base_lng = 121.5383

    trajectory = []
    for i in range(min(num_points, 100)):  # 最多返回100个点
        trajectory.append({
            'index': i,
            'latitude': base_lat + random.uniform(-0.01, 0.01),
            'longitude': base_lng + random.uniform(-0.01, 0.01),
            'elevation': random.uniform(-10, -5),
            'timestamp': datetime.now().isoformat()
        })

    return trajectory


@shield_bp.route('/data/import', methods=['POST'])
def import_data():
    """
    导入轨迹数据
    """
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400

        # 保存文件
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'import_{timestamp}_{file.filename}'
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        return jsonify({
            'success': True,
            'filename': filename,
            'message': '文件上传成功'
        })

    except Exception as e:
        return jsonify({'error': f'文件上传失败: {str(e)}'}), 500


@shield_bp.route('/data/list', methods=['GET'])
def list_data():
    """
    列出已导入的数据文件
    """
    try:
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for filename in os.listdir(UPLOAD_FOLDER):
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                if os.path.isfile(filepath):
                    files.append({
                        'filename': filename,
                        'size': os.path.getsize(filepath),
                        'modified': datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                    })

        return jsonify({
            'success': True,
            'files': files
        })

    except Exception as e:
        return jsonify({'error': f'获取文件列表失败: {str(e)}'}), 500
