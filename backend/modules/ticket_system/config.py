"""
工单系统配置
适配沉降监测数字孪生系统的工单类型、状态、优先级定义
"""

# 工单类型定义 - 适配沉降监测场景
TICKET_TYPES = {
    'SETTLEMENT_ALERT': {
        'code': 'SETTLEMENT_ALERT',
        'name': '沉降预警',
        'icon': 'alert',
        'color': '#FF4D4F',
        'description': '沉降数据异常预警',
        'subTypes': [
            '沉降量超限',
            '沉降速率异常',
            '差异沉降过大',
            '监测点数据异常'
        ],
        'autoAssign': True,
        'slaHours': 2,
        'requiredFields': ['monitoring_point', 'alert_type', 'threshold_value']
    },

    'CRACK_ALERT': {
        'code': 'CRACK_ALERT',
        'name': '裂缝预警',
        'icon': 'warning',
        'color': '#FA541C',
        'description': '裂缝发展异常预警',
        'subTypes': [
            '新增裂缝',
            '裂缝宽度扩展',
            '裂缝长度发展',
            '裂缝密度增加'
        ],
        'autoAssign': True,
        'slaHours': 3,
        'requiredFields': ['crack_location', 'crack_type', 'measurement_value']
    },

    'EQUIPMENT_FAULT': {
        'code': 'EQUIPMENT_FAULT',
        'name': '设备故障',
        'icon': 'tool',
        'color': '#722ED1',
        'description': '监测设备故障报修',
        'subTypes': [
            '传感器故障',
            '数据采集仪故障',
            '通信设备故障',
            '供电系统故障'
        ],
        'autoAssign': True,
        'slaHours': 4,
        'requiredFields': ['equipment_id', 'fault_type', 'description']
    },

    'MAINTENANCE': {
        'code': 'MAINTENANCE',
        'name': '维护保养',
        'icon': 'calendar',
        'color': '#52C41A',
        'description': '设备定期维护保养',
        'subTypes': [
            '传感器校准',
            '设备清洁保养',
            '零部件更换',
            '系统升级维护'
        ],
        'canSchedule': True,
        'slaHours': 24,
        'requiredFields': ['equipment_id', 'maintenance_type']
    },

    'INSPECTION': {
        'code': 'INSPECTION',
        'name': '巡检任务',
        'icon': 'eye',
        'color': '#1890FF',
        'description': '现场巡检和核查',
        'subTypes': [
            '监测点巡检',
            '设备状态检查',
            '现场环境核查',
            '数据质量验证'
        ],
        'requireCheckList': True,
        'slaHours': 8,
        'requiredFields': ['inspection_area', 'inspection_type']
    },

    'DATA_ANALYSIS': {
        'code': 'DATA_ANALYSIS',
        'name': '数据分析',
        'icon': 'bar-chart',
        'color': '#13C2C2',
        'description': '监测数据分析和报告',
        'subTypes': [
            '趋势分析',
            '关联性分析',
            '预测分析',
            '报告编制'
        ],
        'requireApproval': False,
        'slaHours': 12,
        'requiredFields': ['analysis_type', 'data_range', 'objective']
    }
}

# 工单状态定义
TICKET_STATUS = {
    'PENDING': {
        'code': 'PENDING',
        'name': '待处理',
        'color': '#FAAD14',
        'icon': 'clock-circle',
        'description': '工单已创建，等待分配处理',
        'allowedNextStatus': ['IN_PROGRESS', 'REJECTED'],
        'notifyRoles': ['admin', 'dispatcher'],
        'badge': 'warning'
    },

    'IN_PROGRESS': {
        'code': 'IN_PROGRESS',
        'name': '处理中',
        'color': '#1890FF',
        'icon': 'loading',
        'description': '工单正在处理',
        'allowedNextStatus': ['SUSPENDED', 'RESOLVED'],
        'requireProgress': True,
        'badge': 'processing'
    },

    'SUSPENDED': {
        'code': 'SUSPENDED',
        'name': '已挂起',
        'color': '#D9D9D9',
        'icon': 'pause-circle',
        'description': '工单暂停处理（等待配件/审批等）',
        'allowedNextStatus': ['IN_PROGRESS'],
        'requireReason': True,
        'badge': 'default'
    },

    'RESOLVED': {
        'code': 'RESOLVED',
        'name': '已解决',
        'color': '#52C41A',
        'icon': 'check-circle',
        'description': '问题已解决，等待确认',
        'allowedNextStatus': ['CLOSED', 'IN_PROGRESS'],
        'requireSolution': True,
        'notifyCreator': True,
        'badge': 'success'
    },

    'CLOSED': {
        'code': 'CLOSED',
        'name': '已关闭',
        'color': '#8C8C8C',
        'icon': 'check',
        'description': '工单已完成并关闭',
        'allowedNextStatus': [],
        'requireRating': False,
        'isFinal': True,
        'badge': 'default'
    },

    'REJECTED': {
        'code': 'REJECTED',
        'name': '已拒绝',
        'color': '#FF4D4F',
        'icon': 'close-circle',
        'description': '工单被拒绝（无效/重复）',
        'allowedNextStatus': [],
        'requireReason': True,
        'isFinal': True,
        'badge': 'error'
    }
}

