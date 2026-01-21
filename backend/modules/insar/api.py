import hashlib
import json
import os
import re
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, jsonify, request

from modules.insar.convert import convert_shapefile_dir_to_geojson, write_geojson
from modules.insar.zones import ZoneParams, build_zones

insar_bp = Blueprint("insar", __name__, url_prefix="/api/insar")


def _project_root() -> str:
    here = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.abspath(os.path.join(here, "../../../..")),
        os.path.abspath(os.path.join(here, "../../..")),
    ]
    for c in candidates:
        if os.path.isdir(os.path.join(c, "backend")) and os.path.isdir(os.path.join(c, "frontend")):
            return c
        if os.path.isdir(os.path.join(c, "static")) and os.path.isdir(os.path.join(c, "backend")):
            return c
    return candidates[0]


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


def _discover_insar_base_dir() -> str:
    env_dir = (os.getenv("INSAR_DATA_DIR") or "").strip()
    if env_dir:
        env_dir_abs = os.path.abspath(env_dir)
        if os.path.isdir(env_dir_abs):
            return env_dir_abs

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

    rel_bases = [
        os.path.join("static", "data", "insar"),
        os.path.join("frontend", "public", "static", "data", "insar"),
        os.path.join("frontend", "dist", "static", "data", "insar"),
    ]
    for root in candidates:
        for rel in rel_bases:
            base = os.path.join(root, rel)
            if os.path.isdir(os.path.join(base, "raw")) or os.path.isdir(os.path.join(base, "processed")):
                return base

    root = _discover_static_root()
    return os.path.join(root, "static", "data", "insar")


def _paths() -> tuple[str, str, str]:
    base_dir = _discover_insar_base_dir()
    raw_dir = os.path.join(base_dir, "raw")
    processed_dir = os.path.join(base_dir, "processed")
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
        zones_meta: Optional[Dict[str, Any]] = None
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
                "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下（至少 .shp + .dbf）。也可设置 INSAR_DATA_DIR 指向包含 raw/processed 的 insar 数据目录。",
                "meta": {
                    "dataset": dataset_hint,
                    "insar_data_dir": os.path.abspath(os.path.join(raw_dir, "..")),
                    "raw_dir": raw_dir,
                    "processed_dir": packaged_processed_dir,
                    "cache_dir": cache_processed_dir,
                },
            }
        ), 400


