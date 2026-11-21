# -*- coding: utf-8 -*-
"""振动业务规则（唯一出处）

依据 GB 6722-2014《爆破安全规程》表2，提供：
- 频率段判定
- 动态阈值（规范基准 + 结构状态 / 距离 / 低频修正）
- 预警等级
- Sadovsky 公式预测 PPV 与反算安全距离
- 安全评分与施工建议

前端只做展示，不再保留第二套公式。
"""

from typing import Any, Dict, List, Optional

# ==================== GB 6722-2014 表2（mm/s）====================

GB_TABLE_2 = {
    'earthen': {
        'low': {'min': 1.5, 'max': 4.5},
        'mid': {'min': 4.5, 'max': 9.0},
        'high': {'min': 9.0, 'max': 15.0},
    },
    'brick': {
        'low': {'min': 5.0, 'max': 10.0},
        'mid': {'min': 10.0, 'max': 20.0},
        'high': {'min': 20.0, 'max': 30.0},
    },
    'concrete': {
        'low': {'min': 7.0, 'max': 12.0},
        'mid': {'min': 12.0, 'max': 25.0},
        'high': {'min': 25.0, 'max': 35.0},
    },
    'industrial': {
        'low': {'min': 15.0, 'max': 25.0},
        'mid': {'min': 25.0, 'max': 40.0},
        'high': {'min': 40.0, 'max': 50.0},
    },
    'historic': {
        'low': {'min': 1.0, 'max': 3.0},
        'mid': {'min': 3.0, 'max': 5.0},
        'high': {'min': 5.0, 'max': 8.0},
    },
    'tunnel': {
        'low': {'min': 70.0, 'max': 150.0},
        'mid': {'min': 150.0, 'max': 250.0},
        'high': {'min': 250.0, 'max': 400.0},
    },
    'softSoil': {
        'low': {'min': 6.0, 'max': 10.0},
        'mid': {'min': 10.0, 'max': 15.0},
        'high': {'min': 15.0, 'max': 20.0},
    },
}

# 结构状态修正系数
CONDITION_FACTORS = {
    'new': 1.0,
    'good': 0.85,
    'fair': 0.7,
    'poor': 0.5,
    'damaged': 0.3,
}

# Sadovsky 场地系数（经验值）
SITE_COEFFICIENTS = {
    'hardRock': {'K': 250.0, 'alpha': 1.5},
    'softRock': {'K': 150.0, 'alpha': 1.7},
    'soil': {'K': 100.0, 'alpha': 1.9},
    'softSoil': {'K': 50.0, 'alpha': 2.0},
}

_FREQUENCY_LABELS = {'low': '<10Hz', 'mid': '10-50Hz', 'high': '>50Hz'}


def frequency_band(freq: Any) -> str:
    value = float(freq or 0)
    if value < 10:
        return 'low'
    if value <= 50:
        return 'mid'
    return 'high'


def dynamic_threshold(structure_type: str, dominant_freq: Any,
                      distance: Any, condition: str) -> Dict[str, float]:
    """动态阈值：GB 表2 上限 × 结构状态系数 × 距离修正 × 低频修正。"""
    band = frequency_band(dominant_freq)
    structure_row = GB_TABLE_2.get(str(structure_type or '').strip())
    if not structure_row:
        raise ValueError(f'未知结构类型: {structure_type}')
    base = structure_row[band]['max'] * CONDITION_FACTORS.get(
        str(condition or '').strip(), 1.0
    )

    distance_value = float(distance or 0)
    distance_factor = 0.7 + (distance_value / 50.0) * 0.3 if distance_value < 50 else 1.0
    freq_factor = 0.7 if float(dominant_freq or 0) < 10 else 1.0

    final_threshold = base * distance_factor * freq_factor
    return {
        'warn': round(final_threshold * 0.6, 3),
        'alert': round(final_threshold * 0.8, 3),
        'stop': round(final_threshold, 3),
        'frequency_band': band,
        'frequency_label': _FREQUENCY_LABELS[band],
    }


def alert_level(ppv: Any, thresholds: Dict[str, float]) -> str:
    value = float(ppv or 0)
    if value >= thresholds['stop']:
        return 'stop'
    if value >= thresholds['alert']:
        return 'alert'
    if value >= thresholds['warn']:
        return 'warn'
    return 'safe'


def _status_for_level(level: str) -> str:
    if level == 'safe':
        return 'normal'
    if level == 'warn':
        return 'warning'
    return 'alert'


def site_coefficients(site_type: str) -> Dict[str, float]:
    coefficients = SITE_COEFFICIENTS.get(str(site_type or '').strip())
    if not coefficients:
        raise ValueError(f'未知场地类型: {site_type}')
    return coefficients


def predict_ppv(site_type: str, Q: Any, R: Any) -> float:
    """Sadovsky：V = K · (Q^(1/3) / R)^alpha，单位 mm/s。"""
    charge = float(Q or 0)
    distance = float(R or 0)
    if charge <= 0 or distance <= 0:
        raise ValueError('药量与距离必须大于 0')
    coefficients = site_coefficients(site_type)
    return round(
        coefficients['K'] * ((charge ** (1 / 3)) / distance) ** coefficients['alpha'],
        3,
    )


