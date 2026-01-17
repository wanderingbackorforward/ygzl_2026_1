"""
工单系统API接口
提供工单的创建、查询、更新、评论等功能
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
import json
import traceback

from ..models import ticket_model, comment_model
from ..config import (
    TICKET_TYPES, TICKET_STATUS, TICKET_PRIORITY,
    can_transition_status, get_ticket_type, get_ticket_status, get_priority
)

# 创建工单API蓝图
ticket_bp = Blueprint('ticket', __name__, url_prefix='/api/tickets')


def create_response(data=None, message="", success=True, code=200):
    """创建统一格式的API响应"""
    response = {
        "success": success,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    return jsonify(response), code


@ticket_bp.route('', methods=['GET'])
def get_tickets():
    """获取工单列表"""
    try:
        # 获取查询参数
        filters = {}
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        search = request.args.get('search', '')

        if search:
            filters['search_keyword'] = search

        # 状态筛选
        status = request.args.get('status')
        if status:
            filters['status'] = status

        # 类型筛选
        ticket_type = request.args.get('type')
        if ticket_type:
            filters['ticket_type'] = ticket_type

        # 优先级筛选
        priority = request.args.get('priority')
        if priority:
            filters['priority'] = priority

        # 创建人筛选
        creator_id = request.args.get('creator_id')
        if creator_id:
            filters['creator_id'] = creator_id

        # 处理人筛选
        assignee_id = request.args.get('assignee_id')
        if assignee_id:
            filters['assignee_id'] = assignee_id

        # 监测点筛选
        monitoring_point_id = request.args.get('monitoring_point_id')
        if monitoring_point_id:
            filters['monitoring_point_id'] = monitoring_point_id

        # 计算分页偏移量
        offset = (page - 1) * limit

        # 获取工单列表
        tickets = ticket_model.get_tickets(filters, limit, offset)

        # 获取总数（这里简化处理，实际应该单独查询）
        total = len(tickets) if tickets else 0

        return create_response({
            'tickets': tickets,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            },
            'filters': filters
        }, "获取工单列表成功")

    except Exception as e:
        print(f"❌ 获取工单列表失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"获取工单列表失败: {str(e)}", False, 500)


@ticket_bp.route('', methods=['POST'])
def create_ticket():
    """创建新工单"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        # 验证必填字段
        required_fields = ['title', 'ticket_type', 'creator_id', 'creator_name']
        for field in required_fields:
            if not data.get(field):
                return create_response(None, f"缺少必填字段: {field}", False, 400)

        # 验证工单类型
        ticket_type_info = get_ticket_type(data['ticket_type'])
        if not ticket_type_info:
            return create_response(None, "无效的工单类型", False, 400)

        # 验证优先级
        priority_info = get_priority(data.get('priority', 'MEDIUM'))
        if not priority_info:
            return create_response(None, "无效的优先级", False, 400)

        # 验证状态
        status_info = get_ticket_status(data.get('status', 'PENDING'))
        if not status_info:
            return create_response(None, "无效的工单状态", False, 400)

        # 创建工单
        ticket = ticket_model.create_ticket(data)

        return create_response(ticket, "工单创建成功", True, 201)

    except Exception as e:
        print(f"❌ 创建工单失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"创建工单失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>', methods=['GET'])
def get_ticket_detail(ticket_id):
    """获取工单详情"""
    try:
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 获取工单评论
        comments = comment_model.get_comments(ticket_id)

        # 合并数据
        ticket['comments'] = comments

        return create_response(ticket, "获取工单详情成功")

    except Exception as e:
        print(f"❌ 获取工单详情失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"获取工单详情失败: {str(e)}", False, 500)


@ticket_bp.route('/number/<string:ticket_number>', methods=['GET'])
def get_ticket_by_number(ticket_number):
    """根据工单编号获取工单详情"""
    try:
        ticket = ticket_model.get_ticket_by_number(ticket_number)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 获取工单评论
        comments = comment_model.get_comments(ticket['id'])

        # 合并数据
        ticket['comments'] = comments

        return create_response(ticket, "获取工单详情成功")

    except Exception as e:
        print(f"❌ 获取工单详情失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"获取工单详情失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    """更新工单信息"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        # 检查工单是否存在
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 更新工单
        success = ticket_model.update_ticket(ticket_id, data)
        if not success:
            return create_response(None, "更新工单失败", False, 500)

        # 返回更新后的工单信息
        updated_ticket = ticket_model.get_ticket_by_id(ticket_id)

        return create_response(updated_ticket, "工单更新成功")

    except Exception as e:
        print(f"❌ 更新工单失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"更新工单失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>/status', methods=['PUT'])
def update_ticket_status(ticket_id):
    """更新工单状态"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        new_status = data.get('status')
        user_id = data.get('user_id')
        user_role = data.get('user_role', 'operator')
        comment = data.get('comment', '')

        if not new_status or not user_id:
            return create_response(None, "缺少状态或用户信息", False, 400)

        # 检查工单是否存在
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 验证状态流转是否合法
        if not can_transition_status(ticket['status'], new_status, user_role):
            return create_response(None, "不允许的状态流转", False, 400)

        # 更新状态
        success = ticket_model.update_ticket_status(ticket_id, new_status, user_id, comment)
        if not success:
            return create_response(None, "更新状态失败", False, 500)

        # 返回更新后的工单信息
        updated_ticket = ticket_model.get_ticket_by_id(ticket_id)

        return create_response(updated_ticket, "工单状态更新成功")

    except Exception as e:
        print(f"❌ 更新工单状态失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"更新工单状态失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>/assign', methods=['PUT'])
def assign_ticket(ticket_id):
    """分配工单"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        assignee_id = data.get('assignee_id')
        assignee_name = data.get('assignee_name')

        if not assignee_id or not assignee_name:
            return create_response(None, "缺少处理人信息", False, 400)

        # 检查工单是否存在
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 分配工单
        success = ticket_model.assign_ticket(ticket_id, assignee_id, assignee_name)
        if not success:
            return create_response(None, "分配工单失败", False, 500)

        # 返回更新后的工单信息
        updated_ticket = ticket_model.get_ticket_by_id(ticket_id)

        return create_response(updated_ticket, "工单分配成功")

    except Exception as e:
        print(f"❌ 分配工单失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"分配工单失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>/comments', methods=['GET'])
def get_ticket_comments(ticket_id):
    """获取工单评论"""
    try:
        # 检查工单是否存在
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 获取评论列表
        comments = comment_model.get_comments(ticket_id)

        return create_response(comments, "获取评论列表成功")

    except Exception as e:
        print(f"❌ 获取评论列表失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"获取评论列表失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>/comments', methods=['POST'])
def add_ticket_comment(ticket_id):
    """添加工单评论"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        # 验证必填字段
        required_fields = ['author_id', 'author_name', 'content']
        for field in required_fields:
            if not data.get(field):
                return create_response(None, f"缺少必填字段: {field}", False, 400)

        # 检查工单是否存在
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 添加评论
        comment = comment_model.add_comment(
            ticket_id=ticket_id,
            author_id=data['author_id'],
            author_name=data['author_name'],
            content=data['content'],
            comment_type=data.get('comment_type', 'COMMENT'),
            attachment_paths=data.get('attachment_paths'),
            metadata=data.get('metadata')
        )

        return create_response(comment, "评论添加成功", True, 201)

    except Exception as e:
        print(f"❌ 添加评论失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"添加评论失败: {str(e)}", False, 500)


@ticket_bp.route('/statistics', methods=['GET'])
def get_ticket_statistics():
    """获取工单统计信息"""
    try:
        statistics = ticket_model.get_ticket_statistics()

        return create_response(statistics, "获取统计信息成功")

    except Exception as e:
        print(f"❌ 获取统计信息失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"获取统计信息失败: {str(e)}", False, 500)


@ticket_bp.route('/config/types', methods=['GET'])
def get_ticket_types():
    """获取工单类型配置"""
    try:
        return create_response(TICKET_TYPES, "获取工单类型配置成功")

    except Exception as e:
        print(f"❌ 获取工单类型配置失败: {e}")
        return create_response(None, f"获取工单类型配置失败: {str(e)}", False, 500)


@ticket_bp.route('/config/status', methods=['GET'])
def get_ticket_status_config():
    """获取工单状态配置"""
    try:
        return create_response(TICKET_STATUS, "获取工单状态配置成功")

    except Exception as e:
        print(f"❌ 获取工单状态配置失败: {e}")
        return create_response(None, f"获取工单状态配置失败: {str(e)}", False, 500)


@ticket_bp.route('/config/priority', methods=['GET'])
def get_ticket_priority_config():
    """获取优先级配置"""
    try:
        return create_response(TICKET_PRIORITY, "获取优先级配置成功")

    except Exception as e:
        print(f"❌ 获取优先级配置失败: {e}")
        return create_response(None, f"获取优先级配置失败: {str(e)}", False, 500)


@ticket_bp.route('/alert-trigger', methods=['POST'])
def trigger_alert_ticket():
    """通过预警自动创建工单"""
    try:
        data = request.get_json()
        if not data:
            return create_response(None, "请求数据不能为空", False, 400)

        # 验证预警数据
        required_fields = ['alert_type', 'monitoring_point_id', 'alert_value']
        for field in required_fields:
            if not data.get(field):
                return create_response(None, f"缺少必填字段: {field}", False, 400)

        # 根据预警类型确定工单类型
        alert_type_mapping = {
            'settlement': 'SETTLEMENT_ALERT',
            'crack': 'CRACK_ALERT',
            'equipment': 'EQUIPMENT_FAULT'
        }

        ticket_type = alert_type_mapping.get(data['alert_type'], 'SETTLEMENT_ALERT')

        # 构建工单数据
        ticket_data = {
            'title': f"{data.get('alert_title', '系统预警')} - {data.get('monitoring_point_id', '')}",
            'description': data.get('description', f"监测点 {data['monitoring_point_id']} 触发预警"),
            'ticket_type': ticket_type,
            'priority': data.get('priority', 'HIGH'),
            'creator_id': 'system',
            'creator_name': '系统自动',
            'monitoring_point_id': data['monitoring_point_id'],
            'location_info': data.get('location_info'),
            'current_value': data.get('current_value'),
            'threshold_value': data.get('threshold_value'),
            'alert_data': data,
            'metadata': {
                'auto_created': True,
                'alert_source': data.get('alert_source', 'system'),
                'triggered_at': datetime.now().isoformat()
            }
        }

        # 创建工单
        ticket = ticket_model.create_ticket(ticket_data)

        return create_response(ticket, "预警工单创建成功", True, 201)

    except Exception as e:
        print(f"❌ 创建预警工单失败: {e}")
        print(traceback.format_exc())
        return create_response(None, f"创建预警工单失败: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>', methods=['DELETE'])
def delete_ticket(ticket_id):
    """删除工单（仅管理员可用）"""
    try:
        # 检查工单是否存在
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "工单不存在", False, 404)

        # 删除工单
        success = ticket_model.delete_ticket(ticket_id)
        if not success:
            return create_response(None, "删除工单失败", False, 500)

        return create_response(None, "工单删除成功")

    except Exception as e:
        print(f"[ERROR] Delete ticket failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"删除工单失败: {str(e)}", False, 500)


# =========================================================================
# Archive and Reminder API Endpoints
# =========================================================================

@ticket_bp.route('/due-soon', methods=['GET'])
def get_due_soon_tickets():
    """Get tickets due within 24 hours"""
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()
        tickets = repo.tickets_get_due_soon(hours=24)
        return create_response({
            'tickets': tickets,
            'count': len(tickets)
        }, "Get due soon tickets successfully")

    except Exception as e:
        print(f"[ERROR] Get due soon tickets failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Get due soon tickets failed: {str(e)}", False, 500)


@ticket_bp.route('/overdue', methods=['GET'])
def get_overdue_tickets():
    """Get all overdue tickets"""
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()
        tickets = repo.tickets_get_overdue()
        return create_response({
            'tickets': tickets,
            'count': len(tickets)
        }, "Get overdue tickets successfully")

    except Exception as e:
        print(f"[ERROR] Get overdue tickets failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Get overdue tickets failed: {str(e)}", False, 500)


@ticket_bp.route('/archive', methods=['GET'])
def get_archived_tickets():
    """Get archived tickets"""
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        offset = (page - 1) * limit

        tickets = repo.tickets_get_archived(limit=limit, offset=offset)
        return create_response({
            'tickets': tickets,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': len(tickets)
            }
        }, "Get archived tickets successfully")

    except Exception as e:
        print(f"[ERROR] Get archived tickets failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Get archived tickets failed: {str(e)}", False, 500)


@ticket_bp.route('/<int:ticket_id>/archive', methods=['POST'])
def archive_ticket(ticket_id):
    """Archive a single ticket"""
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        # Check if ticket exists
        ticket = ticket_model.get_ticket_by_id(ticket_id)
        if not ticket:
            return create_response(None, "Ticket not found", False, 404)

        # Check if ticket can be archived (must be CLOSED or REJECTED)
        if ticket.get('status') not in ['CLOSED', 'REJECTED']:
            return create_response(None, "Only closed or rejected tickets can be archived", False, 400)

        success = repo.ticket_archive(ticket_id)
        if not success:
            return create_response(None, "Archive ticket failed", False, 500)

        return create_response({'ticket_id': ticket_id}, "Ticket archived successfully")

    except Exception as e:
        print(f"[ERROR] Archive ticket failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Archive ticket failed: {str(e)}", False, 500)


@ticket_bp.route('/archive/auto', methods=['POST'])
def auto_archive_tickets():
    """Auto archive eligible tickets (closed/rejected > 7 days)"""
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        result = repo.tickets_auto_archive()
        return create_response(result, f"Auto archived {result.get('archived_count', 0)} tickets")

    except Exception as e:
        print(f"[ERROR] Auto archive tickets failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Auto archive tickets failed: {str(e)}", False, 500)


@ticket_bp.route('/scheduler/status', methods=['GET'])
def get_scheduler_status():
    """Get ticket scheduler status"""
    try:
        from ..services import ticket_scheduler
        status = ticket_scheduler.get_status()
        return create_response(status, "Get scheduler status successfully")

    except Exception as e:
        print(f"[ERROR] Get scheduler status failed: {e}")
        return create_response(None, f"Get scheduler status failed: {str(e)}", False, 500)


@ticket_bp.route('/scheduler/run', methods=['POST'])
def run_scheduler_once():
    """Manually trigger scheduler tasks"""
    try:
        from ..services import ticket_scheduler
        results = ticket_scheduler.run_once()
        return create_response(results, "Scheduler tasks executed successfully")

    except Exception as e:
        print(f"[ERROR] Run scheduler failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Run scheduler failed: {str(e)}", False, 500)


@ticket_bp.route('/active', methods=['GET'])
def get_active_tickets():
    """Get active (non-archived) tickets only"""
    try:
        from modules.db.vendor import get_repo
        repo = get_repo()

        # Get query parameters
        filters = {}
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        search = request.args.get('search', '')

        if search:
            filters['search_keyword'] = search

        status = request.args.get('status')
        if status:
            filters['status'] = status

        ticket_type = request.args.get('type')
        if ticket_type:
            filters['ticket_type'] = ticket_type

        priority = request.args.get('priority')
        if priority:
            filters['priority'] = priority

        creator_id = request.args.get('creator_id')
        if creator_id:
            filters['creator_id'] = creator_id

        assignee_id = request.args.get('assignee_id')
        if assignee_id:
            filters['assignee_id'] = assignee_id

        monitoring_point_id = request.args.get('monitoring_point_id')
        if monitoring_point_id:
            filters['monitoring_point_id'] = monitoring_point_id

        offset = (page - 1) * limit

        tickets = repo.tickets_get_active(filters, limit, offset)

        return create_response({
            'tickets': tickets,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': len(tickets)
            },
            'filters': filters
        }, "Get active tickets successfully")

    except Exception as e:
        print(f"[ERROR] Get active tickets failed: {e}")
        print(traceback.format_exc())
        return create_response(None, f"Get active tickets failed: {str(e)}", False, 500)