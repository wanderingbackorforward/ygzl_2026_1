import json
import os
import re
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, jsonify, request

from modules.insar.convert import convert_shapefile_dir_to_geojson, write_geojson

insar_bp = Blueprint("insar", __name__, url_prefix="/api/insar")


def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))


def _is_serverless() -> bool:
    return (os.getenv("VERCEL") == "1") or bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME")) or bool(os.getenv("NOW_REGION"))


def _discover_static_root() -> str:
    env_root = (os.getenv("INSAR_PROJECT_ROOT") or os.getenv("PROJECT_ROOT") or "").strip()
    if env_root:
        env_root_abs = os.path.abspath(env_root)
        if os.path.isdir(os.path.join(env_root_abs, "static")):
            return env_root_abs

    roots: list[str] = []
    try:
        roots.append(_project_root())
    except Exception:
        pass

    roots.append(os.path.abspath(os.getcwd()))
    for r in list(roots):
        roots.append(os.path.abspath(os.path.join(r, "..")))

    seen: set[str] = set()
    candidates: list[str] = []
    for r in roots:
        if not r:
            continue
        a = os.path.abspath(r)
        if a in seen:
            continue
        seen.add(a)
        candidates.append(a)

    for root in candidates:
        if os.path.isdir(os.path.join(root, "static", "data", "insar")):
            return root
    for root in candidates:
        if os.path.isdir(os.path.join(root, "static")):
            return root
    return candidates[0] if candidates else os.path.abspath(os.getcwd())


def _paths() -> tuple[str, str, str]:
    root = _discover_static_root()
    raw_dir = os.path.join(root, "static", "data", "insar", "raw")
    processed_dir = os.path.join(root, "static", "data", "insar", "processed")
    cache_dir = os.getenv("INSAR_CACHE_DIR") or (os.path.join("/tmp", "insar", "processed") if _is_serverless() else processed_dir)
    return raw_dir, processed_dir, cache_dir


_SAFE_DATASET_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_SAFE_FIELD_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def _sanitize_dataset(name: str) -> str:
    s = (name or "").strip()
    if not s:
        return "yanggaozhong"
    if ".." in s or not _SAFE_DATASET_RE.fullmatch(s):
        raise ValueError("非法 dataset：仅允许字母/数字/._-，且禁止包含 ..")
    return s


def _sanitize_field(name: str) -> str:
    s = (name or "").strip()
    if not s:
        return ""
    if ".." in s or not _SAFE_FIELD_RE.fullmatch(s):
        raise ValueError("非法 field：仅允许字母/数字/._-，且禁止包含 ..")
    return s


_D_FIELD_RE = re.compile(r"^[dD]_\d{8}$")


def _parse_bbox(bbox_str: str) -> Optional[Tuple[float, float, float, float]]:
    s = (bbox_str or "").strip()
    if not s:
        return None
    parts = [p.strip() for p in s.split(",")]
    if len(parts) != 4:
        raise ValueError("非法 bbox：格式应为 minLon,minLat,maxLon,maxLat")
    try:
        min_lon, min_lat, max_lon, max_lat = (float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]))
    except Exception as e:
        raise ValueError("非法 bbox：必须是 4 个数字") from e
    if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180 and -90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        raise ValueError("非法 bbox：经纬度范围不合法")
    if max_lon <= min_lon or max_lat <= min_lat:
        raise ValueError("非法 bbox：max 必须大于 min")
    return min_lon, min_lat, max_lon, max_lat


def _filter_featurecollection_bbox(geo: Dict[str, Any], bbox: Tuple[float, float, float, float]) -> Dict[str, Any]:
    min_lon, min_lat, max_lon, max_lat = bbox
    feats = geo.get("features") or []
    out_feats = []
    for f in feats:
        g = (f or {}).get("geometry") or {}
        if g.get("type") != "Point":
            continue
        coords = g.get("coordinates") or []
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            continue
        try:
            lon = float(coords[0])
            lat = float(coords[1])
        except Exception:
            continue
        if (min_lon <= lon <= max_lon) and (min_lat <= lat <= max_lat):
            out_feats.append(f)
    return {"type": "FeatureCollection", "features": out_feats}


def _load_cached_geojson(candidate_paths: list[str]) -> Optional[Tuple[Dict[str, Any], str]]:
    for cache_file in candidate_paths:
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f), cache_file
    return None


