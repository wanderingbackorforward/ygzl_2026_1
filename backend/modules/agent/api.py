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
    免费版无 Cron，由前端打开页面时触发。
    """
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


@agent_bp.route('/cron-patrol', methods=['GET'])
def cron_patrol():
    """
    外部 Cron 服务触发巡检（cron-job.org / GitHub Actions / etc.）
    需要 CRON_SECRET 环境变量做简单鉴权，防止被滥用。

    调用方式：GET /api/agent/cron-patrol?token=<CRON_SECRET>
    """
    expected = os.environ.get('CRON_SECRET', '')
    provided = request.args.get('token', '')

    if not expected:
        return jsonify({'error': 'CRON_SECRET not configured on server'}), 503

    if provided != expected:
        return jsonify({'error': 'invalid token'}), 403

    try:
        from modules.agent.patrol import run_patrol
        result = run_patrol()
        return jsonify({
            'source': 'cron',
            'headline': result.get('headline', ''),
            'insights_created': result.get('insights_created', 0),
            'max_severity': result.get('max_severity', 'info'),
        })
    except Exception as e:
        print(f'[Agent Cron] patrol failed: {e}')
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
