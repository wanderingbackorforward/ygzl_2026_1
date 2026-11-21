# -*- coding: utf-8 -*-
"""InSAR 业务逻辑层 - 数据加载、缓存管理、字段推断"""
import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from .config import config
from .convert import convert_shapefile_dir_to_geojson, write_geojson
from .zones import ZoneParams, build_zones


_D_FIELD_RE = re.compile(r"^[dD]_\d{8}$")
_SAFE_DATASET_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


# ---------------------------------------------------------------------------
# 缓存管理
# ---------------------------------------------------------------------------

def load_cached_geojson(candidate_paths: List[str]) -> Optional[Tuple[Dict[str, Any], str]]:
    """从候选路径列表中加载第一个存在的 GeoJSON 缓存"""
    for cache_file in candidate_paths:
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f), cache_file
    return None


def save_cache(geo: Dict[str, Any], out_path: str) -> Optional[str]:
    """保存 GeoJSON 到缓存，失败时静默返回 None"""
    try:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        write_geojson(geo, out_path)
        return out_path
    except Exception:
        return None


def cache_paths_for(base_name: str) -> List[str]:
    """生成缓存和打包目录下的候选路径"""
    cache_path = os.path.join(config.cache_dir, base_name)
    processed_path = os.path.join(config.processed_dir, base_name)
    if cache_path == processed_path:
        return [cache_path]
    return [cache_path, processed_path]


# ---------------------------------------------------------------------------
# 数据加载
# ---------------------------------------------------------------------------

def points_base_name(dataset: str, field: str = "") -> str:
    """生成点数据文件名"""
    if field:
        return f"{dataset}.{field}.geojson"
    if dataset == "yanggaozhong":
        return "points.geojson"
    return f"{dataset}.geojson"


def load_or_convert_points(
    dataset: str, field: str = "", refresh: bool = False
) -> Tuple[Dict[str, Any], Optional[str], bool, Optional[str]]:
    """加载或转换点数据

    Returns:
        (geojson, value_field, cached, cache_file)
    """
    base_name = points_base_name(dataset, field)

    if not refresh:
        loaded = load_cached_geojson(cache_paths_for(base_name))
        if loaded:
            return loaded[0], None, True, loaded[1]

    # 从 Shapefile 转换
    result = convert_shapefile_dir_to_geojson(
        raw_dir=config.raw_dir, dataset=dataset
    )
    geo = result.geojson
    value_field = result.value_field

    # 应用自定义字段
    if field:
        for feat in geo.get("features") or []:
            props = feat.get("properties") or {}
            props.pop("value", None)
            v = props.get(field)
            if v is not None:
                props["value"] = v
                props["value_field"] = field
        value_field = field

    # 缓存结果
    out_path = os.path.join(config.cache_dir, base_name)
    cache_file = save_cache(geo, out_path)

    return geo, value_field, False, cache_file


# ---------------------------------------------------------------------------
# BBox 过滤
# ---------------------------------------------------------------------------

def filter_by_bbox(
    geo: Dict[str, Any], bbox: Optional[Tuple[float, float, float, float]]
) -> Dict[str, Any]:
    """按边界框过滤 GeoJSON FeatureCollection"""
    if not bbox:
        return geo

    min_lon, min_lat, max_lon, max_lat = bbox
    out_feats = []
    for f in geo.get("features") or []:
        g = (f or {}).get("geometry") or {}
        if g.get("type") != "Point":
            continue
        coords = g.get("coordinates") or []
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            continue
        try:
            lon, lat = float(coords[0]), float(coords[1])
        except Exception:
            continue
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            out_feats.append(f)

    return {"type": "FeatureCollection", "features": out_feats}


# ---------------------------------------------------------------------------
# 字段推断
# ---------------------------------------------------------------------------

def infer_fields(geo: Dict[str, Any]) -> Dict[str, Any]:
    """从 GeoJSON 推断字段信息"""
    feats = geo.get("features") or []
    keys: set = set()
    d_fields: set = set()
    velocity_fields: set = set()
    preferred_vel = {
        "vel", "velocity", "rate", "mm_yr", "mm_year",
        "los", "disp", "defo", "deformation", "dlos", "vz", "v",
    }

    for f in feats[:200]:
        props = (f or {}).get("properties") or {}
        if not isinstance(props, dict):
            continue
        for k in props.keys():
            ks = str(k).strip()
            if not ks:
                continue
            keys.add(ks)
            if _D_FIELD_RE.fullmatch(ks):
                d_fields.add(ks)
            if ks.lower() in preferred_vel:
                velocity_fields.add(ks)

    fields = sorted(keys, key=lambda s: s.lower())
    d_list = sorted(d_fields, key=lambda s: s.split("_", 1)[1])
    vel_list = sorted(velocity_fields, key=lambda s: s.lower())

    recommended = vel_list[0] if vel_list else (
        "value" if "value" in fields else (
            d_list[-1] if d_list else "value"
        )
    )

    return {
        "fields": fields,
        "d_fields": d_list,
        "velocity_fields": vel_list,
        "recommended_value_field": recommended,
    }


# ---------------------------------------------------------------------------
# 区域生成
# ---------------------------------------------------------------------------

