import json
import os

from flask import Blueprint, jsonify, request

from modules.insar.convert import convert_shapefile_dir_to_geojson, write_geojson

insar_bp = Blueprint("insar", __name__, url_prefix="/api/insar")


def _project_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))


def _paths() -> tuple[str, str]:
    root = _project_root()
    raw_dir = os.path.join(root, "static", "data", "insar", "raw")
    processed_dir = os.path.join(root, "static", "data", "insar", "processed")
    return raw_dir, processed_dir


@insar_bp.route("/points", methods=["GET"])
def insar_points():
    dataset = (request.args.get("dataset") or "yanggaozhong").strip()
    field = (request.args.get("field") or "").strip()
    refresh = (request.args.get("refresh") or "").strip() in ("1", "true", "yes")
    raw_dir, processed_dir = _paths()
    os.makedirs(processed_dir, exist_ok=True)

    out_path = os.path.join(processed_dir, "points.geojson" if dataset == "yanggaozhong" else f"{dataset}.geojson")

    try:
        cached = False
        if os.path.exists(out_path) and not refresh and not field:
            with open(out_path, "r", encoding="utf-8") as f:
                geo = json.load(f)
            cached = True
            feature_count = len(geo.get("features") or [])
            return jsonify(
                {
                    "status": "success",
                    "data": geo,
                    "meta": {"dataset": dataset, "cached": cached, "feature_count": feature_count, "args": dict(request.args)},
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
        write_geojson(result.geojson, out_path)
        feature_count = len(result.geojson.get("features") or [])
        return jsonify(
            {
                "status": "success",
                "data": result.geojson,
                "meta": {"dataset": dataset, "cached": cached, "feature_count": feature_count, "value_field": field or result.value_field},
            }
        )
    except Exception as e:
        abs_hint_dir = os.path.abspath(os.path.join(raw_dir, dataset))
        return jsonify(
            {
                "status": "error",
                "message": str(e),
                "hint": f"请把 Shapefile 放到 {abs_hint_dir} 下（至少 .shp + .dbf）",
                "meta": {"dataset": dataset, "raw_dir": raw_dir, "processed_dir": processed_dir},
            }
        ), 400
