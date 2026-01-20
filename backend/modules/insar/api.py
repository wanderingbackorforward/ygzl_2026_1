import json
import os

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


@insar_bp.route("/points", methods=["GET"])
def insar_points():
    dataset = (request.args.get("dataset") or "yanggaozhong").strip()
    field = (request.args.get("field") or "").strip()
    refresh = (request.args.get("refresh") or "").strip() in ("1", "true", "yes")
    raw_dir, packaged_processed_dir, cache_processed_dir = _paths()

    base_name = "points.geojson" if dataset == "yanggaozhong" else f"{dataset}.geojson"
    if field:
        safe_field = "".join(ch for ch in field if ch.isalnum() or ch in ("_", "-", "."))
        base_name = f"{dataset}.{safe_field}.geojson"
    out_path = os.path.join(cache_processed_dir, base_name)

    try:
        cached = False
        if not refresh:
            candidate_cache_files = [out_path]
            packaged_out_path = os.path.join(packaged_processed_dir, base_name)
            if packaged_out_path != out_path:
                candidate_cache_files.append(packaged_out_path)
            for cache_file in candidate_cache_files:
                if os.path.exists(cache_file):
                    with open(cache_file, "r", encoding="utf-8") as f:
                        geo = json.load(f)
                    cached = True
                    feature_count = len(geo.get("features") or [])
                    return jsonify(
                        {
                            "status": "success",
                            "data": geo,
                            "meta": {
                                "dataset": dataset,
                                "cached": cached,
                                "feature_count": feature_count,
                                "args": dict(request.args),
                                "cache_file": os.path.basename(cache_file),
                            },
                        }
                    )

        result = convert_shapefile_dir_to_geojson(raw_dir=raw_dir, dataset=dataset)
        if field:
            for feat in result.geojson.get("features") or []:
                props = feat.get("properties") or {}
                if "value" in props:
                    props.pop("value", None)
                v = props.get(field)
                if v is not None:
                    props["value"] = v
                    props["value_field"] = field
        try:
            os.makedirs(cache_processed_dir, exist_ok=True)
            write_geojson(result.geojson, out_path)
        except Exception:
            pass
        feature_count = len(result.geojson.get("features") or [])
        return jsonify(
            {
                "status": "success",
                "data": result.geojson,
                "meta": {
                    "dataset": dataset,
                    "cached": cached,
                    "feature_count": feature_count,
                    "value_field": field or result.value_field,
                    "cache_file": base_name,
                },
            }
        )
    except Exception as e:
        abs_hint_dir = os.path.abspath(os.path.join(raw_dir, dataset))
        return jsonify(
            {
                "status": "error",
                "message": str(e),
                "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下（至少 .shp + .dbf）",
                "meta": {"dataset": dataset, "raw_dir": raw_dir, "processed_dir": packaged_processed_dir, "cache_dir": cache_processed_dir},
            }
        ), 400
