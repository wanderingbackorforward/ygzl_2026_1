# -*- coding: utf-8 -*-
"""InSAR API 路由 - 只负责参数解析和响应格式化"""
import os
from datetime import datetime
from typing import Any, Dict

from flask import Blueprint, jsonify, request

from .config import config
from .service import (
    discover_datasets,
    filter_by_bbox,
    generate_zones,
    get_time_series,
    infer_fields,
    load_or_convert_points,
)
from .utils.validation import parse_bbox, validate_dataset, validate_field

insar_bp = Blueprint("insar", __name__, url_prefix="/api/insar")


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------

def _parse_bool(val: str) -> bool:
    return (val or "").strip() in ("1", "true", "yes")


def _parse_float(val, default: float) -> float:
    if val is None or str(val).strip() == "":
        return default
    return float(val)


def _parse_int(val, default: int) -> int:
    if val is None or str(val).strip() == "":
        return default
    return int(val)


def _error_response(e: Exception, dataset: str = "") -> tuple:
    """统一错误响应"""
    if isinstance(e, ValueError):
        return jsonify({"status": "error", "message": str(e)}), 400

    hint_dir = os.path.abspath(os.path.join(config.raw_dir, dataset or "dataset"))
    return jsonify({
        "status": "error",
        "message": str(e),
        "hint": f"请把 Shapefile 放到 {hint_dir} 下（至少 .shp + .dbf）。"
               f"也可设置 INSAR_DATA_DIR 指向包含 raw/processed 的 insar 数据目录。",
        "meta": {
            "dataset": dataset or "dataset",
            "raw_dir": config.raw_dir,
            "processed_dir": config.processed_dir,
        },
    }), 400


# ---------------------------------------------------------------------------
# 路由
# ---------------------------------------------------------------------------

@insar_bp.route("/points", methods=["GET"])
def insar_points():
    try:
        dataset = validate_dataset(request.args.get("dataset"))
        field = validate_field(request.args.get("field") or "")
        refresh = _parse_bool(request.args.get("refresh") or "")
        bbox = parse_bbox(request.args.get("bbox") or "")

        geo, value_field, cached, cache_file = load_or_convert_points(
            dataset, field, refresh
        )

        total_count = len(geo.get("features") or [])
        out_geo = filter_by_bbox(geo, bbox)
        feature_count = len(out_geo.get("features") or [])

        return jsonify({
            "status": "success",
            "data": out_geo,
            "meta": {
                "dataset": dataset,
                "cached": cached,
                "feature_count": feature_count,
                "total_feature_count": total_count,
                "value_field": field or value_field,
                "cache_file": os.path.basename(cache_file) if cache_file else None,
                "args": dict(request.args),
            },
        })
    except Exception as e:
        dataset = (request.args.get("dataset") or "").strip()
        return _error_response(e, dataset)


@insar_bp.route("/zones", methods=["GET"])
def insar_zones():
    try:
        dataset = validate_dataset(request.args.get("dataset"))
        field = validate_field(request.args.get("field") or "")
        refresh = _parse_bool(request.args.get("refresh") or "")
        bbox = parse_bbox(request.args.get("bbox") or "")

        method = (request.args.get("method") or "").strip() or "cluster_hull"
        if method != "cluster_hull":
            raise ValueError("非法 method：当前仅支持 cluster_hull")

        mild = _parse_float(request.args.get("mild"), 2.0)
        strong = _parse_float(request.args.get("strong"), 10.0)
        eps_m = _parse_float(request.args.get("eps_m"), 50.0)
        min_pts = _parse_int(request.args.get("min_pts"), 6)

        zones_geo, zones_meta, cached, cache_file = generate_zones(
            dataset=dataset, field=field, method=method,
            mild=mild, strong=strong, eps_m=eps_m, min_pts=min_pts,
            bbox=bbox, refresh=refresh,
        )

        return jsonify({
            "status": "success",
            "data": zones_geo,
            "meta": {
                "dataset": dataset,
                "zones": zones_meta,
                "method": method,
                "thresholds": {"mild": abs(mild), "strong": abs(strong)},
                "eps_m": eps_m,
                "min_pts": min_pts,
                "cached": cached,
                "cache_file": os.path.basename(cache_file) if cache_file else None,
                "args": dict(request.args),
            },
        })
    except Exception as e:
        import traceback
        print(f"[DEBUG] /api/insar/zones error: {traceback.format_exc()}")
        dataset = (request.args.get("dataset") or "").strip()
        return _error_response(e, dataset)


