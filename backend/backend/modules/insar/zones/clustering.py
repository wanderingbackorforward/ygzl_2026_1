# -*- coding: utf-8 -*-
"""DBSCAN 聚类算法 - 网格优化版本"""
import math
from typing import Dict, List, Tuple


def _grid_key(x: float, y: float, cell: float) -> Tuple[int, int]:
    """计算网格键"""
    if cell <= 0:
        return 0, 0
    return int(math.floor(x / cell)), int(math.floor(y / cell))


def _neighbors_for_index(
    idx: int,
    xs: List[float],
    ys: List[float],
    cell: float,
    eps2: float,
    grid: Dict[Tuple[int, int], List[int]],
) -> List[int]:
    """查找指定点的邻居"""
    x, y = xs[idx], ys[idx]
    gx, gy = _grid_key(x, y, cell)
    out: List[int] = []

    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cand = grid.get((gx + dx, gy + dy))
            if not cand:
                continue
            for j in cand:
                dx2 = xs[j] - x
                dy2 = ys[j] - y
                if dx2 * dx2 + dy2 * dy2 <= eps2:
                    out.append(j)
    return out


def dbscan_grid(xs: List[float], ys: List[float], eps: float, min_pts: int) -> List[List[int]]:
    """DBSCAN 聚类算法（网格优化）

    Args:
        xs: X 坐标列表
        ys: Y 坐标列表
        eps: 邻域半径
        min_pts: 最小点数

    Returns:
        聚类列表，每个聚类是点索引列表
    """
    n = len(xs)
    if n == 0:
        return []

    eps = float(eps)
    if not math.isfinite(eps) or eps <= 0:
        return []

    min_pts = max(1, int(min_pts))

    # 构建网格索引
    grid: Dict[Tuple[int, int], List[int]] = {}
    for i in range(n):
        k = _grid_key(xs[i], ys[i], eps)
        grid.setdefault(k, []).append(i)

    eps2 = eps * eps
    labels = [0] * n
    clusters: List[List[int]] = []
    cid = 0

    # DBSCAN 主循环
    for i in range(n):
        if labels[i] != 0:
            continue

        neigh = _neighbors_for_index(i, xs, ys, eps, eps2, grid)
        if len(neigh) < min_pts:
            labels[i] = -1  # 噪声点
            continue

        cid += 1
        labels[i] = cid
        queue = list(neigh)
        head = 0

        while head < len(queue):
            j = queue[head]
            head += 1

            if labels[j] == -1:
                labels[j] = cid
            if labels[j] != 0:
                continue

            labels[j] = cid
            neigh2 = _neighbors_for_index(j, xs, ys, eps, eps2, grid)
            if len(neigh2) >= min_pts:
                queue.extend(neigh2)

    # 收集聚类
    by_cluster: Dict[int, List[int]] = {}
    for i, lb in enumerate(labels):
        if lb <= 0:
            continue
        by_cluster.setdefault(lb, []).append(i)

    for k in sorted(by_cluster.keys()):
        clusters.append(by_cluster[k])

    return clusters