def _infer_fields_from_geojson(geo: Dict[str, Any]) -> Tuple[list[str], list[str], list[str]]:
    feats = geo.get("features") or []
    keys: set[str] = set()
    d_fields: set[str] = set()
    velocity_fields: set[str] = set()
    preferred_vel = {"vel", "velocity", "rate", "mm_yr", "mm_year", "los", "disp", "defo", "deformation", "dlos", "vz", "v"}

    for f in feats[:200]:
        props = (f or {}).get("properties") or {}
        if isinstance(props, dict):
            for k in props.keys():
                if not k:
                    continue
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
    return fields, d_list, vel_list


def _recommend_value_field(fields: list[str], d_fields: list[str], velocity_fields: list[str]) -> str:
    if velocity_fields:
        return velocity_fields[0]
    if "value" in fields:
        return "value"
    if d_fields:
        return d_fields[-1]
    return "value"


@insar_bp.route("/points", methods=["GET"])
def insar_points():
    raw_dir, packaged_processed_dir, cache_processed_dir = _paths()
    try:
        dataset = _sanitize_dataset(request.args.get("dataset") or "yanggaozhong")
        field = _sanitize_field(request.args.get("field") or "")
        refresh = (request.args.get("refresh") or "").strip() in ("1", "true", "yes")
        bbox = _parse_bbox(request.args.get("bbox") or "")

        base_name = "points.geojson" if dataset == "yanggaozhong" else f"{dataset}.geojson"
        if field:
            base_name = f"{dataset}.{field}.geojson"
        out_path = os.path.join(cache_processed_dir, base_name)

        geo: Optional[Dict[str, Any]] = None
        cache_file: Optional[str] = None
        cached = False
        if not refresh:
            packaged_out_path = os.path.join(packaged_processed_dir, base_name)
            loaded = _load_cached_geojson([out_path, packaged_out_path] if packaged_out_path != out_path else [out_path])
            if loaded:
                geo, cache_file = loaded
                cached = True

        value_field: Optional[str] = None
        if geo is None:
            result = convert_shapefile_dir_to_geojson(raw_dir=raw_dir, dataset=dataset)
            geo = result.geojson
            value_field = result.value_field
            if field:
                for feat in geo.get("features") or []:
                    props = feat.get("properties") or {}
                    if "value" in props:
                        props.pop("value", None)
                    v = props.get(field)
                    if v is not None:
                        props["value"] = v
                        props["value_field"] = field
                value_field = field
            try:
                os.makedirs(cache_processed_dir, exist_ok=True)
                write_geojson(geo, out_path)
                cache_file = out_path
            except Exception:
                pass

        total_feature_count = len(geo.get("features") or [])
        out_geo = _filter_featurecollection_bbox(geo, bbox) if bbox else geo
        feature_count = len(out_geo.get("features") or [])
        return jsonify(
            {
                "status": "success",
                "data": out_geo,
                "meta": {
                    "dataset": dataset,
                    "cached": cached,
                    "feature_count": feature_count,
                    "total_feature_count": total_feature_count,
                    "value_field": field or value_field,
                    "cache_file": os.path.basename(cache_file) if cache_file else base_name,
                    "args": dict(request.args),
                },
            }
        )
    except Exception as e:
        if isinstance(e, ValueError):
            return jsonify({"status": "error", "message": str(e)}), 400
        dataset_hint = locals().get("dataset") or "dataset"
        abs_hint_dir = os.path.abspath(os.path.join(raw_dir, dataset_hint))
        return jsonify(
            {
                "status": "error",
                "message": str(e),
                "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下（至少 .shp + .dbf）",
                "meta": {"dataset": dataset_hint, "raw_dir": raw_dir, "processed_dir": packaged_processed_dir, "cache_dir": cache_processed_dir},
            }
        ), 400


@insar_bp.route("/datasets", methods=["GET"])
def insar_datasets():
    raw_dir, packaged_processed_dir, cache_processed_dir = _paths()
    datasets: set[str] = set()

    try:
        if os.path.isdir(raw_dir):
            for name in os.listdir(raw_dir):
                if not name or name.startswith("."):
                    continue
                if ".." in name or not _SAFE_DATASET_RE.fullmatch(name):
                    continue
                ds_dir = os.path.join(raw_dir, name)
                if not os.path.isdir(ds_dir):
                    continue
                has_shp = any(p.lower().endswith(".shp") for p in os.listdir(ds_dir))
                if has_shp:
                    datasets.add(name)
    except Exception:
        pass

    for processed_dir in (packaged_processed_dir, cache_processed_dir):
        try:
            if not os.path.isdir(processed_dir):
                continue
            for fn in os.listdir(processed_dir):
                if not fn.lower().endswith(".geojson"):
                    continue
                if fn == "points.geojson":
                    datasets.add("yanggaozhong")
                    continue
                base = fn[:-8]
                ds = base.split(".", 1)[0].strip()
                if ds and ".." not in ds and _SAFE_DATASET_RE.fullmatch(ds):
                    datasets.add(ds)
        except Exception:
            continue

    out = sorted(datasets, key=lambda s: (s != "yanggaozhong", s.lower()))
    return jsonify({"status": "success", "data": {"datasets": out, "default": "yanggaozhong"}})


