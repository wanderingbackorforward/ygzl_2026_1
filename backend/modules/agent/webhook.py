# -*- coding: utf-8 -*-
"""
Agent -> 企业微信/钉钉 Webhook 推送模块

环境变量:
  WECHAT_WEBHOOK_URL  — 企业微信群机器人 Webhook 地址
  DINGTALK_WEBHOOK_URL — 钉钉群机器人 Webhook 地址（备选）
  AGENT_PUSH_ENABLED  — "1" 启用推送，其他值或不设则静默

设计原则:
  1. 安静即安全 — 只推送 warning/critical，不推 info
  2. 重复抑制 — 同一个 point_id 在 COOLDOWN 内不重复推送
  3. 优雅降级 — 环境变量没设就静默，绝不崩溃
"""

import os
import time
import requests as _requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# 同一个点的推送冷却时间（秒）— 默认 1 小时
COOLDOWN_SECONDS = 3600

# 内存级冷却记录 {point_id: last_push_timestamp}
# Serverless 环境下每次冷启动会重置，这是可接受的（宁可多推也不漏推）
_push_cooldown: Dict[str, float] = {}


def _get_webhook_url() -> Optional[str]:
    """获取 Webhook URL，优先企业微信，备选钉钉"""
    return (
        os.environ.get('WECHAT_WEBHOOK_URL')
        or os.environ.get('DINGTALK_WEBHOOK_URL')
        or None
    )


def _is_enabled() -> bool:
    """推送是否启用"""
    return os.environ.get('AGENT_PUSH_ENABLED', '') == '1'


def _in_cooldown(point_id: str) -> bool:
    """检查某个点是否在冷却期内"""
    if not point_id:
        return False
    last = _push_cooldown.get(point_id, 0)
    return (time.time() - last) < COOLDOWN_SECONDS


def _mark_pushed(point_id: str):
    """标记某个点刚刚推送过"""
    if point_id:
        _push_cooldown[point_id] = time.time()


def _format_wechat_message(insights: List[Dict]) -> Dict:
    """格式化为企业微信 markdown 消息"""
    now = datetime.now(timezone.utc).strftime('%H:%M UTC')

    lines = []
    for ins in insights:
        severity = ins.get('severity', 'warning')
        icon = '🔴' if severity == 'critical' else '🟡'
        point_id = ins.get('point_id', '')
        title = ins.get('title', '')
        body = ins.get('body', '')
        suggestion = ins.get('suggestion', '')

        lines.append(f'{icon} **{title}**')
        if point_id:
            lines.append(f'> 测点: {point_id}')
        if body:
            # 截断过长内容
            body_short = body[:120] + '...' if len(body) > 120 else body
            lines.append(f'> {body_short}')
        if suggestion:
            lines.append(f'> 建议: {suggestion}')
        lines.append('')

    content = '\n'.join(lines)

    # 企业微信 markdown 格式
    return {
        'msgtype': 'markdown',
        'markdown': {
            'content': f'**Agent 巡检预警** ({now})\n\n{content}'
        }
    }


def _format_dingtalk_message(insights: List[Dict]) -> Dict:
    """格式化为钉钉 markdown 消息"""
    now = datetime.now(timezone.utc).strftime('%H:%M UTC')

    lines = []
    for ins in insights:
        severity = ins.get('severity', 'warning')
        icon = '[危险]' if severity == 'critical' else '[警告]'
        title = ins.get('title', '')
        body = ins.get('body', '')
        suggestion = ins.get('suggestion', '')

        lines.append(f'{icon} **{title}**')
        if body:
            body_short = body[:120] + '...' if len(body) > 120 else body
            lines.append(f'> {body_short}')
        if suggestion:
            lines.append(f'> {suggestion}')
        lines.append('')

    content = '\n'.join(lines)

    return {
        'msgtype': 'markdown',
        'markdown': {
            'title': 'Agent 巡检预警',
            'text': f'### Agent 巡检预警 ({now})\n\n{content}'
        }
    }


def push_insights(insights: List[Dict]) -> Dict[str, Any]:
    """
    将 warning/critical insights 推送到企业微信/钉钉。

    参数:
        insights: patrol.py 生成的 insight 列表

    返回:
        {pushed: int, skipped: int, error: str|None}
    """
    result = {'pushed': 0, 'skipped': 0, 'error': None}

    if not _is_enabled():
        result['skipped'] = len(insights)
        return result

    webhook_url = _get_webhook_url()
    if not webhook_url:
        result['error'] = 'no webhook url configured'
        result['skipped'] = len(insights)
        return result

    # 过滤：只推 warning/critical，排除 patrol_summary
    pushable = []
    for ins in insights:
        severity = ins.get('severity', 'info')
        insight_type = ins.get('insight_type', '')

        if severity not in ('warning', 'critical'):
            result['skipped'] += 1
            continue

        if insight_type == 'patrol_summary':
            result['skipped'] += 1
            continue

        point_id = ins.get('point_id', '')
        if _in_cooldown(point_id):
            result['skipped'] += 1
            print(f'[Agent Push] {point_id} in cooldown, skip')
            continue

        pushable.append(ins)

    if not pushable:
        return result

    # 格式化消息
    is_dingtalk = 'dingtalk' in webhook_url or 'oapi.dingtalk' in webhook_url
    if is_dingtalk:
        payload = _format_dingtalk_message(pushable)
    else:
        payload = _format_wechat_message(pushable)

    # 发送
    try:
        resp = _requests.post(
            webhook_url,
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        resp_data = resp.json()

        # 企业微信返回 errcode=0 表示成功
        errcode = resp_data.get('errcode', resp_data.get('code', 0))
        if errcode != 0:
            result['error'] = f'webhook returned errcode={errcode}: {resp_data.get("errmsg", "")}'
            print(f'[Agent Push] webhook error: {result["error"]}')
        else:
            result['pushed'] = len(pushable)
            # 标记冷却
            for ins in pushable:
                _mark_pushed(ins.get('point_id', ''))
            print(f'[Agent Push] pushed {len(pushable)} insights')

    except Exception as e:
        result['error'] = str(e)
        print(f'[Agent Push] send failed: {e}')

    return result
