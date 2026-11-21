from flask import Blueprint, request, jsonify
from datetime import datetime
from modules.db.vendor import get_repo

module_bp = Blueprint('modules', __name__, url_prefix='/api/modules')


def create_response(data=None, message="", success=True, code=200):
    response = {
        "success": success,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    return jsonify(response), code


DEFAULT_MODULES = []  # 导航唯一来源：数据库 app_modules；此处不再维护副本


def _get_repo():
    return get_repo()


@module_bp.route('', methods=['GET'])
@module_bp.route('/', methods=['GET'])
def modules_list():
    """导航唯一来源：数据库 app_modules。接口不可用时返回空列表，由前端提示，不伪造条目。"""
    try:
        repo = _get_repo()
        getter = getattr(repo, 'modules_get_all', None)
        if callable(getter):
            modules = getter()
            if isinstance(modules, list) and modules:
                modules.sort(key=lambda m: m.get('sort_order', 0) if isinstance(m, dict) else 0)
                return create_response(modules, "ok", True, 200)
        return create_response([], "模块配置为空：app_modules 无可见条目", True, 200)
    except Exception as e:
        return create_response([], f"模块配置接口不可用：{e}", True, 200)


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


@module_bp.route('', methods=['PATCH'])
@module_bp.route('/', methods=['PATCH'])
def modules_update_by_body():
    body = request.get_json(silent=True) or {}
    module_key = (body.get('module_key') or '').strip()
    status = body.get('status')
    if not module_key:
        return create_response(None, "missing module_key", False, 400)
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