@insar_bp.route("/fields", methods=["GET"])
def insar_fields():
    raw_dir, packaged_processed_dir, cache_processed_dir = _paths()
    try:
        dataset = _sanitize_dataset(request.args.get("dataset") or "yanggaozhong")
        base_name = "points.geojson" if dataset == "yanggaozhong" else f"{dataset}.geojson"
        out_path = os.path.join(cache_processed_dir, base_name)
        packaged_out_path = os.path.join(packaged_processed_dir, base_name)
        loaded = _load_cached_geojson([out_path, packaged_out_path] if packaged_out_path != out_path else [out_path])
        geo: Optional[Dict[str, Any]] = loaded[0] if loaded else None
        if geo is None:
            result = convert_shapefile_dir_to_geojson(raw_dir=raw_dir, dataset=dataset)
            geo = result.geojson
        fields, d_fields, velocity_fields = _infer_fields_from_geojson(geo)
        recommended = _recommend_value_field(fields, d_fields, velocity_fields)
        return jsonify(
            {
                "status": "success",
                "data": {
                    "dataset": dataset,
                    "fields": fields,
                    "d_fields": d_fields,
                    "velocity_fields": velocity_fields,
                    "recommended_value_field": recommended,
                },
            }
        )
    except Exception as e:
        if isinstance(e, ValueError):
            return jsonify({"status": "error", "message": str(e)}), 400
        dataset_hint = (request.args.get("dataset") or "").strip() or "dataset"
        abs_hint_dir = os.path.abspath(os.path.join(raw_dir, dataset_hint))
        return jsonify({"status": "error", "message": str(e), "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下"}), 400


@insar_bp.route("/series", methods=["GET"])
def insar_series():
    raw_dir, packaged_processed_dir, cache_processed_dir = _paths()
    try:
        dataset = _sanitize_dataset(request.args.get("dataset") or "yanggaozhong")
        point_id = (request.args.get("id") or "").strip()
        if not point_id:
            raise ValueError("缺少参数：id")
        base_name = "points.geojson" if dataset == "yanggaozhong" else f"{dataset}.geojson"
        out_path = os.path.join(cache_processed_dir, base_name)
        packaged_out_path = os.path.join(packaged_processed_dir, base_name)
        loaded = _load_cached_geojson([out_path, packaged_out_path] if packaged_out_path != out_path else [out_path])
        geo: Optional[Dict[str, Any]] = loaded[0] if loaded else None
        if geo is None:
            result = convert_shapefile_dir_to_geojson(raw_dir=raw_dir, dataset=dataset)
            geo = result.geojson

        feats = geo.get("features") or []
        target = None
        pid = str(point_id)
        for f in feats:
            props = (f or {}).get("properties") or {}
            fid = (f or {}).get("id")
            cand = fid if fid is not None else props.get("id")
            if cand is None:
                continue
            if str(cand) == pid:
                target = f
                break
        if target is None:
            return jsonify({"status": "error", "message": "未找到该点位", "meta": {"dataset": dataset, "id": point_id}}), 404

        props = (target or {}).get("properties") or {}
        d_keys = [k for k in props.keys() if k and _D_FIELD_RE.fullmatch(str(k).strip())]
        d_keys.sort(key=lambda s: str(s).split("_", 1)[1])
        series = []
        for k in d_keys:
            raw_v = props.get(k)
            try:
                v = float(raw_v) if raw_v is not None and str(raw_v).strip() != "" else None
            except Exception:
                v = None
            date_raw = str(k).split("_", 1)[1]
            series.append({"date": f"{date_raw[0:4]}-{date_raw[4:6]}-{date_raw[6:8]}", "value": v})

        return jsonify(
            {
                "status": "success",
                "data": {
                    "dataset": dataset,
                    "id": str((target or {}).get("id") or props.get("id") or point_id),
                    "series": series,
                    "properties": {"velocity": props.get("velocity") or props.get("vel") or props.get("rate"), "value_field": props.get("value_field")},
                },
            }
        )
    except Exception as e:
        if isinstance(e, ValueError):
            return jsonify({"status": "error", "message": str(e)}), 400
        return jsonify({"status": "error", "message": str(e)}), 400
