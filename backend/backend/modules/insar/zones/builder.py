# -*- coding: utf-8 -*-
"""区域构建器 - 从点数据生成区域多边形"""
import hashlib
import math
from typing import Any, Dict, List, Optional, Tuple

from ..utils.geo import (
    bbox_of_lonlat,
    centroid_of_lonlat,
    project_local_meters,
    to_float,
    unproject_local_meters,
)
from .clustering import dbscan_grid
from .geometry import close_ring, convex_hull, ring_from_center


def _percentile(sorted_vals: List[float], p: float) -> float:
    """计算百分位数"""
    if not sorted_vals:
        return 0.0
    p = max(0.0, min(1.0, float(p)))
    idx = (len(sorted_vals) - 1) * p
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return float(sorted_vals[lo])
    t = idx - lo
    return float(sorted_vals[lo] * (1 - t) + sorted_vals[hi] * t)


def _feature_id(feature: Any, props: Dict[str, Any]) -> str:
    """提取 feature ID"""
    fid = None
    try:
        fid = feature.get("id")
    except Exception:
        fid = None
    if fid is None:
        fid = props.get("id")
    return "" if fid is None else str(fid)


def _get_lon_lat(feature: Any) -> Optional[Tuple[float, float]]:
    """从 feature 提取经纬度"""
    try:
        g = (feature or {}).get("geometry") or {}
        if g.get("type") != "Point":
            return None
        coords = g.get("coordinates") or []
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            return None
        lon = to_float(coords[0])
        lat = to_float(coords[1])
        if lon is None or lat is None:
            return None
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            return None
        return float(lon), float(lat)
    except Exception:
        return None


def _get_velocity(props: Dict[str, Any], velocity_field: str) -> Optional[float]:
    """从属性提取速度值"""
    if velocity_field:
        v = to_float(props.get(velocity_field))
        if v is not None:
            return v
    for k in ("velocity", "vel", "rate", "v", "value"):
        v = to_float(props.get(k))
        if v is not None:
            return v
    return None


def _zone_id(dataset: str, level: str, direction: str, method: str, point_ids: List[str], extra: str) -> str:
    """生成区域唯一 ID"""
    base = "|".join([dataset, level, direction, method, extra, ",".join(point_ids[:200])])
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:10]
    return f"{level}-{direction}-{h}"


def build_zone_level(
    level: str,
    direction: str,
    level_pts: List[Dict[str, Any]],
    lon0: float,
    lat0: float,
    dataset: str,
    method: str,
    eps_m: float,
    min_pts: int,
    mild: float,
    strong: float,
) -> List[Dict[str, Any]]:
    """构建单个级别的区域"""
    if not level_pts:
        return []

    xs = [float(p["x"]) for p in level_pts]
    ys = [float(p["y"]) for p in level_pts]
    clusters = dbscan_grid(xs, ys, eps_m, min_pts)

    out_feats: List[Dict[str, Any]] = []
    for cidx, idxs in enumerate(clusters):
        members = [level_pts[i] for i in idxs]
        member_ids = [p["id"] for p in members if p["id"]]
        vlist = [float(p["v"]) for p in members if p["v"] is not None]
        vlist.sort()
        min_v = float(vlist[0]) if vlist else None
        p95_v = float(_percentile(vlist, 0.95)) if vlist else None

        xy = [(float(p["x"]), float(p["y"])) for p in members]
        if len(xy) >= 3:
            hull = convex_hull(xy)
            ring_xy = close_ring(hull)
        else:
            cx = sum(a for a, _ in xy) / len(xy)
            cy = sum(b for _, b in xy) / len(xy)
            ring_xy = close_ring(ring_from_center((cx, cy), max(5.0, eps_m), 12))

        ring_lonlat = [unproject_local_meters(x, y, lon0, lat0) for x, y in ring_xy]
        bb = bbox_of_lonlat(ring_lonlat)
        cc = centroid_of_lonlat(ring_lonlat)
        zid = _zone_id(dataset, level, direction, method, sorted(member_ids), f"{cidx}|{eps_m}|{min_pts}|{mild}|{strong}")

        out_feats.append(
            {
                "type": "Feature",
                "id": zid,
                "geometry": {"type": "Polygon", "coordinates": [[list(x) for x in ring_lonlat]]},
                "properties": {
                    "zone_id": zid,
                    "dataset": dataset,
                    "level": level,
                    "direction": direction,
                    "method": method,
                    "thresholds": {"mild": mild, "strong": strong},
                    "point_count": len(members),
                    "min_velocity": min_v,
                    "p95_velocity": p95_v,
                    "bbox": list(bb) if bb else None,
                    "centroid": list(cc) if cc else None,
                },
            }
        )
    return out_feats


def extract_points_from_geojson(
    points_geo: Dict[str, Any], velocity_field: str
) -> List[Dict[str, Any]]:
    """从 GeoJSON 提取点数据"""
    feats = points_geo.get("features") or []
    pts: List[Dict[str, Any]] = []

    for f in feats:
        props = (f or {}).get("properties") or {}
        ll = _get_lon_lat(f)
        if not ll:
            continue
        v = _get_velocity(props if isinstance(props, dict) else {}, velocity_field)
        pid = _feature_id(f, props if isinstance(props, dict) else {})
        pts.append({"id": pid, "lon": ll[0], "lat": ll[1], "v": v, "props": props, "feature": f})

    return pts


def classify_points_by_velocity(
    pts: List[Dict[str, Any]], mild: float, strong: float
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """按速度阈值分类点"""
    strong = abs(float(strong))
    mild = abs(float(mild))

    danger_subsidence = [p for p in pts if p["v"] is not None and p["v"] <= -strong]
    warning_subsidence = [p for p in pts if p["v"] is not None and (-strong < p["v"] <= -mild)]
    danger_uplift = [p for p in pts if p["v"] is not None and p["v"] >= strong]
    warning_uplift = [p for p in pts if p["v"] is not None and (mild <= p["v"] < strong)]

    return danger_subsidence, warning_subsidence, danger_uplift, warning_uplift
