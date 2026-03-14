import os
from datetime import datetime

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def create_response(data=None, message="", success=True, code=200):
    return jsonify({
        "success": success,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }), code


DEFAULT_MODULES = [
    {"module_key": "cover", "route_path": "/cover", "display_name": "封面", "icon_class": "fas fa-home", "sort_order": 10, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "settlement", "route_path": "/settlement", "display_name": "沉降", "icon_class": "fas fa-chart-area", "sort_order": 20, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "temperature", "route_path": "/temperature", "display_name": "温度", "icon_class": "fas fa-thermometer-half", "sort_order": 30, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "cracks", "route_path": "/cracks", "display_name": "裂缝", "icon_class": "fas fa-bug", "sort_order": 40, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "vibration", "route_path": "/vibration", "display_name": "振动", "icon_class": "fas fa-wave-square", "sort_order": 50, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "insar", "route_path": "/insar", "display_name": "InSAR", "icon_class": "fas fa-satellite", "sort_order": 60, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "advanced", "route_path": "/advanced", "display_name": "高级分析", "icon_class": "fas fa-microscope", "sort_order": 65, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "overview", "route_path": "/overview", "display_name": "数据总览", "icon_class": "fas fa-chart-line", "sort_order": 70, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "three", "route_path": "/three", "display_name": "3D模型", "icon_class": "fas fa-cubes", "sort_order": 80, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "tickets", "route_path": "/tickets", "display_name": "工单", "icon_class": "fas fa-ticket-alt", "sort_order": 90, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "shield-trajectory", "route_path": "/shield-trajectory", "display_name": "盾构轨迹", "icon_class": "fas fa-route", "sort_order": 95, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
]


def _headers():
    anon = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    headers = {"Accept": "application/json", "apikey": anon}
    if anon:
        headers["Authorization"] = f"Bearer {anon}"
    return headers


def _base_url():
    return os.environ.get("SUPABASE_URL", "").strip().rstrip("/")


def _table_modules():
    return os.environ.get("SUPABASE_TABLE_MODULES", "app_modules").strip() or "app_modules"


def _request_timeout():
    raw = os.environ.get("MODULES_HTTP_TIMEOUT", "6").strip()
    try:
        value = float(raw)
        if value <= 0:
            return 6.0
        return value
    except Exception:
        return 6.0


def _fetch_remote_modules():
    base = _base_url()
    if not base:
        return None
    table = _table_modules()
    url = f"{base}/rest/v1/{table}?select=*&order=sort_order"
    resp = requests.get(url, headers=_headers(), timeout=_request_timeout())
    resp.raise_for_status()
    rows = resp.json()
    if not isinstance(rows, list):
        return None
    db_keys = {m.get("module_key") for m in rows if isinstance(m, dict)}
    merged = rows[:]
    for item in DEFAULT_MODULES:
        if item["module_key"] not in db_keys:
            merged.append(item)
    merged.sort(key=lambda m: m.get("sort_order", 0) if isinstance(m, dict) else 0)
    return merged


def _update_remote_module(module_key, status, updated_by=None, reason=None):
    base = _base_url()
    if not base:
        raise RuntimeError("remote modules source not configured")
    table = _table_modules()
    payload = {"status": status}
    if updated_by is not None:
        payload["updated_by"] = updated_by
    if reason is not None:
        payload["update_reason"] = reason
    headers = _headers()
    headers["Content-Type"] = "application/json"
    headers["Prefer"] = "return=representation"
    url = f"{base}/rest/v1/{table}?module_key=eq.{module_key}"
    resp = requests.patch(url, headers=headers, json=payload, timeout=_request_timeout())
    resp.raise_for_status()
    rows = resp.json()
    if isinstance(rows, list) and rows:
        return rows[0]
    return None


@app.get("/api/modules")
@app.get("/api/modules/")
def modules_list():
    try:
        modules = _fetch_remote_modules()
        if isinstance(modules, list) and modules:
            return create_response(modules, "ok", True, 200)
        return create_response(DEFAULT_MODULES, "fallback", True, 200)
    except Exception as e:
        return create_response(DEFAULT_MODULES, str(e), True, 200)


@app.patch("/api/modules")
@app.patch("/api/modules/")
def modules_update_by_body():
    body = request.get_json(silent=True) or {}
    module_key = (body.get("module_key") or "").strip()
    status = body.get("status")
    if not module_key:
        return create_response(None, "missing module_key", False, 400)
    if status not in ("developed", "pending"):
        return create_response(None, "invalid status", False, 400)
    updated_by = body.get("updated_by")
    reason = body.get("reason") if "reason" in body else body.get("update_reason")
    try:
        row = _update_remote_module(module_key, status, updated_by, reason)
        return create_response(row, "ok", True, 200)
    except Exception as e:
        return create_response(None, str(e), False, 500)


@app.patch("/api/modules/<module_key>")
def modules_update(module_key: str):
    body = request.get_json(silent=True) or {}
    status = body.get("status")
    if status not in ("developed", "pending"):
        return create_response(None, "invalid status", False, 400)
    updated_by = body.get("updated_by")
    reason = body.get("reason") if "reason" in body else body.get("update_reason")
    try:
        row = _update_remote_module(module_key, status, updated_by, reason)
        return create_response(row, "ok", True, 200)
    except Exception as e:
        return create_response(None, str(e), False, 500)


@app.get("/api/health")
def health():
    return jsonify({"status": "healthy", "modules_api": "lightweight"}), 200