def _dataset_item(name: str) -> Dict[str, Any]:
    """数据集清单项：来源文件类型 + 最近更新时间（文件数据集，非数据库表）。"""
    paths = []
    raw_dir = os.path.join(config.raw_dir, name)
    if os.path.isdir(raw_dir):
        for fn in sorted(os.listdir(raw_dir)):
            if fn.lower().endswith(".shp"):
                paths.append((os.path.join(raw_dir, fn), "Shapefile"))
                break

    processed_candidates = []
    if name == "yanggaozhong":
        processed_candidates.append(os.path.join(config.processed_dir, "points.geojson"))
    processed_candidates.append(os.path.join(config.processed_dir, f"{name}.geojson"))
    if config.cache_dir != config.processed_dir:
        if name == "yanggaozhong":
            processed_candidates.append(os.path.join(config.cache_dir, "points.geojson"))
        processed_candidates.append(os.path.join(config.cache_dir, f"{name}.geojson"))
    for path in processed_candidates:
        if os.path.isfile(path):
            paths.append((path, "GeoJSON 处理结果"))
            break

    sources = []
    for _, label in paths:
        if label not in sources:
            sources.append(label)
    updated = max((os.path.getmtime(path) for path, _ in paths), default=None)
    return {
        "name": name,
        "sources": sources,
        "source": " + ".join(sources) if sources else "未找到文件",
        "updated_at": (
            datetime.fromtimestamp(updated).strftime("%Y-%m-%d %H:%M:%S")
            if updated else None
        ),
    }


@insar_bp.route("/datasets", methods=["GET"])
def insar_datasets():
    datasets = discover_datasets()
    # discover_datasets 会把 zones.*.geojson 等中间产物也扫进来，清单只保留有实体文件的数据集
    items = [item for item in (_dataset_item(name) for name in datasets) if item["sources"]]
    updated = [item["updated_at"] for item in items if item["updated_at"]]
    return jsonify({
        "status": "success",
        "data": {
            "datasets": datasets,
            "default": "yanggaozhong",
            "kind": "file",
            "source": "文件数据集（Shapefile 原始 + GeoJSON 处理结果）",
            "updated_at": max(updated) if updated else None,
            "items": items,
        },
    })


@insar_bp.route("/fields", methods=["GET"])
def insar_fields():
    try:
        dataset = validate_dataset(request.args.get("dataset"))
        geo, _, _, _ = load_or_convert_points(dataset)
        field_info = infer_fields(geo)

        return jsonify({
            "status": "success",
            "data": {"dataset": dataset, **field_info},
        })
    except Exception as e:
        dataset = (request.args.get("dataset") or "").strip()
        return _error_response(e, dataset)


@insar_bp.route("/series", methods=["GET"])
def insar_series():
    try:
        dataset = validate_dataset(request.args.get("dataset"))
        point_id = (request.args.get("id") or "").strip()

        result = get_time_series(dataset, point_id)
        if result is None:
            return jsonify({
                "status": "error",
                "message": "未找到该点位",
                "meta": {"dataset": dataset, "id": point_id},
            }), 404

        return jsonify({"status": "success", "data": result})
    except Exception as e:
        if isinstance(e, ValueError):
            return jsonify({"status": "error", "message": str(e)}), 400
        return jsonify({"status": "error", "message": str(e)}), 400