@insar_bp.route("/zones", methods=["GET"])
def insar_zones():
    raw_dir, packaged_processed_dir, cache_processed_dir = _paths()
    try:
        dataset = _sanitize_dataset(request.args.get("dataset") or "yanggaozhong")
        field = _sanitize_field(request.args.get("field") or "")
        refresh = (request.args.get("refresh") or "").strip() in ("1", "true", "yes")
        bbox = _parse_bbox(request.args.get("bbox") or "")
        method = (request.args.get("method") or "").strip() or "cluster_hull"
        if method != "cluster_hull":
            raise ValueError("非法 method：当前仅支持 cluster_hull")

        mild_raw = request.args.get("mild")
        strong_raw = request.args.get("strong")
        eps_m_raw = request.args.get("eps_m")
        min_pts_raw = request.args.get("min_pts")

        mild = float(mild_raw) if mild_raw is not None and str(mild_raw).strip() != "" else 2.0
        strong = float(strong_raw) if strong_raw is not None and str(strong_raw).strip() != "" else 10.0
        eps_m = float(eps_m_raw) if eps_m_raw is not None and str(eps_m_raw).strip() != "" else 50.0
        min_pts = int(min_pts_raw) if min_pts_raw is not None and str(min_pts_raw).strip() != "" else 6

        key_obj = {
            "dataset": dataset,
            "field": field,
            "method": method,
            "mild": abs(float(mild)),
            "strong": abs(float(strong)),
            "eps_m": float(eps_m),
            "min_pts": int(min_pts),
            "bbox": list(bbox) if bbox else None,
        }
        key_str = json.dumps(key_obj, ensure_ascii=False, sort_keys=True)
        key_hash = hashlib.sha1(key_str.encode("utf-8")).hexdigest()[:12]
        base_name = f"zones.{dataset}.{key_hash}.geojson"
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

        if geo is None:
            points_base_name = "points.geojson" if dataset == "yanggaozhong" else f"{dataset}.geojson"
            if field:
                points_base_name = f"{dataset}.{field}.geojson"
            points_out_path = os.path.join(cache_processed_dir, points_base_name)
            points_packaged_out_path = os.path.join(packaged_processed_dir, points_base_name)
            loaded_points = _load_cached_geojson(
                [points_out_path, points_packaged_out_path] if points_packaged_out_path != points_out_path else [points_out_path]
            )
            points_geo: Optional[Dict[str, Any]] = loaded_points[0] if loaded_points else None
            if points_geo is None:
                result = convert_shapefile_dir_to_geojson(raw_dir=raw_dir, dataset=dataset)
                points_geo = result.geojson
                if field:
                    for feat in points_geo.get("features") or []:
                        props = feat.get("properties") or {}
                        if "value" in props:
                            props.pop("value", None)
                        v = props.get(field)
                        if v is not None:
                            props["value"] = v
                            props["value_field"] = field
                    try:
                        os.makedirs(cache_processed_dir, exist_ok=True)
                        write_geojson(points_geo, points_out_path)
                    except Exception:
                        pass

            points_geo = _filter_featurecollection_bbox(points_geo, bbox) if bbox else points_geo
            zones_geo, zones_meta = build_zones(
                points_geo,
                ZoneParams(
                    dataset=dataset,
                    velocity_field=field,
                    mild=float(mild),
                    strong=float(strong),
                    method=method,
                    eps_m=float(eps_m),
                    min_pts=int(min_pts),
                ),
            )
            geo = zones_geo
            try:
                os.makedirs(cache_processed_dir, exist_ok=True)
                write_geojson(geo, out_path)
                cache_file = out_path
            except Exception:
                pass

        feats = (geo or {}).get("features") or []
        if zones_meta is None:
            danger_zone_count = 0
            warning_zone_count = 0
            for f in feats:
                props = (f or {}).get("properties") or {}
                lv = (props.get("level") or "").strip()
                if lv == "danger":
                    danger_zone_count += 1
                elif lv == "warning":
                    warning_zone_count += 1
            zones_meta = {
                "zone_count": len(feats),
                "danger_zone_count": danger_zone_count,
                "warning_zone_count": warning_zone_count,
            }

        return jsonify(
            {
                "status": "success",
                "data": geo,
                "meta": {
                    "dataset": dataset,
                    "zones": zones_meta,
                    "method": method,
                    "thresholds": {"mild": abs(float(mild)), "strong": abs(float(strong))},
                    "eps_m": float(eps_m),
                    "min_pts": int(min_pts),
                    "cached": cached,
                    "cache_file": os.path.basename(cache_file) if cache_file else base_name,
                    "args": dict(request.args),
                },
            }
        )
    except Exception as e:
        if isinstance(e, ValueError):
            return jsonify({"status": "error", "message": str(e)}), 400
        dataset_hint = (request.args.get("dataset") or "").strip() or "dataset"
        abs_hint_dir = os.path.abspath(os.path.join(raw_dir, dataset_hint))
        return jsonify(
            {
                "status": "error",
                "message": str(e),
                "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下（至少 .shp + .dbf）。也可设置 INSAR_DATA_DIR 指向包含 raw/processed 的 insar 数据目录。",
                "meta": {"dataset": dataset_hint, "insar_data_dir": os.path.abspath(os.path.join(raw_dir, "..")), "raw_dir": raw_dir},
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
        return jsonify(
            {
                "status": "error",
                "message": str(e),
                "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下。也可设置 INSAR_DATA_DIR 指向包含 raw/processed 的 insar 数据目录。",
                "meta": {"dataset": dataset_hint, "insar_data_dir": os.path.abspath(os.path.join(raw_dir, "..")), "raw_dir": raw_dir},
            }
        ), 400


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
