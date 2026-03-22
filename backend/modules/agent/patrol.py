# -*- coding: utf-8 -*-
"""
Agent 巡检主逻辑
调用 SettlementAnalysisService 做 90% 的分析，
叠加形态分析和一句话模板，写入 insights 表。
"""

import os
import uuid
import requests
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from .curve_health import analyze_curve_health
from .templates import (
    select_headline,
    format_trust_anchor,
    build_insight_body,
    get_suggestion,
)


def _headers():
    anon = os.environ.get('SUPABASE_ANON_KEY', '')
    h = {
        'apikey': anon,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
    if anon:
        h['Authorization'] = f'Bearer {anon}'
    return h


def _url(path):
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    return f'{base}{path}'


# ------------------------------------------------------------------
# 数据获取
# ------------------------------------------------------------------

def _fetch_recent_values(point_id: str, days: int = 7) -> List[float]:
    """获取某监测点最近 N 天的沉降值序列"""
    try:
        r = requests.get(
            _url(f'/rest/v1/processed_settlement_data'
                 f'?select=value'
                 f'&point_id=eq.{point_id}'
                 f'&order=measurement_date.asc'
                 f'&limit=200'),
            headers=_headers(),
            timeout=10,
        )
        r.raise_for_status()
        rows = r.json()
        return [row['value'] for row in rows if row.get('value') is not None]
    except Exception as e:
        print(f'[Agent] fetch values for {point_id} failed: {e}')
        return []


def _fetch_last_insight(point_id: str) -> Optional[Dict]:
    """获取某监测点的最新 insight"""
    try:
        r = requests.get(
            _url(f'/rest/v1/insights'
                 f'?point_id=eq.{point_id}'
                 f'&order=created_at.desc'
                 f'&limit=1'),
            headers=_headers(),
            timeout=10,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None
    except Exception:
        return None


def _fetch_last_patrol_summary() -> Optional[Dict]:
    """获取最近一次巡检摘要"""
    try:
        r = requests.get(
            _url(f'/rest/v1/insights'
                 f'?insight_type=eq.patrol_summary'
                 f'&order=created_at.desc'
                 f'&limit=1'),
            headers=_headers(),
            timeout=10,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None
    except Exception:
        return None


def _write_insights(insights: List[Dict]):
    """批量写入 insights 到 Supabase"""
    if not insights:
        return
    try:
        h = _headers()
        h['Prefer'] = 'return=minimal'
        r = requests.post(
            _url('/rest/v1/insights'),
            json=insights,
            headers=h,
            timeout=15,
        )
        r.raise_for_status()
        print(f'[Agent] wrote {len(insights)} insights')
    except Exception as e:
        print(f'[Agent] write insights failed: {e}')


# ------------------------------------------------------------------
# 重复抑制
# ------------------------------------------------------------------

def _should_create_new(point_id: str, severity: str,
                       curve_status: str, last: Optional[Dict]) -> bool:
    """判断是否需要生成新 insight（重复抑制）"""
    if last is None:
        return severity != 'info'  # 正常点不生成 insight

    # 上一条还没看且没有恶化 -> 不重复
    if not last.get('acknowledged', False):
        sev_order = {'info': 0, 'warning': 1, 'critical': 2}
        if sev_order.get(severity, 0) <= sev_order.get(last.get('severity', 'info'), 0):
            return False

    # 严重程度升级 -> 新 insight
    sev_order = {'info': 0, 'warning': 1, 'critical': 2}
    if sev_order.get(severity, 0) > sev_order.get(last.get('severity', 'info'), 0):
        return True

    # 形态变化 -> 新 insight
    last_curve = (last.get('evidence') or {}).get('curve_status', '')
    if curve_status and curve_status != last_curve:
        return True

    # 恢复正常 -> 生成 resolution
    if severity == 'info' and last.get('severity', 'info') != 'info':
        return True

    return False


# ------------------------------------------------------------------
# 巡检主流程
# ------------------------------------------------------------------

def run_patrol() -> Dict[str, Any]:
    """
    执行一次巡检。

    返回:
        {headline, trust_anchor, insights_created, total_points,
         anomaly_count, max_severity, analysis_time}
    """
    now_str = datetime.now(timezone.utc).strftime('%H:%M')

    # --- 第一步：调用已有分析引擎 ---
    try:
        from modules.analysis_v2.settlement_service import SettlementAnalysisService
        service = SettlementAnalysisService()
        result = service.analyze()
    except Exception as e:
        print(f'[Agent] SettlementAnalysisService failed: {e}')
        return {
            'headline': '巡检服务暂时不可用',
            'trust_anchor': '',
            'insights_created': 0,
            'error': str(e),
        }

    stats = result.stats
    anomalies = result.anomalies
    total_points = stats.total_points or stats.analyzed_points or 0

    # --- 第二步：形态分析叠加 ---
    # 收集所有异常点的 point_id
    anomaly_point_ids = set()
    for a in anomalies:
        if a.point_id:
            anomaly_point_ids.add(a.point_id)

    # 对异常点做形态分析
    curve_health_map = {}
    for pid in anomaly_point_ids:
        values = _fetch_recent_values(pid)
        if values and len(values) >= 3:
            curve_health_map[pid] = analyze_curve_health(values)

    # --- 第三步：分类异常 ---
    anomalies_by_severity = {'critical': [], 'warning': []}
    for a in anomalies:
        a_dict = a.to_dict()
        sev = a_dict.get('severity', 'low')
        ch = curve_health_map.get(a_dict.get('point_id'))
        if ch:
            a_dict['curve_health'] = ch
            a_dict['reason_short'] = ch.get('description', '')
        else:
            a_dict['reason_short'] = a_dict.get('title', '')

        if sev in ('critical', 'high'):
            anomalies_by_severity['critical'].append(a_dict)
        elif sev in ('medium', 'low'):
            anomalies_by_severity['warning'].append(a_dict)

    # --- 第四步：选模板生成一句话 ---
    point_stats_enriched = []
    for pid in anomaly_point_ids:
        ch = curve_health_map.get(pid, {})
        point_stats_enriched.append({
            'point_id': pid,
            'curve_health': ch,
        })

    headline = select_headline(point_stats_enriched, anomalies_by_severity)
    trust_anchor = format_trust_anchor(
        checked=total_points,
        total=total_points,
        latest_time=now_str,
    )

    # --- 第五步：生成 insights（按 point_id 去重 + 批量查历史） ---
    new_insights = []
    max_severity = 'info'
    seen_points = set()  # 同一个点只生成一条 insight

    # 合并所有异常，按严重程度排序（critical 优先）
    all_anomaly_items = []
    for item in anomalies_by_severity.get('critical', []):
        all_anomaly_items.append(('critical', item))
    for item in anomalies_by_severity.get('warning', []):
        all_anomaly_items.append(('warning', item))

    for severity, item in all_anomaly_items:
        pid = item.get('point_id', '')
        if not pid or pid in seen_points:
            continue  # 同一个点只处理一次（取最严重的那条）
        seen_points.add(pid)

        curve_status = item.get('curve_health', {}).get('status', '')

        # 查该点的最新 insight（每个点只查一次）
        last = _fetch_last_insight(pid)
        if not _should_create_new(pid, severity, curve_status, last):
            continue

        ch = item.get('curve_health')
        body = build_insight_body(item, ch)
        suggestion = get_suggestion(severity)

            insight = {
                'id': str(uuid.uuid4()),
                'insight_type': 'anomaly',
                'severity': severity,
                'point_id': pid,
                'title': item.get('title', f'{pid} 异常'),
                'body': body,
                'evidence': {
                    'curve_status': curve_status,
                    'slope': ch.get('slope') if ch else None,
                    'acceleration': ch.get('acceleration') if ch else None,
                    'converging': ch.get('converging') if ch else None,
                    'anomaly_type': item.get('anomaly_type', ''),
                    'current_value': item.get('current_value'),
                    'threshold': item.get('threshold'),
                },
                'suggestion': suggestion,
                'acknowledged': False,
                'dismissed': False,
            }
            new_insights.append(insight)

            sev_order = {'info': 0, 'warning': 1, 'critical': 2}
            if sev_order.get(severity, 0) > sev_order.get(max_severity, 0):
                max_severity = severity

    # 写入巡检摘要
    patrol_summary = {
        'id': str(uuid.uuid4()),
        'insight_type': 'patrol_summary',
        'severity': max_severity,
        'point_id': None,
        'title': headline,
        'body': trust_anchor,
        'evidence': {
            'total_points': total_points,
            'anomaly_count': len(anomalies),
            'critical_count': len(anomalies_by_severity.get('critical', [])),
            'warning_count': len(anomalies_by_severity.get('warning', [])),
        },
        'suggestion': None,
        'acknowledged': False,
        'dismissed': False,
    }
    all_to_write = [patrol_summary] + new_insights
    _write_insights(all_to_write)

    return {
        'headline': headline,
        'trust_anchor': trust_anchor,
        'insights_created': len(new_insights),
        'total_points': total_points,
        'anomaly_count': len(anomalies),
        'max_severity': max_severity,
        'analysis_time': now_str,
    }


# ------------------------------------------------------------------
# API 辅助
# ------------------------------------------------------------------

def get_latest_insights(limit: int = 20) -> List[Dict]:
    """获取最新 insights 列表"""
    try:
        r = requests.get(
            _url(f'/rest/v1/insights'
                 f'?order=created_at.desc'
                 f'&limit={limit}'),
            headers=_headers(),
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f'[Agent] get insights failed: {e}')
        return []


def get_unread_badge() -> Dict:
    """获取未读徽章信息（Nav 红/黄点用）"""
    try:
        r = requests.get(
            _url('/rest/v1/insights'
                 '?acknowledged=eq.false'
                 '&dismissed=eq.false'
                 '&insight_type=neq.patrol_summary'
                 '&order=created_at.desc'
                 '&limit=50'),
            headers=_headers(),
            timeout=10,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return {'has_unread': False, 'count': 0, 'max_severity': 'info'}

        severities = [row.get('severity', 'info') for row in rows]
        max_sev = 'info'
        if 'critical' in severities:
            max_sev = 'critical'
        elif 'warning' in severities:
            max_sev = 'warning'

        return {
            'has_unread': True,
            'count': len(rows),
            'max_severity': max_sev,
        }
    except Exception:
        return {'has_unread': False, 'count': 0, 'max_severity': 'info'}


def acknowledge_insight(insight_id: str) -> bool:
    """标记 insight 已读"""
    try:
        h = _headers()
        h['Prefer'] = 'return=minimal'
        r = requests.patch(
            _url(f'/rest/v1/insights?id=eq.{insight_id}'),
            json={'acknowledged': True},
            headers=h,
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception:
        return False


def dismiss_insight(insight_id: str) -> bool:
    """标记 insight 不相关（误报学习）"""
    try:
        h = _headers()
        h['Prefer'] = 'return=minimal'
        r = requests.patch(
            _url(f'/rest/v1/insights?id=eq.{insight_id}'),
            json={'dismissed': True, 'acknowledged': True},
            headers=h,
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception:
        return False
