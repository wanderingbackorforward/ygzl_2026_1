# -*- coding: utf-8 -*-
"""几何计算 - 凸包、圆形、闭合环"""
import math
from typing import List, Tuple


def cross(o: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """计算叉积"""
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def convex_hull(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Andrew 单调链算法计算凸包"""
    pts = sorted(set(points))
    if len(pts) <= 1:
        return pts

    lower: List[Tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: List[Tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def ring_from_center(center_xy: Tuple[float, float], radius: float, sides: int = 12) -> List[Tuple[float, float]]:
    """从中心点生成圆形环"""
    cx, cy = center_xy
    r = float(radius)
    if not math.isfinite(r) or r <= 0:
        r = 1.0
    sides = max(6, int(sides))

    out: List[Tuple[float, float]] = []
    for i in range(sides):
        t = (2.0 * math.pi) * (i / sides)
        out.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return out


def close_ring(coords: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """闭合环（首尾相连）"""
    if not coords:
        return coords
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]
