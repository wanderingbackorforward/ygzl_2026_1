from flask import Blueprint, request, jsonify
from datetime import datetime

from modules.db.repos.supabase_http_repo import SupabaseHttpRepo

module_bp = Blueprint('modules', __name__, url_prefix='/api/modules')


def create_response(data=None, message="", success=True, code=200):
    response = {
        "success": success,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    return jsonify(response), code


DEFAULT_MODULES = [
    {"module_key": "cover", "route_path": "/cover", "display_name": "封面", "icon_class": "fas fa-home", "sort_order": 10, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "settlement", "route_path": "/settlement", "display_name": "沉降", "icon_class": "fas fa-chart-area", "sort_order": 20, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "temperature", "route_path": "/temperature", "display_name": "温度", "icon_class": "fas fa-thermometer-half", "sort_order": 30, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "cracks", "route_path": "/cracks", "display_name": "裂缝", "icon_class": "fas fa-bug", "sort_order": 40, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "vibration", "route_path": "/vibration", "display_name": "振动", "icon_class": "fas fa-wave-square", "sort_order": 50, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "insar", "route_path": "/insar", "display_name": "InSAR", "icon_class": "fas fa-satellite", "sort_order": 60, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "overview", "route_path": "/overview", "display_name": "数据总览", "icon_class": "fas fa-chart-line", "sort_order": 70, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "three", "route_path": "/three", "display_name": "3D模型", "icon_class": "fas fa-cubes", "sort_order": 80, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
    {"module_key": "tickets", "route_path": "/tickets", "display_name": "工单", "icon_class": "fas fa-ticket-alt", "sort_order": 90, "status": "developed", "pending_badge_text": "待开发模块", "pending_popup_title": "模块待开发", "pending_popup_body": "该模块正在开发中", "is_visible": True},
]


def _get_repo():
    return SupabaseHttpRepo()


@module_bp.route('', methods=['GET'])
@module_bp.route('/', methods=['GET'])
def modules_list():
    try:
        repo = _get_repo()
        getter = getattr(repo, 'modules_get_all', None)
        if callable(getter):
            modules = getter()
            if isinstance(modules, list) and modules:
                return create_response(modules, "ok", True, 200)
        return create_response(DEFAULT_MODULES, "fallback", True, 200)
    except Exception as e:
        return create_response(DEFAULT_MODULES, str(e), True, 200)


@module_bp.route('/<module_key>', methods=['PATCH'])
def modules_update(module_key: str):
    body = request.get_json(silent=True) or {}
    status = body.get('status')
    if status not in ('developed', 'pending'):
        return create_response(None, "invalid status", False, 400)

    updated_by = body.get('updated_by')
    reason = body.get('reason') if 'reason' in body else body.get('update_reason')

    try:
        repo = _get_repo()
        updater = getattr(repo, 'modules_update_status', None)
        if not callable(updater):
            return create_response(None, "not supported", False, 501)
        row = updater(module_key, status, updated_by=updated_by, update_reason=reason)
        return create_response(row, "ok", True, 200)
    except Exception as e:
        return create_response(None, str(e), False, 500)
