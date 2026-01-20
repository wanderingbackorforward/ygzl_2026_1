import json
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass(frozen=True)
class ConvertResult:
    geojson: Dict[str, Any]
    source_shp_path: str
    value_field: Optional[str]


_SAFE_DATASET_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _find_single_file(dir_path: str, ext: str) -> Optional[str]:
    if not os.path.isdir(dir_path):
        return None
    matches = [p for p in os.listdir(dir_path) if p.lower().endswith(ext.lower())]
    if not matches:
        return None
    matches.sort()
    return os.path.join(dir_path, matches[0])


def _infer_value_field(properties_list: List[Dict[str, Any]]) -> Optional[str]:
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
                continue
            if isinstance(v, str):
                try:
                    float(v)
                    numeric_counts[k] = numeric_counts.get(k, 0) + 1
                except Exception:
                    pass

    if not numeric_counts:
        return None
    return sorted(numeric_counts.items(), key=lambda x: (-x[1], x[0].lower()))[0][0]


def _web_mercator_to_lon_lat(x: float, y: float) -> Tuple[float, float]:
    r = 20037508.34
    lon = (x / r) * 180.0
    lat = (y / r) * 180.0
    lat = 180.0 / math.pi * (2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
    return lon, lat


def _to_lon_lat(x: float, y: float) -> Tuple[float, float]:
    if -180.0 <= x <= 180.0 and -90.0 <= y <= 90.0:
        return x, y
    if abs(x) <= 20037508.34 and abs(y) <= 20037508.34:
        return _web_mercator_to_lon_lat(x, y)
    return x, y


def _safe_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            return float(s)
        except Exception:
            return None
    return None


def _mean_xy(points: Iterable[Tuple[float, float]]) -> Optional[Tuple[float, float]]:
    xs: List[float] = []
    ys: List[float] = []
    for x, y in points:
        xs.append(float(x))
        ys.append(float(y))
    if not xs:
        return None
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _geometry_to_lon_lat(geometry: Dict[str, Any]) -> Dict[str, Any]:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not gtype or coords is None:
        return geometry

    def conv_pair(pair: List[float]) -> List[float]:
        lon, lat = _to_lon_lat(float(pair[0]), float(pair[1]))
        return [lon, lat]

    if gtype == "Point":
        return {"type": "Point", "coordinates": conv_pair(list(coords))}
    if gtype == "MultiPoint":
        return {"type": "MultiPoint", "coordinates": [conv_pair(list(p)) for p in coords]}
    if gtype == "LineString":
        return {"type": "LineString", "coordinates": [conv_pair(list(p)) for p in coords]}
    if gtype == "MultiLineString":
        return {"type": "MultiLineString", "coordinates": [[conv_pair(list(p)) for p in line] for line in coords]}
    if gtype == "Polygon":
        return {"type": "Polygon", "coordinates": [[conv_pair(list(p)) for p in ring] for ring in coords]}
    if gtype == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [[[conv_pair(list(p)) for p in ring] for ring in poly] for poly in coords]}
    return geometry


def convert_shapefile_dir_to_geojson(raw_dir: str, dataset: str) -> ConvertResult:
    try:
        import shapefile  # type: ignore
    except Exception as e:
        raise RuntimeError("缺少依赖：请在后端环境安装 pyshp（pip install pyshp）") from e

    dataset = (dataset or "").strip()
    if not dataset:
        dataset = "yanggaozhong"
    if ".." in dataset or not _SAFE_DATASET_RE.fullmatch(dataset):
        raise ValueError("非法 dataset：仅允许字母/数字/._-，且禁止包含 ..")

    dataset_dir = os.path.join(raw_dir, dataset)
    shp_path = _find_single_file(dataset_dir, ".shp") or os.path.join(dataset_dir, f"{dataset}.shp")
    if not os.path.exists(shp_path):
        raise FileNotFoundError(f"未找到 Shapefile：{shp_path}")

    reader = shapefile.Reader(shp_path, encodingErrors="ignore")
    field_names = [f[0] for f in reader.fields[1:]]

    properties_list: List[Dict[str, Any]] = []
    shapes = reader.shapes()
    records = reader.records()

    for rec in records:
        props = {}
        for i, k in enumerate(field_names):
            props[k] = rec[i] if i < len(rec) else None
        properties_list.append(props)

    value_field = _infer_value_field(properties_list)

    features: List[Dict[str, Any]] = []
    for idx, (shape, props) in enumerate(zip(shapes, properties_list)):
        geom = shape.__geo_interface__ if hasattr(shape, "__geo_interface__") else None
        if not geom:
            continue
        geometry = _geometry_to_lon_lat({"type": geom.get("type"), "coordinates": geom.get("coordinates")})
        fid = props.get("id") or props.get("ID") or props.get("Id") or idx
        value = _safe_float(props.get(value_field)) if value_field else None
        out_props = dict(props)
        out_props["id"] = fid
        if value is not None:
            out_props["value"] = value
        if value_field and value_field not in ("value", "VALUE"):
            out_props["value_field"] = value_field

        features.append({"type": "Feature", "id": fid, "properties": out_props, "geometry": geometry})

    geojson = {"type": "FeatureCollection", "features": features}
    return ConvertResult(geojson=geojson, source_shp_path=shp_path, value_field=value_field)


def write_geojson(geojson_obj: Dict[str, Any], out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson_obj, f, ensure_ascii=False)


def main() -> int:
    import argparse

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    default_base = os.path.join(project_root, "static", "data", "insar")
    if not os.path.isdir(default_base):
        default_base = os.path.join(project_root, "frontend", "public", "static", "data", "insar")
    default_raw = os.path.join(default_base, "raw")
    default_out = os.path.join(default_base, "processed", "points.geojson")

    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="yanggaozhong")
    parser.add_argument("--raw-dir", default=default_raw)
    parser.add_argument("--out", default=default_out)
    args = parser.parse_args()

    raw_dir = os.path.abspath(args.raw_dir)
    out_path = os.path.abspath(args.out)
    result = convert_shapefile_dir_to_geojson(raw_dir=raw_dir, dataset=args.dataset)
    write_geojson(result.geojson, out_path)
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
