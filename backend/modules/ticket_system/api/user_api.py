# -*- coding: utf-8 -*-
"""
User Management API
Provides user and notification settings management
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
import traceback

from modules.db.vendor import get_repo

# Create user API blueprint
user_bp = Blueprint('user', __name__, url_prefix='/api/users')


def create_response(data=None, message="", success=True, code=200):
    """Create unified API response"""
    response = {
        "success": success,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    return jsonify(response), code


@user_bp.route('', methods=['GET'])
def get_users():
    """Get all system users"""
    try:
        repo = get_repo()
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        users = repo.users_get_all(active_only=active_only)

        return create_response({
            'users': users,
            'count': len(users)
        }, "获取用户列表成功")

    except Exception as e:
        print(f"[ERROR] 获取用户列表失败: {e}")
        traceback.print_exc()
        return create_response(None, f"获取用户列表失败: {str(e)}", False, 500)


@user_bp.route('/<string:user_id>', methods=['GET'])
def get_user(user_id):
    """Get user by user_id"""
    try:
        repo = get_repo()
        user = repo.user_get_by_id(user_id)

        if not user:
            return create_response(None, "用户不存在", False, 404)

        # Also get notification settings
        settings = repo.user_get_notification_settings(user_id)
        user['notification_settings'] = settings

        return create_response(user, "获取用户信息成功")

    except Exception as e:
        print(f"[ERROR] 获取用户信息失败: {e}")
        traceback.print_exc()
        return create_response(None, f"获取用户信息失败: {str(e)}", False, 500)


@user_bp.route('', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        # Validate required fields
        required_fields = ['user_id', 'username']
        for field in required_fields:
            if not data.get(field):
                return create_response(None, f"缺少必填字段: {field}", False, 400)

        repo = get_repo()

        # Check if user already exists
        existing = repo.user_get_by_id(data['user_id'])
        if existing:
            return create_response(None, "用户已存在", False, 400)

        # Create user
        user = repo.user_create(data)

        # Create notification settings if email provided
        if data.get('email'):
            repo.user_update_notification_settings(data['user_id'], {
                'email_address': data['email'],
                'email_enabled': True
            })

        return create_response(user, "用户创建成功", True, 201)

    except Exception as e:
        print(f"[ERROR] 创建用户失败: {e}")
        traceback.print_exc()
        return create_response(None, f"创建用户失败: {str(e)}", False, 500)


@user_bp.route('/<string:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user information"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        repo = get_repo()

        # Check if user exists
        existing = repo.user_get_by_id(user_id)
        if not existing:
            return create_response(None, "用户不存在", False, 404)

        # Update user
        user = repo.user_update(user_id, data)

        return create_response(user, "用户更新成功")

    except Exception as e:
        print(f"[ERROR] 更新用户失败: {e}")
        traceback.print_exc()
        return create_response(None, f"更新用户失败: {str(e)}", False, 500)


@user_bp.route('/<string:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete user (soft delete)"""
    try:
        repo = get_repo()

        # Check if user exists
        existing = repo.user_get_by_id(user_id)
        if not existing:
            return create_response(None, "用户不存在", False, 404)

        # Soft delete
        repo.user_delete(user_id)

        return create_response({'user_id': user_id}, "用户删除成功")

    except Exception as e:
        print(f"[ERROR] 删除用户失败: {e}")
        traceback.print_exc()
        return create_response(None, f"删除用户失败: {str(e)}", False, 500)


@user_bp.route('/<string:user_id>/notification-settings', methods=['GET'])
def get_notification_settings(user_id):
    """Get user notification settings"""
    try:
        repo = get_repo()

        settings = repo.user_get_notification_settings(user_id)
        if not settings:
            # Return default settings if not configured
            settings = {
                'user_id': user_id,
                'email_enabled': True,
                'email_address': None,
                'notify_on_ticket_created': True,
                'notify_on_ticket_assigned': True,
                'notify_on_status_change': True,
                'notify_on_due_soon': True,
                'notify_on_overdue': True
            }

        return create_response(settings, "获取通知设置成功")

    except Exception as e:
        print(f"[ERROR] 获取通知设置失败: {e}")
        traceback.print_exc()
        return create_response(None, f"获取通知设置失败: {str(e)}", False, 500)


@user_bp.route('/<string:user_id>/notification-settings', methods=['PUT'])
def update_notification_settings(user_id):
    """Update user notification settings"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        repo = get_repo()

        # Check if user exists
        existing = repo.user_get_by_id(user_id)
        if not existing:
            return create_response(None, "用户不存在", False, 404)

        # Update notification settings
        settings = repo.user_update_notification_settings(user_id, data)

        return create_response(settings, "通知设置更新成功")

    except Exception as e:
        print(f"[ERROR] 更新通知设置失败: {e}")
        traceback.print_exc()
        return create_response(None, f"更新通知设置失败: {str(e)}", False, 500)


@user_bp.route('/<string:user_id>/email', methods=['GET'])
def get_user_email(user_id):
    """Get user's notification email"""
    try:
        repo = get_repo()
        email = repo.user_get_email(user_id)

        return create_response({
            'user_id': user_id,
            'email': email
        }, "获取用户邮箱成功")

    except Exception as e:
        print(f"[ERROR] 获取用户邮箱失败: {e}")
        traceback.print_exc()
        return create_response(None, f"获取用户邮箱失败: {str(e)}", False, 500)


@user_bp.route('/with-email', methods=['GET'])
def get_users_with_email():
    """Get all users with their notification emails"""
    try:
        repo = get_repo()
        users = repo.users_get_with_email()

        return create_response({
            'users': users,
            'count': len(users)
        }, "获取用户邮箱列表成功")

    except Exception as e:
        print(f"[ERROR] 获取用户邮箱列表失败: {e}")
        traceback.print_exc()
        return create_response(None, f"获取用户邮箱列表失败: {str(e)}", False, 500)


@user_bp.route('/by-role/<string:role>', methods=['GET'])
def get_users_by_role(role):
    """Get users by role"""
    try:
        repo = get_repo()
        users = repo.users_get_by_role(role)

        return create_response({
            'users': users,
            'count': len(users),
            'role': role
        }, f"获取角色为“{role}”的用户成功")

    except Exception as e:
        print(f"[ERROR] 按角色获取用户失败: {e}")
        traceback.print_exc()
        return create_response(None, f"按角色获取用户失败: {str(e)}", False, 500)
