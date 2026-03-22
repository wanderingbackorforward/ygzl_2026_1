# -*- coding: utf-8 -*-
"""
曲线形态感知 — 地质直觉的数学基础
分析变形曲线的斜率、加速度、收敛性，感知地层应力状态。
"""

import numpy as np
from typing import Dict, List, Optional


def analyze_curve_health(values: List[float]) -> Dict:
    """
    分析沉降曲线的健康状态。

    Args:
        values: 最近 N 天的沉降值序列（按时间正序）

    Returns:
        dict: {status, description, slope, acceleration, converging}
    """
    n = len(values)
    if n < 3:
        return {
            'status': 'insufficient_data',
            'description': '数据不足，无法判断趋势',
            'slope': 0.0,
            'acceleration': 0.0,
            'converging': None,
        }

    arr = np.array(values, dtype=float)

    # 斜率（整体趋势方向，mm/记录间隔）
    slope = float(np.polyfit(range(n), arr, 1)[0])

    # 加速度（变化速度是否在加快）
    diffs = np.diff(arr)
    acceleration = float(np.diff(diffs).mean()) if len(diffs) > 1 else 0.0

    # 收敛性（最近几个点的变化幅度是否在减小）
    recent_diffs = np.abs(diffs[-3:]) if len(diffs) >= 3 else np.abs(diffs)
    is_converging = (
        len(recent_diffs) >= 2
        and float(recent_diffs[-1]) < float(recent_diffs[0]) * 0.7
    )

    # 综合判断
    result = {
        'slope': round(slope, 6),
        'acceleration': round(acceleration, 6),
        'converging': is_converging,
    }

    if abs(slope) < 0.01 and is_converging:
        result['status'] = 'stable'
        result['description'] = '地层变形趋于稳定'
    elif acceleration > 0.02 and not is_converging:
        result['status'] = 'accelerating'
        result['description'] = '地层变形加速，尚未找到新的平衡'
    elif acceleration > 0.005 and not is_converging:
        result['status'] = 'not_converging'
        result['description'] = '变形未见收敛，扰动影响仍在扩展'
    elif is_converging:
        result['status'] = 'converging'
        result['description'] = '变形速率减缓，地层正在趋于稳定'
    else:
        result['status'] = 'normal'
        result['description'] = '地层状态正常'

    return result
