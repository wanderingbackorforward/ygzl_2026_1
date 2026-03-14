# -*- coding: utf-8 -*-
"""Shapefile 转 GeoJSON 转换器"""
import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .utils.geo import geometry_to_lonlat, to_float
from .utils.validation import validate_dataset


@dataclass(frozen=True)
class ConvertResult:
    geojson: Dict[str, Any]
    source_shp_path: str
    value_field: Optional[str]


# ---------------------------------------------------------------------------
# 内部工具
# ---------------------------------------------------------------------------

def _find_single_file(dir_path: str, ext: str) -> Optional[str]:
    """在目录中查找第一个匹配扩展名的文件"""
    if not os.path.isdir(dir_path):
        return None
    matches = sorted(p for p in os.listdir(dir_path) if p.lower().endswith(ext.lower()))
    return os.path.join(dir_path, matches[0]) if matches else None


def _infer_value_field(properties_list: List[Dict[str, Any]]) -> Optional[str]:
    """从属性列表推断值字段"""
    if not properties_list:
        return None

    preferred = [
        "vel", "velocity", "rate", "value", "los", "disp", "defo", "deformation",
        "mm_yr", "mm_y", "mm_year", "v", "vz", "d", "dlos",
    ]
    keys = set()
    for props in properties_list:
        keys.update((k or "").strip() for k in props.keys())

    key_lut = {k.lower(): k for k in keys if k}
    for k in preferred:
        if k in key_lut:
            return key_lut[k]

    d_keys = [k for k in keys if re.match(r"^[dD]_\d{8}$", k)]
    if d_keys:
        d_keys.sort(key=lambda s: s.split("_", 1)[1])
        return d_keys[-1]

    numeric_counts: Dict[str, int] = {}
    for props in properties_list:
        for k, v in props.items():
            if v is None:
                continue
            if isinstance(v, (int, float)):
                numeric_counts[k] = numeric_counts.get(k, 0) + 1
            elif isinstance(v, str):
                try:
                    float(v)
                    numeric_counts[k] = numeric_counts.get(k, 0) + 1
                except Exception:
                    pass

    if not numeric_counts:
        return None
    return sorted(numeric_counts.items(), key=lambda x: (-x[1], x[0].lower()))[0][0]


# ---------------------------------------------------------------------------
# 公共接口
# ---------------------------------------------------------------------------

def convert_shapefile_dir_to_geojson(raw_dir: str, dataset: str) -> ConvertResult:
    """从 Shapefile 目录转换为 GeoJSON"""
    try:
        import shapefile  # type: ignore
    except Exception as e:
        raise RuntimeError("缺少依赖：请在后端环境安装 pyshp（pip install pyshp）") from e

    dataset = validate_dataset(dataset)
    dataset_dir = os.path.join(raw_dir, dataset)
    shp_path = _find_single_file(dataset_dir, ".shp") or os.path.join(dataset_dir, f"{dataset}.shp")
    if not os.path.exists(shp_path):
        raise FileNotFoundError(f"未找到 Shapefile：{shp_path}")

    reader = shapefile.Reader(shp_path, encodingErrors="ignore")
    field_names = [f[0] for f in reader.fields[1:]]

    # 读取属性
    properties_list: List[Dict[str, Any]] = []
    for rec in reader.records():
        props = {field_names[i]: rec[i] for i in range(min(len(field_names), len(rec)))}
        properties_list.append(props)

    value_field = _infer_value_field(properties_list)

    # 构建 GeoJSON features
    features: List[Dict[str, Any]] = []
    for idx, (shape, props) in enumerate(zip(reader.shapes(), properties_list)):
        geom = shape.__geo_interface__ if hasattr(shape, "__geo_interface__") else None
        if not geom:
            continue

        geometry = geometry_to_lonlat({"type": geom.get("type"), "coordinates": geom.get("coordinates")})
        fid = props.get("id") or props.get("ID") or props.get("Id") or idx

        out_props = dict(props)
        out_props["id"] = fid
        if value_field:
            value = to_float(props.get(value_field))
            if value is not None:
                out_props["value"] = value
            if value_field not in ("value", "VALUE"):
                out_props["value_field"] = value_field

        features.append({"type": "Feature", "id": fid, "properties": out_props, "geometry": geometry})

    return ConvertResult(
        geojson={"type": "FeatureCollection", "features": features},
        source_shp_path=shp_path,
        value_field=value_field,
    )


def write_geojson(geojson_obj: Dict[str, Any], out_path: str) -> None:
    """写入 GeoJSON 文件"""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson_obj, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main() -> int:
    import argparse
    from .config import config

    parser = argparse.ArgumentParser(description="Shapefile to GeoJSON converter")
    parser.add_argument("--dataset", default="yanggaozhong")
    parser.add_argument("--raw-dir", default=config.raw_dir)
    parser.add_argument("--out", default=os.path.join(config.processed_dir, "points.geojson"))
    args = parser.parse_args()

    result = convert_shapefile_dir_to_geojson(raw_dir=os.path.abspath(args.raw_dir), dataset=args.dataset)
    write_geojson(result.geojson, os.path.abspath(args.out))
    print(os.path.abspath(args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
