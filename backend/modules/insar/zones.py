# -*- coding: utf-8 -*-
"""区域生成入口 - 委托给 zone_engine/ 子模块

保留 ZoneParams 和 build_zones 的公共接口，内部逻辑已拆分到：
- zone_engine/clustering.py  DBSCAN 聚类
- zone_engine/geometry.py    几何计算
- zone_engine/builder.py     区域构建
"""
from dataclasses import dataclass
from typing import Any, Dict, Tuple

from .zone_engine.builder import (
    build_zone_level,
    classify_points_by_velocity,
    extract_points_from_geojson,
)
from .utils.geo import project_local_meters


@dataclass
class ZoneParams:
    dataset: str
    velocity_field: str
    mild: float
    strong: float
    method: str = "cluster_hull"
    eps_m: float = 50.0
    min_pts: int = 6


def _empty_meta(params: ZoneParams) -> Dict[str, Any]:
    return {
        "dataset": params.dataset,
        "method": params.method,
        "thresholds": {"mild": params.mild, "strong": params.strong},
        "eps_m": params.eps_m,
        "min_pts": params.min_pts,
        "zone_count": 0,
        "danger_zone_count": 0,
        "warning_zone_count": 0,
        "subsidence_zone_count": 0,
        "uplift_zone_count": 0,
        "input_points": 0,
        "danger_points": 0,
        "warning_points": 0,
        "danger_uplift_points": 0,
        "warning_uplift_points": 0,
    }


def build_zones(points_geo: Dict[str, Any], params: ZoneParams) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """从点数据生成区域多边形（公共入口）"""
    # 1. 提取点
    pts = extract_points_from_geojson(points_geo, params.velocity_field)
    if not pts:
        return {"type": "FeatureCollection", "features": []}, _empty_meta(params)

    # 2. 投影到局部米制坐标
    lon0 = sum(p["lon"] for p in pts) / len(pts)
    lat0 = sum(p["lat"] for p in pts) / len(pts)
    for p in pts:
        x, y = project_local_meters(p["lon"], p["lat"], lon0, lat0)
        p["x"] = x
        p["y"] = y

    # 3. 按速度阈值分类
    strong = abs(float(params.strong))
    mild = abs(float(params.mild))
    danger_sub, warning_sub, danger_up, warning_up = classify_points_by_velocity(pts, mild, strong)

    # 4. 构建区域
    common = dict(
        lon0=lon0, lat0=lat0, dataset=params.dataset,
        method=params.method, eps_m=params.eps_m, min_pts=params.min_pts,
        mild=mild, strong=strong,
    )
    zone_features = (
        build_zone_level("danger", "subsidence", danger_sub, **common)
        + build_zone_level("warning", "subsidence", warning_sub, **common)
        + build_zone_level("danger", "uplift", danger_up, **common)
        + build_zone_level("warning", "uplift", warning_up, **common)
    )

    # 5. 统计
    meta = {
        "dataset": params.dataset,
        "method": params.method,
        "thresholds": {"mild": mild, "strong": strong},
        "eps_m": params.eps_m,
        "min_pts": params.min_pts,
        "zone_count": len(zone_features),
        "danger_zone_count": sum(1 for f in zone_features if (f.get("properties") or {}).get("level") == "danger"),
        "warning_zone_count": sum(1 for f in zone_features if (f.get("properties") or {}).get("level") == "warning"),
        "subsidence_zone_count": sum(1 for f in zone_features if (f.get("properties") or {}).get("direction") == "subsidence"),
        "uplift_zone_count": sum(1 for f in zone_features if (f.get("properties") or {}).get("direction") == "uplift"),
        "input_points": len(pts),
        "danger_points": len(danger_sub),
        "warning_points": len(warning_sub),
        "danger_uplift_points": len(danger_up),
        "warning_uplift_points": len(warning_up),
    }
    return {"type": "FeatureCollection", "features": zone_features}, meta
