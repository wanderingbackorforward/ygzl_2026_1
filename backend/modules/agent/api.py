# -*- coding: utf-8 -*-
"""
Agent 巡检 API 蓝图
提供巡检触发、insights 查询、已读标记等接口。
"""

import os
from flask import Blueprint, jsonify, request

agent_bp = Blueprint('agent_bp', __name__, url_prefix='/api/agent')


@agent_bp.route('/patrol', methods=['GET', 'POST'])
def patrol():
    """
    触发一次巡检。
    Vercel Cron 调用时需要 CRON_SECRET 认证。
    手动调用(开发)时无需认证。
    """
    # Cron 认证检查
    cron_secret = os.environ.get('CRON_SECRET', '')
    auth_header = request.headers.get('Authorization', '')
    # Vercel Cron 会发送 Authorization: Bearer <CRON_SECRET>
    if cron_secret:
        expected = f'Bearer {cron_secret}'
        if auth_header != expected:
            return jsonify({'error': 'Unauthorized'}), 401

    try:
        from modules.agent.patrol import run_patrol
        result = run_patrol()
        return jsonify(result)
    except Exception as e:
        print(f'[Agent API] patrol failed: {e}')
        return jsonify({'error': str(e), 'headline': '巡检暂时不可用'}), 500


@agent_bp.route('/insights', methods=['GET'])
def insights():
    """获取最新 insights 列表"""
    try:
        limit = request.args.get('limit', 20, type=int)
        from modules.agent.patrol import get_latest_insights
        data = get_latest_insights(limit=limit)
        return jsonify(data)
    except Exception as e:
        print(f'[Agent API] insights failed: {e}')
        return jsonify([])


@agent_bp.route('/badge', methods=['GET'])
def badge():
    """获取未读徽章信息（Nav 红/黄点用）"""
    try:
        from modules.agent.patrol import get_unread_badge
        data = get_unread_badge()
        return jsonify(data)
    except Exception as e:
        return jsonify({'has_unread': False, 'count': 0, 'max_severity': 'info'})


@agent_bp.route('/acknowledge', methods=['POST'])
def acknowledge():
    """标记 insight 已读"""
    try:
        body = request.get_json(silent=True) or {}
        insight_id = body.get('insight_id', '')
        if not insight_id:
            return jsonify({'error': 'missing insight_id'}), 400

        from modules.agent.patrol import acknowledge_insight
        ok = acknowledge_insight(insight_id)
        return jsonify({'success': ok})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@agent_bp.route('/dismiss', methods=['POST'])
def dismiss():
    """标记 insight 不相关（误报学习）"""
    try:
        body = request.get_json(silent=True) or {}
        insight_id = body.get('insight_id', '')
        if not insight_id:
            return jsonify({'error': 'missing insight_id'}), 400

        from modules.agent.patrol import dismiss_insight
        ok = dismiss_insight(insight_id)
        return jsonify({'success': ok})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