def zones_cache_key(
    dataset: str, field: str, method: str,
    mild: float, strong: float, eps_m: float, min_pts: int,
    bbox: Optional[Tuple[float, float, float, float]],
) -> str:
    """生成区域缓存键"""
    key_obj = {
        "dataset": dataset, "field": field, "method": method,
        "mild": abs(mild), "strong": abs(strong),
        "eps_m": eps_m, "min_pts": min_pts,
        "bbox": list(bbox) if bbox else None,
    }
    key_str = json.dumps(key_obj, ensure_ascii=False, sort_keys=True)
    key_hash = hashlib.sha1(key_str.encode("utf-8")).hexdigest()[:12]
    return f"zones.{dataset}.{key_hash}.geojson"


def generate_zones(
    dataset: str, field: str = "", method: str = "cluster_hull",
    mild: float = 2.0, strong: float = 10.0,
    eps_m: float = 50.0, min_pts: int = 6,
    bbox: Optional[Tuple[float, float, float, float]] = None,
    refresh: bool = False,
) -> Tuple[Dict[str, Any], Dict[str, Any], bool, Optional[str]]:
    """生成区域数据

    Returns:
        (zones_geojson, zones_meta, cached, cache_file)
    """
    base_name = zones_cache_key(
        dataset, field, method, mild, strong, eps_m, min_pts, bbox
    )

    # 尝试缓存
    if not refresh:
        loaded = load_cached_geojson(cache_paths_for(base_name))
        if loaded:
            geo = loaded[0]
            meta = _meta_from_cached_zones(geo)
            return geo, meta, True, loaded[1]

    # 加载点数据
    points_geo, _, _, _ = load_or_convert_points(dataset, field)
    points_geo = filter_by_bbox(points_geo, bbox)

    # 生成区域
    zones_geo, zones_meta = build_zones(
        points_geo,
        ZoneParams(
            dataset=dataset, velocity_field=field,
            mild=mild, strong=strong,
            method=method, eps_m=eps_m, min_pts=min_pts,
        ),
    )

    # 缓存
    out_path = os.path.join(config.cache_dir, base_name)
    cache_file = save_cache(zones_geo, out_path)

    return zones_geo, zones_meta, False, cache_file


def _meta_from_cached_zones(geo: Dict[str, Any]) -> Dict[str, Any]:
    """从缓存的区域 GeoJSON 重建统计元数据"""
    feats = (geo or {}).get("features") or []
    danger = sum(1 for f in feats if (f.get("properties") or {}).get("level") == "danger")
    warning = sum(1 for f in feats if (f.get("properties") or {}).get("level") == "warning")
    return {
        "zone_count": len(feats),
        "danger_zone_count": danger,
        "warning_zone_count": warning,
    }


# ---------------------------------------------------------------------------
# 数据集发现
# ---------------------------------------------------------------------------

def discover_datasets() -> List[str]:
    """发现所有可用数据集"""
    datasets: set = set()

    # 从 raw 目录扫描
    if os.path.isdir(config.raw_dir):
        try:
            for name in os.listdir(config.raw_dir):
                if not name or name.startswith("."):
                    continue
                if ".." in name or not _SAFE_DATASET_RE.fullmatch(name):
                    continue
                ds_dir = os.path.join(config.raw_dir, name)
                if not os.path.isdir(ds_dir):
                    continue
                if any(p.lower().endswith(".shp") for p in os.listdir(ds_dir)):
                    datasets.add(name)
        except Exception:
            pass

    # 从 processed 目录扫描
    for processed_dir in (config.processed_dir, config.cache_dir):
        try:
            if not os.path.isdir(processed_dir):
                continue
            for fn in os.listdir(processed_dir):
                if not fn.lower().endswith(".geojson"):
                    continue
                if fn == "points.geojson":
                    datasets.add("yanggaozhong")
                    continue
                ds = fn[:-8].split(".", 1)[0].strip()
                if ds and ".." not in ds and _SAFE_DATASET_RE.fullmatch(ds):
                    datasets.add(ds)
        except Exception:
            continue

    return sorted(datasets, key=lambda s: (s != "yanggaozhong", s.lower()))


# ---------------------------------------------------------------------------
# 时间序列
# ---------------------------------------------------------------------------

def get_time_series(
    dataset: str, point_id: str
) -> Dict[str, Any]:
    """获取指定点位的时间序列数据"""
    if not point_id:
        raise ValueError("缺少参数：id")

    points_geo, _, _, _ = load_or_convert_points(dataset)
    feats = points_geo.get("features") or []

    # 查找目标点
    target = None
    pid = str(point_id)
    for f in feats:
        props = (f or {}).get("properties") or {}
        fid = (f or {}).get("id")
        cand = fid if fid is not None else props.get("id")
        if cand is not None and str(cand) == pid:
            target = f
            break

    if target is None:
        return None

    # 提取时间序列
    props = (target or {}).get("properties") or {}
    d_keys = sorted(
        [k for k in props if k and _D_FIELD_RE.fullmatch(str(k).strip())],
        key=lambda s: str(s).split("_", 1)[1],
    )

    series = []
    for k in d_keys:
        raw_v = props.get(k)
        try:
            v = float(raw_v) if raw_v is not None and str(raw_v).strip() != "" else None
        except Exception:
            v = None
        date_raw = str(k).split("_", 1)[1]
        series.append({
            "date": f"{date_raw[0:4]}-{date_raw[4:6]}-{date_raw[6:8]}",
            "value": v,
        })

    return {
        "dataset": dataset,
        "id": str((target or {}).get("id") or props.get("id") or point_id),
        "series": series,
        "properties": {
            "velocity": props.get("velocity") or props.get("vel") or props.get("rate"),
            "value_field": props.get("value_field"),
        },
    }