def safe_distance(site_type: str, Q: Any, v_limit: Any) -> float:
    """反算安全距离：R = (K/V)^(1/alpha) · Q^(1/3)，单位 m。"""
    charge = float(Q or 0)
    limit = float(v_limit or 0)
    if charge <= 0 or limit <= 0:
        raise ValueError('药量与允许振速必须大于 0')
    coefficients = site_coefficients(site_type)
    return round(
        (coefficients['K'] / limit) ** (1 / coefficients['alpha']) * charge ** (1 / 3),
        2,
    )


def safety_score(ppv_max: Any, threshold: Any, duration: Any,
                 alert_count: Any, dominant_freq: Any,
                 exceed_ratio: Any) -> Dict[str, Any]:
    """基于 GB 规范 + Miner 累积损伤的安全评分。"""
    score = 100.0
    factors: List[str] = []

    ppv_value = float(ppv_max or 0)
    threshold_value = float(threshold or 1)
    ppv_ratio = ppv_value / threshold_value if threshold_value else 0
    if ppv_ratio > 1.0:
        score -= min(40.0, (ppv_ratio - 1.0) * 50)
        factors.append(f'PPV超限{(ppv_ratio - 1) * 100:.1f}%')
    elif ppv_ratio > 0.8:
        score -= (ppv_ratio - 0.8) * 100
        factors.append('PPV接近阈值')

    duration_value = float(duration or 0)
    if duration_value > 0.5:
        score -= min(20.0, (duration_value - 0.5) * 10)
        factors.append(f'持续时间{duration_value:.2f}s')

    freq_value = float(dominant_freq or 0)
    if freq_value < 10:
        score -= 15
        factors.append(f'低频振动{freq_value:.1f}Hz')
    elif freq_value < 15:
        score -= 8
        factors.append('中低频振动')

    count_value = int(alert_count or 0)
    score -= min(15.0, count_value * 3)
    if count_value > 0:
        factors.append(f'累积报警{count_value}次')

    ratio_value = float(exceed_ratio or 0)
    if ratio_value > 5:
        score -= 10
        factors.append(f'超限率{ratio_value:.1f}%')
    elif ratio_value > 2:
        score -= 5
        factors.append('超限率偏高')

    final_score = max(0, round(score))
    level = 'safe' if final_score >= 80 else 'caution' if final_score >= 60 else 'danger'
    recommendations = {
        'safe': '振动水平安全，保持常规监测',
        'caution': '振动水平偏高，建议降低爆破参数并加密监测',
        'danger': '振动水平危险，立即停工并进行结构安全评估',
    }
    return {
        'score': final_score,
        'level': level,
        'factors': factors,
        'recommendation': recommendations[level],
    }


_ADVICE = {
    'safe': {
        'level': 'safe',
        'icon': '🛡️',
        'color': 'text-green-400',
        'message': '保持常规监测',
        'actions': [],
    },
    'warn': {
        'level': 'warn',
        'icon': '⚠️',
        'color': 'text-yellow-400',
        'message': '降低药量30%',
        'actions': ['增加延时间隔', '加密监测频次'],
    },
    'alert': {
        'level': 'alert',
        'icon': '🚨',
        'color': 'text-orange-400',
        'message': '暂停爆破作业',
        'actions': ['检查周围建筑裂缝', '降低单段药量50%以上'],
    },
    'stop': {
        'level': 'stop',
        'icon': '🛑',
        'color': 'text-red-500',
        'message': '立即停工评审',
        'actions': ['启动应急预案', '所有工序暂停', '结构安全评估'],
    },
}


def construction_advice(ppv: Any, freq: Any, level: str) -> Dict[str, Any]:
    advice = dict(_ADVICE.get(str(level or '').strip(), _ADVICE['safe']))
    advice['actions'] = list(advice['actions'])
    if float(freq or 0) < 15 and advice['level'] != 'safe':
        advice['actions'].append('注意低频振动对建筑基础的影响')
    return advice


def analyze(payload: Dict[str, Any]) -> Dict[str, Any]:
    """一次性分类整批通道，并给出汇总评分。"""
    structure_type = payload.get('structure_type')
    condition = payload.get('condition')
    distance = payload.get('distance')
    channels = payload.get('channels') or []

    analyzed: List[Dict[str, Any]] = []
    for channel in channels:
        ppv = channel.get('ppv')
        dominant_freq = channel.get('dominant_freq')
        thresholds = dynamic_threshold(structure_type, dominant_freq, distance, condition)
        level = alert_level(ppv, thresholds)
        analyzed.append({
            'channel_id': channel.get('channel_id'),
            'ppv': float(ppv or 0),
            'dominant_freq': float(dominant_freq or 0),
            'thresholds': thresholds,
            'alert_level': level,
            'status': _status_for_level(level),
            'advice': construction_advice(ppv, dominant_freq, level),
        })

    if not analyzed:
        return {'channels': [], 'summary': None}

    max_channel = max(analyzed, key=lambda item: item['ppv'])
    max_thresholds = max_channel['thresholds']
    alert_count = sum(1 for item in analyzed if item['alert_level'] != 'safe')
    exceed_points = sum(100 for item in analyzed if item['ppv'] > item['thresholds']['warn'])
    exceed_ratio = (exceed_points / (len(analyzed) * 1000)) * 100

    return {
        'channels': analyzed,
        'summary': {
            'max_ppv': max_channel['ppv'],
            'thresholds': max_thresholds,
            'alert_count': alert_count,
            'exceed_ratio': round(exceed_ratio, 4),
            'score': safety_score(
                max_channel['ppv'],
                max_thresholds['stop'],
                0.5,
                alert_count,
                max_channel['dominant_freq'],
                exceed_ratio,
            ),
        },
    }
