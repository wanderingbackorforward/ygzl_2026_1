# -*- coding: utf-8 -*-
"""参数校验工具"""
import re
from typing import Optional, Tuple


_SAFE_DATASET_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_SAFE_FIELD_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def validate_dataset(name: Optional[str]) -> str:
    """校验并清理 dataset 名称"""
    s = (name or "").strip()
    if not s:
        return "yanggaozhong"
    if ".." in s or not _SAFE_DATASET_RE.fullmatch(s):
        raise ValueError("非法 dataset：仅允许字母/数字/._-，且禁止包含 ..")
    return s


def validate_field(name: Optional[str]) -> str:
    """校验并清理 field 名称"""
    s = (name or "").strip()
    if not s:
        return ""
    if ".." in s or not _SAFE_FIELD_RE.fullmatch(s):
        raise ValueError("非法 field：仅允许字母/数字/._-，且禁止包含 ..")
    return s


def parse_bbox(bbox_str: Optional[str]) -> Optional[Tuple[float, float, float, float]]:
    """解析边界框字符串：minLon,minLat,maxLon,maxLat"""
    s = (bbox_str or "").strip()
    if not s:
        return None

    parts = [p.strip() for p in s.split(",")]
    if len(parts) != 4:
        raise ValueError("非法 bbox：格式应为 minLon,minLat,maxLon,maxLat")

    try:
        min_lon, min_lat, max_lon, max_lat = (
            float(parts[0]),
            float(parts[1]),
            float(parts[2]),
            float(parts[3]),
        )
    except Exception as e:
        raise ValueError("非法 bbox：必须是 4 个数字") from e

    if not (
        -180 <= min_lon <= 180
        and -180 <= max_lon <= 180
        and -90 <= min_lat <= 90
        and -90 <= max_lat <= 90
    ):
        raise ValueError("非法 bbox：经纬度范围不合法")

    if max_lon <= min_lon or max_lat <= min_lat:
        raise ValueError("非法 bbox：max 必须大于 min")

    return min_lon, min_lat, max_lon, max_lat