# 优先级定义
TICKET_PRIORITY = {
    'CRITICAL': {
        'code': 'CRITICAL',
        'name': '紧急',
        'level': 0,
        'color': '#FF4D4F',
        'slaMultiplier': 0.5,
        'autoEscalate': True,
        'description': '严重影响结构安全',
        'badge': 'error'
    },
    'HIGH': {
        'code': 'HIGH',
        'name': '高',
        'level': 1,
        'color': '#FA8C16',
        'slaMultiplier': 0.75,
        'description': '重要数据异常，需尽快处理',
        'badge': 'warning'
    },
    'MEDIUM': {
        'code': 'MEDIUM',
        'name': '中',
        'level': 2,
        'color': '#1890FF',
        'slaMultiplier': 1.0,
        'description': '一般性问题，正常处理',
        'badge': 'processing'
    },
    'LOW': {
        'code': 'LOW',
        'name': '低',
        'level': 3,
        'color': '#52C41A',
        'slaMultiplier': 1.5,
        'description': '不紧急，可以延后处理',
        'badge': 'success'
    }
}

# 用户角色定义
USER_ROLES = {
    'ADMIN': {
        'code': 'admin',
        'name': '系统管理员',
        'permissions': ['all']
    },
    'MONITORING_ENGINEER': {
        'code': 'monitoring_engineer',
        'name': '监测工程师',
        'permissions': ['create', 'view_all', 'handle', 'assign']
    },
    'FIELD_TECHNICIAN': {
        'code': 'field_technician',
        'name': '现场技术员',
        'permissions': ['handle', 'update', 'comment', 'view_assigned']
    },
    'DATA_ANALYST': {
        'code': 'data_analyst',
        'name': '数据分析师',
        'permissions': ['create', 'view', 'analyze', 'comment']
    },
    'OPERATOR': {
        'code': 'operator',
        'name': '操作员',
        'permissions': ['create', 'view_own']
    }
}

# 状态流转权限控制
STATUS_TRANSITION_PERMISSIONS = {
    'PENDING -> IN_PROGRESS': ['admin', 'monitoring_engineer', 'field_technician'],
    'PENDING -> REJECTED': ['admin', 'monitoring_engineer'],
    'IN_PROGRESS -> SUSPENDED': ['field_technician', 'admin'],
    'IN_PROGRESS -> RESOLVED': ['field_technician', 'admin', 'monitoring_engineer'],
    'SUSPENDED -> IN_PROGRESS': ['field_technician', 'admin'],
    'RESOLVED -> CLOSED': ['creator', 'admin', 'monitoring_engineer'],
    'RESOLVED -> IN_PROGRESS': ['creator', 'admin', 'monitoring_engineer']
}

# 工单自动分配规则
AUTO_ASSIGN_RULES = {
    'byType': {
        'SETTLEMENT_ALERT': 'monitoring_engineer',
        'CRACK_ALERT': 'monitoring_engineer',
        'EQUIPMENT_FAULT': 'field_technician',
        'MAINTENANCE': 'field_technician',
        'INSPECTION': 'field_technician',
        'DATA_ANALYSIS': 'data_analyst'
    },
    'byPriority': {
        'CRITICAL': 'monitoring_engineer',
        'HIGH': 'monitoring_engineer'
    }
}

# 通知配置
NOTIFICATION_CONFIG = {
    'enabled': True,
    'channels': {
        'IN_APP': True,
        'EMAIL': False,  # 暂时关闭邮件通知
        'WEBHOOK': False
    },
    'rules': [
        {
            'event': 'TICKET_CREATED',
            'notify': ['assignee', 'admin'],
            'template': '新工单 {ticket_no} 已创建，请及时处理'
        },
        {
            'event': 'TICKET_ASSIGNED',
            'notify': ['assignee'],
            'template': '工单 {ticket_no} 已分配给您，请及时处理'
        },
        {
            'event': 'TICKET_RESOLVED',
            'notify': ['creator'],
            'template': '您的工单 {ticket_no} 已解决，请确认'
        },
        {
            'event': 'TICKET_OVERDUE',
            'notify': ['assignee', 'admin'],
            'template': '⚠️ 工单 {ticket_no} 已超期，请尽快处理',
            'priority': 'HIGH'
        }
    ]
}

# 工单编号规则
TICKET_NUMBER_RULES = {
    'prefix': 'MON',  # Monitoring
    'date_format': '%Y%m%d',
    'sequence_digits': 3,
    'separator': '-'
}

def get_ticket_type(code):
    """获取工单类型信息"""
    return TICKET_TYPES.get(code)

def get_ticket_status(code):
    """获取工单状态信息"""
    return TICKET_STATUS.get(code)

def get_priority(code):
    """获取优先级信息"""
    return TICKET_PRIORITY.get(code)

def can_transition_status(from_status, to_status, user_role):
    """检查状态流转是否合法"""
    status_info = TICKET_STATUS.get(from_status)
    if not status_info:
        return False

    # 检查是否允许流转到目标状态
    if to_status not in status_info.get('allowedNextStatus', []):
        return False

    # 检查用户权限
    transition_key = f"{from_status} -> {to_status}"
    allowed_roles = STATUS_TRANSITION_PERMISSIONS.get(transition_key, [])

    return user_role in allowed_roles or user_role == 'admin'

def calculate_sla(ticket_type, priority):
    """计算 SLA 时间"""
    type_info = get_ticket_type(ticket_type)
    priority_info = get_priority(priority)

    if not type_info or not priority_info:
        return None

    base_hours = type_info.get('slaHours', 24)
    multiplier = priority_info.get('slaMultiplier', 1.0)

    return int(base_hours * multiplier)

def generate_ticket_number():
    """生成工单编号"""
    import datetime
    import random

    today = datetime.datetime.now()
    date_str = today.strftime(TICKET_NUMBER_RULES['date_format'])
    sequence = random.randint(1, 999)

    return f"{TICKET_NUMBER_RULES['prefix']}{TICKET_NUMBER_RULES['separator']}{date_str}{TICKET_NUMBER_RULES['separator']}{sequence:03d}"