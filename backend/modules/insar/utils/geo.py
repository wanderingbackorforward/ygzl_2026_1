# -*- coding: utf-8 -*-
"""地理计算工具"""
import math
from typing import Iterable, Optional, Tuple


def to_float(v) -> Optional[float]:
    """安全转换为浮点数"""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        x = float(v)
        return x if math.isfinite(x) else None
    s = str(v).strip()
    if not s:
        return None
    try:
        x = float(s)
    except Exception:
        return None
    return x if math.isfinite(x) else None


def project_local_meters(
    lon: float, lat: float, lon0: float, lat0: float
) -> Tuple[float, float]:
    """投影经纬度到局部米制坐标"""
    r = 6371000.0
    lat0r = math.radians(lat0)
    x = math.radians(lon - lon0) * math.cos(lat0r) * r
    y = math.radians(lat - lat0) * r
    return x, y


def unproject_local_meters(
    x: float, y: float, lon0: float, lat0: float
) -> Tuple[float, float]:
    """反投影局部米制坐标到经纬度"""
    r = 6371000.0
    lat = lat0 + math.degrees(y / r)
    lat0r = math.radians(lat0)
    denom = math.cos(lat0r) * r
    lon = lon0 + math.degrees(x / denom) if denom != 0 else lon0
    return lon, lat


def bbox_of_lonlat(
    coords: Iterable[Tuple[float, float]]
) -> Optional[Tuple[float, float, float, float]]:
    """计算经纬度坐标列表的边界框"""
    xs, ys = [], []
    for lon, lat in coords:
        if math.isfinite(lon) and math.isfinite(lat):
            xs.append(lon)
            ys.append(lat)
    if not xs or not ys:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def centroid_of_lonlat(
    coords: Iterable[Tuple[float, float]]
) -> Optional[Tuple[float, float]]:
    """计算经纬度坐标列表的质心"""
    xs, ys = [], []
    for lon, lat in coords:
        if math.isfinite(lon) and math.isfinite(lat):
            xs.append(lon)
            ys.append(lat)
    if not xs or not ys:
        return None
    return sum(xs) / len(xs), sum(ys) / len(ys)
