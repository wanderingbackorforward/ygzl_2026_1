/**
 * 工单管理系统前端脚本
 * 处理工单的增删改查、状态流转、评论、归档等功能
 */

// 全局变量
let currentPage = 1;
let pageSize = 20;
let currentFilters = {};
let ticketConfig = {};
let systemUsers = [];
let currentTab = 'active';
let emailOptionModalInitialized = false;
let emailOptionModalResolver = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initTicketSystem();
});

/**
 * 初始化工单系统
 */
async function initTicketSystem() {
    try {
        // 加载配置信息
        await loadTicketConfig();

        // 加载系统用户
        await loadSystemUsers();

        // 初始化筛选器
        initFilters();

        // 加载统计信息
        await loadTicketStatistics();

        // 加载工单列表
        await loadTickets();

        // 绑定表单事件
        bindFormEvents();

        console.log('[OK] 工单系统初始化完成');
    } catch (error) {
        console.error('[ERROR] 工单系统初始化失败:', error);
        showMessage('系统初始化失败：' + error.message, 'error');
    }
}

/**
 * 加载系统用户列表
 */
async function loadSystemUsers() {
    try {
        const response = await fetch('/api/users');
        if (response.ok) {
            const result = await response.json();
            systemUsers = (result && result.data && (result.data.users || result.data)) || [];

            // 填充用户选择器
            populateUserSelectors();
        }
    } catch (error) {
        console.error('[WARN] 加载用户失败:', error);
        // 使用默认用户
        systemUsers = [
            { user_id: 'admin', display_name: '系统管理员', role: 'admin' },
            { user_id: 'monitoring_engineer', display_name: '监测工程师1', role: 'monitoring_engineer' },
            { user_id: 'field_technician', display_name: '现场技术员1', role: 'field_technician' }
        ];
        populateUserSelectors();
    }
}

/**
 * 填充用户选择器
 */
function populateUserSelectors() {
    const assigneeSelect = document.getElementById('ticketAssignee');
    const creatorSelect = document.getElementById('creatorSelect');
    const assigneeModalSelect = document.getElementById('assigneeSelect');

    // 清空现有选项（保留第一个默认选项）
    [assigneeSelect, creatorSelect, assigneeModalSelect].forEach(select => {
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
        }
    });

    // 添加用户选项
    systemUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.user_id;
        option.textContent = `${user.display_name || user.username} (${getRoleName(user.role)})`;

        if (assigneeSelect) assigneeSelect.appendChild(option.cloneNode(true));
        if (creatorSelect) creatorSelect.appendChild(option.cloneNode(true));
        if (assigneeModalSelect) assigneeModalSelect.appendChild(option.cloneNode(true));
    });
}

/**
 * 获取角色名称
 */
function getRoleName(role) {
    const roleNames = {
        'admin': '系统管理员',
        'monitoring_engineer': '监测工程师',
        'field_technician': '现场技术员',
        'data_analyst': '数据分析师',
        'operator': '操作员'
    };
    return roleNames[role] || '未知角色';
}

/**
 * 加载工单配置信息
 */
async function loadTicketConfig() {
    try {
        // 加载工单类型
        const typesResponse = await fetch('/api/tickets/config/types');
        if (typesResponse.ok) {
            const typesData = await typesResponse.json();
            ticketConfig.types = typesData.data;
        }

        // 加载工单状态
        const statusResponse = await fetch('/api/tickets/config/status');
        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            ticketConfig.status = statusData.data;
        }

        // 加载优先级配置
        const priorityResponse = await fetch('/api/tickets/config/priority');
        if (priorityResponse.ok) {
            const priorityData = await priorityResponse.json();
            ticketConfig.priority = priorityData.data;
        }

        console.log('[OK] 工单配置加载完成');
    } catch (error) {
        console.error('[ERROR] 加载工单配置失败:', error);
        throw error;
    }
}

/**
 * 初始化筛选器
 */
function initFilters() {
    // 初始化状态筛选器
    const statusFilter = document.getElementById('statusFilter');
    if (ticketConfig.status) {
        Object.entries(ticketConfig.status).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.name;
            statusFilter.appendChild(option);
        });
    }

    // 初始化类型筛选器
    const typeFilter = document.getElementById('typeFilter');
    if (ticketConfig.types) {
        Object.entries(ticketConfig.types).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.name;
            typeFilter.appendChild(option);
        });
    }

    // 初始化优先级筛选器
    const priorityFilter = document.getElementById('priorityFilter');
    if (ticketConfig.priority) {
        Object.entries(ticketConfig.priority).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.name;
            priorityFilter.appendChild(option);
        });
    }

    // 初始化工单类型下拉框
    const ticketTypeSelect = document.getElementById('ticketType');
    if (ticketConfig.types) {
        Object.entries(ticketConfig.types).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.name;
            ticketTypeSelect.appendChild(option);
        });
    }
}

/**
 * 切换Tab
 */
function switchTab(tab) {
    currentTab = tab;
    currentPage = 1;

    // 更新Tab样式
    document.querySelectorAll('.ticket-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.tab-btn').classList.add('active');

    // 加载对应数据
    loadTickets();
}

/**
 * 加载工单统计信息
 */
async function loadTicketStatistics() {
    try {
        const response = await fetch('/api/tickets/statistics');
        if (response.ok) {
            const result = await response.json();
            const stats = result.data;

            // 更新统计显示
            document.getElementById('totalTickets').textContent = stats.total || 0;
            document.getElementById('pendingTickets').textContent = stats.by_status?.PENDING || 0;
            document.getElementById('inProgressTickets').textContent = stats.by_status?.IN_PROGRESS || 0;
            document.getElementById('resolvedTickets').textContent = stats.by_status?.RESOLVED || 0;
            document.getElementById('todayTickets').textContent = stats.today_created || 0;
            document.getElementById('overdueTickets').textContent = stats.overdue || 0;

            // 更新Tab badges
            const overdueCount = stats.overdue || 0;
            const dueSoonEl = document.getElementById('dueSoonCount');
            const overdueEl = document.getElementById('overdueCount');

            if (overdueCount > 0) {
                overdueEl.textContent = overdueCount;
                overdueEl.style.display = 'inline';
            }
        }
    } catch (error) {
        console.error('[ERROR] 加载统计信息失败:', error);
    }
}

/**
 * 加载工单列表
 */
async function loadTickets() {
    try {
        showMessage('正在加载工单...', 'info');

        let url;
        const params = new URLSearchParams({
            page: currentPage,
            limit: pageSize,
            ...currentFilters
        });

        // 根据当前Tab选择API
        switch (currentTab) {
            case 'active':
                url = `/api/tickets/active?${params}`;
                break;
            case 'due-soon':
                url = `/api/tickets/due-soon`;
                break;
            case 'overdue':
                url = `/api/tickets/overdue`;
                break;
            case 'archive':
                url = `/api/tickets/archive?${params}`;
                break;
            default:
                url = `/api/tickets?${params}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('加载工单失败');
        }

        const result = await response.json();

        // 处理不同的响应格式
        let tickets, pagination;
        if (result.data.tickets) {
            tickets = result.data.tickets;
            pagination = result.data.pagination;
        } else if (Array.isArray(result.data)) {
            tickets = result.data;
            pagination = null;
        } else {
            tickets = [];
            pagination = null;
        }

        // 渲染工单列表
        renderTicketList(tickets, currentTab === 'archive');

        // 渲染分页
        if (pagination) {
            renderPagination(pagination);
        } else {
            document.getElementById('pagination').innerHTML = '';
        }

        showMessage(`已加载 ${tickets.length} 条工单`, 'success');
    } catch (error) {
        console.error('[ERROR] 加载工单列表失败:', error);
        showMessage('加载工单失败：' + error.message, 'error');
    }
}

/**
 * 渲染工单列表
 */
function renderTicketList(tickets, isArchive = false) {
    const listContainer = document.getElementById('ticketList');

    if (!tickets || tickets.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #8aabcc;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px;"></i>
                <p>${isArchive ? '暂无归档工单' : '暂无工单'}</p>
            </div>
        `;
        return;
    }

    const ticketsHtml = tickets.map(ticket => {
        const dueInfo = getDueInfo(ticket);
        const ticketId = isArchive ? ticket.original_id : ticket.id;

        return `
        <div class="ticket-item" onclick="showTicketDetail(${ticketId}, ${isArchive})">
            <div class="ticket-meta">
                <div class="ticket-number">${ticket.ticket_number}</div>
                <div class="ticket-status status-${ticket.status.toLowerCase()}">
                    ${getTicketStatusName(ticket.status)}
                </div>
                ${isArchive ? '<span class="archived-badge"><i class="fas fa-archive"></i> 已归档</span>' : ''}
                ${dueInfo.badge}
            </div>
            <div class="ticket-title">${ticket.title}</div>
            <div class="ticket-details">
                <div class="ticket-info">
                    <span class="ticket-type">${getTicketTypeName(ticket.ticket_type)}</span>
                    <span class="priority-${ticket.priority.toLowerCase()}">
                        ${getPriorityName(ticket.priority)}
                    </span>
                    <span><i class="fas fa-user"></i> ${ticket.creator_name || '未知'}</span>
                    <span><i class="fas fa-user-cog"></i> ${ticket.assignee_name || '未分配'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(ticket.created_at)}</span>
                    ${ticket.monitoring_point_id ? `<span><i class="fas fa-map-marker-alt"></i> ${ticket.monitoring_point_id}</span>` : ''}
                    ${ticket.due_at ? `<span class="${dueInfo.class}"><i class="fas fa-hourglass-half"></i> 到期：${formatDueDate(ticket.due_at)}</span>` : ''}
                </div>
            </div>
            ${!isArchive && ticket.status !== 'CLOSED' && ticket.status !== 'REJECTED' ? `
            <div class="quick-actions" onclick="event.stopPropagation();">
                ${!ticket.assignee_id ? `<button class="action-btn assign" onclick="showAssignModal(${ticket.id})"><i class="fas fa-user-plus"></i> 分配</button>` : ''}
                ${(ticket.status === 'CLOSED' || ticket.status === 'REJECTED') ? `<button class="action-btn archive" onclick="archiveTicket(${ticket.id})"><i class="fas fa-archive"></i> 归档</button>` : ''}
            </div>
            ` : ''}
        </div>
    `}).join('');

    listContainer.innerHTML = ticketsHtml;
}

/**
 * 获取到期信息
 */
function getDueInfo(ticket) {
    if (!ticket.due_at) {
        return { class: '', badge: '' };
    }

    const now = new Date();
    const dueDate = new Date(ticket.due_at);
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' || ticket.status === 'REJECTED') {
        return { class: '', badge: '' };
    }

    if (hoursUntilDue < 0) {
        return {
            class: 'overdue',
            badge: '<span class="due-badge overdue"><i class="fas fa-exclamation-circle"></i> 已超期</span>'
        };
    } else if (hoursUntilDue < 24) {
        return {
            class: 'due-soon',
            badge: '<span class="due-badge due-soon"><i class="fas fa-clock"></i> 即将到期</span>'
        };
    }

    return { class: '', badge: '' };
}

/**
 * 格式化到期日期
 */
function formatDueDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 渲染分页
 */
function renderPagination(pagination) {
    const paginationContainer = document.getElementById('pagination');

    if (!pagination || pagination.pages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHtml = '';

    // 上一页按钮
    paginationHtml += `
        <button class="page-btn" onclick="changePage(${pagination.page - 1})"
                ${pagination.page <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // 页码按钮
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);

    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <button class="page-btn ${i === pagination.page ? 'active' : ''}"
                    onclick="changePage(${i})">${i}</button>
        `;
    }

    // 下一页按钮
    paginationHtml += `
        <button class="page-btn" onclick="changePage(${pagination.page + 1})"
                ${pagination.page >= pagination.pages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    paginationContainer.innerHTML = paginationHtml;
}

/**
 * 切换页面
 */
function changePage(page) {
    if (page < 1) return;
    currentPage = page;
    loadTickets();
}

/**
 * 刷新工单列表
 */
function refreshTickets() {
    // 获取筛选条件
    const statusFilter = document.getElementById('statusFilter').value;
    const typeFilter = document.getElementById('typeFilter').value;
    const priorityFilter = document.getElementById('priorityFilter').value;
    const searchInput = document.getElementById('searchInput').value;

    // 构建筛选条件
    currentFilters = {};
    if (statusFilter) currentFilters.status = statusFilter;
    if (typeFilter) currentFilters.type = typeFilter;
    if (priorityFilter) currentFilters.priority = priorityFilter;
    if (searchInput) currentFilters.search = searchInput;

    // 重置到第一页
    currentPage = 1;

    // 重新加载工单列表
    loadTickets();
}

/**
 * 显示创建工单模态框
 */
function showCreateModal() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> 创建工单';
    document.getElementById('ticketForm').reset();
    document.getElementById('ticketModal').style.display = 'flex';
}

/**
 * 关闭模态框
 */
function closeModal() {
    document.getElementById('ticketModal').style.display = 'none';
}

/**
 * 显示分配模态框
 */
function showAssignModal(ticketId) {
    document.getElementById('assignTicketId').value = ticketId;
    document.getElementById('assigneeSelect').value = '';
    document.getElementById('assignModal').style.display = 'flex';
}

/**
 * 关闭分配模态框
 */
function closeAssignModal() {
    document.getElementById('assignModal').style.display = 'none';
}

/**
 * 确认分配
 */
async function confirmAssign() {
    const ticketId = document.getElementById('assignTicketId').value;
    const assigneeId = document.getElementById('assigneeSelect').value;

    if (!assigneeId) {
        showMessage('请选择处理人', 'error');
        return;
    }

    // 获取选中用户的名称
    const user = systemUsers.find(u => u.user_id === assigneeId);
    const assigneeName = user ? (user.display_name || user.username) : assigneeId;

    try {
        const emailChoice = await askEmailOption('分配工单');
        if (!emailChoice.proceed) {
            return;
        }

        const response = await fetch(`/api/tickets/${ticketId}/assign`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assignee_id: assigneeId,
                assignee_name: assigneeName,
                send_email: emailChoice.send_email
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '分配失败');
        }

        showMessage('工单分配成功！', 'success');
        closeAssignModal();

        // 重新加载工单列表
        await loadTickets();

    } catch (error) {
        console.error('[ERROR] 分配工单失败:', error);
        showMessage('分配失败：' + error.message, 'error');
    }
}

/**
 * 归档工单
 */
async function archiveTicket(ticketId) {
    if (!confirm('确定要归档该工单吗？')) {
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}/archive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '归档失败');
        }

        showMessage('工单归档成功！', 'success');

        // 重新加载工单列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('[ERROR] 归档工单失败:', error);
        showMessage('归档失败：' + error.message, 'error');
    }
}

/**
 * 显示工单详情
 */
async function showTicketDetail(ticketId, isArchive = false) {
    try {
        document.getElementById('detailModal').style.display = 'flex';

        const url = isArchive ? `/api/tickets/archive/${ticketId}` : `/api/tickets/${ticketId}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('获取工单详情失败');
        }

        const result = await response.json();
        const ticket = result.data;

        renderTicketDetail(ticket, isArchive);
    } catch (error) {
        console.error('[ERROR] 获取工单详情失败:', error);
        showMessage('获取工单详情失败：' + error.message, 'error');
        closeDetailModal();
    }
}

/**
 * 渲染工单详情
 */
function renderTicketDetail(ticket, isArchive = false) {
    const detailContainer = document.getElementById('ticketDetail');
    const dueInfo = getDueInfo(ticket);
    const ticketId = isArchive ? ticket.original_id : ticket.id;

    const detailHtml = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: #40aeff; margin: 0;">${ticket.ticket_number}</h3>
                <div>
                    <span class="ticket-status status-${ticket.status.toLowerCase()}">
                        ${getTicketStatusName(ticket.status)}
                    </span>
                    ${isArchive ? '<span class="archived-badge" style="margin-left:5px;"><i class="fas fa-archive"></i> 已归档</span>' : ''}
                    ${dueInfo.badge}
                </div>
            </div>

            <div style="background: rgba(16, 23, 41, 0.8); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #ffffff; margin-top: 0;">${ticket.title}</h4>
                <p style="color: #8aabcc; margin: 10px 0;">${ticket.description || '暂无描述'}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">类型</div>
                    <div style="color: #40aeff; font-weight: bold;">${getTicketTypeName(ticket.ticket_type)}</div>
                </div>
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">优先级</div>
                    <div style="color: #40aeff; font-weight: bold;">${getPriorityName(ticket.priority)}</div>
                </div>
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">创建人</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.creator_name || '未知'}</div>
                </div>
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">处理人</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.assignee_name || '未分配'}</div>
                </div>
                ${ticket.monitoring_point_id ? `
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">监测点</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.monitoring_point_id}</div>
                </div>
                ` : ''}
                ${ticket.current_value ? `
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">当前值</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.current_value}</div>
                </div>
                ` : ''}
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">创建时间</div>
                    <div style="color: #40aeff; font-weight: bold;">${formatDate(ticket.created_at)}</div>
                </div>
                ${ticket.due_at ? `
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">到期时间</div>
                    <div class="${dueInfo.class}" style="font-weight: bold;">${formatDueDate(ticket.due_at)}</div>
                </div>
                ` : ''}
            </div>

            ${ticket.resolution ? `
            <div style="background: rgba(82, 196, 26, 0.1); border: 1px solid #52c41a; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h5 style="color: #52c41a; margin-top: 0;">解决方案</h5>
                <p style="color: #ffffff; margin: 0;">${ticket.resolution}</p>
            </div>
            ` : ''}
        </div>

        <div style="border-top: 1px solid rgba(64, 174, 255, 0.3); padding-top: 15px;">
            <h4 style="color: #40aeff; margin-top: 0;">评论</h4>
            <div id="commentsContainer">
                ${renderComments(ticket.comments || [])}
            </div>
        </div>

        <div style="text-align: right; margin-top: 20px;">
            <button class="btn" onclick="closeDetailModal()">关闭</button>
            ${!isArchive ? `
                ${!ticket.assignee_id ? `
                <button class="btn" onclick="showAssignModal(${ticketId}); closeDetailModal();">
                    <i class="fas fa-user-plus"></i> 分配
                </button>
                ` : ''}
                ${ticket.status === 'PENDING' ? `
                <button class="btn btn-primary" onclick="updateTicketStatus(${ticketId}, 'IN_PROGRESS')">
                    <i class="fas fa-play"></i> 开始处理
                </button>
                ` : ''}
                ${ticket.status === 'IN_PROGRESS' ? `
                <button class="btn btn-primary" onclick="updateTicketStatus(${ticketId}, 'RESOLVED')">
                    <i class="fas fa-check"></i> 标记已解决
                </button>
                ` : ''}
                ${ticket.status === 'RESOLVED' ? `
                <button class="btn btn-primary" onclick="updateTicketStatus(${ticketId}, 'CLOSED')">
                    <i class="fas fa-times"></i> 关闭工单
                </button>
                ` : ''}
                ${(ticket.status === 'CLOSED' || ticket.status === 'REJECTED') ? `
                <button class="btn" onclick="archiveTicket(${ticketId}); closeDetailModal();">
                    <i class="fas fa-archive"></i> 归档
                </button>
                ` : ''}
            ` : ''}
        </div>
    `;

    detailContainer.innerHTML = detailHtml;
}

/**
 * 渲染评论列表
 */
function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return '<p style="color: #8aabcc; text-align: center;">暂无评论</p>';
    }

    return comments.map(comment => `
        <div style="background: rgba(16, 23, 41, 0.8); border-radius: 5px; padding: 10px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #40aeff; font-weight: bold;">${comment.author_name}</span>
                <span style="color: #8aabcc; font-size: 12px;">${formatDate(comment.created_at)}</span>
            </div>
            <p style="color: #ffffff; margin: 0;">${comment.content}</p>
        </div>
    `).join('');
}

/**
 * 关闭详情模态框
 */
function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
}

/**
 * 绑定表单事件
 */
function bindFormEvents() {
    const ticketForm = document.getElementById('ticketForm');
    ticketForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveTicket();
    });

    // 筛选器事件
    document.getElementById('statusFilter').addEventListener('change', refreshTickets);
    document.getElementById('typeFilter').addEventListener('change', refreshTickets);
    document.getElementById('priorityFilter').addEventListener('change', refreshTickets);

    // 搜索框回车事件
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            refreshTickets();
        }
    });
}

function ensureEmailOptionModal() {
    if (emailOptionModalInitialized) return;
    emailOptionModalInitialized = true;

    const modal = document.createElement('div');
    modal.id = 'emailOptionModal';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.zIndex = '9999';
    modal.style.background = 'rgba(0,0,0,0.65)';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    modal.innerHTML = `
        <div style="width: 420px; max-width: calc(100% - 32px); background: #1b2330; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 16px 16px 14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 10px;">
                <div style="font-size: 16px; color: #e6f4ff; font-weight: 600;">邮件通知</div>
                <button id="emailOptionCloseBtn" style="background: transparent; border: 0; color: rgba(255,255,255,0.7); font-size: 18px; cursor: pointer;">×</button>
            </div>
            <div id="emailOptionText" style="color: rgba(255,255,255,0.86); line-height: 1.5; margin-bottom: 12px;">本次操作是否发送邮件通知？</div>
            <label style="display:flex; align-items:center; gap:10px; background: rgba(255,255,255,0.06); padding: 10px 12px; border-radius: 10px; margin-bottom: 14px; cursor: pointer;">
                <input id="emailOptionCheckbox" type="checkbox" checked style="transform: scale(1.1);">
                <span style="color: rgba(255,255,255,0.9);">发送邮件通知</span>
            </label>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="emailOptionCancelBtn" style="padding: 8px 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; color: rgba(255,255,255,0.9); cursor: pointer;">取消操作</button>
                <button id="emailOptionOkBtn" style="padding: 8px 12px; background: #1677ff; border: 1px solid rgba(0,0,0,0.15); border-radius: 10px; color: #fff; cursor: pointer;">继续</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (emailOptionModalResolver) {
                const resolver = emailOptionModalResolver;
                emailOptionModalResolver = null;
                modal.style.display = 'none';
                resolver({ proceed: false, send_email: true });
            }
        }
    });

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#emailOptionCloseBtn');
    const cancelBtn = modal.querySelector('#emailOptionCancelBtn');
    const okBtn = modal.querySelector('#emailOptionOkBtn');

    const close = (result) => {
        if (!emailOptionModalResolver) return;
        const resolver = emailOptionModalResolver;
        emailOptionModalResolver = null;
        modal.style.display = 'none';
        resolver(result);
    };

    closeBtn.addEventListener('click', () => close({ proceed: false, send_email: true }));
    cancelBtn.addEventListener('click', () => close({ proceed: false, send_email: true }));
    okBtn.addEventListener('click', () => {
        const checkbox = modal.querySelector('#emailOptionCheckbox');
        close({ proceed: true, send_email: !!(checkbox && checkbox.checked) });
    });
}

async function askEmailOption(actionText) {
    ensureEmailOptionModal();
    const modal = document.getElementById('emailOptionModal');
    const checkbox = modal.querySelector('#emailOptionCheckbox');
    const text = modal.querySelector('#emailOptionText');
    if (checkbox) checkbox.checked = true;
    if (text) text.textContent = `${actionText}：是否发送邮件通知？`;
    modal.style.display = 'flex';
    return await new Promise((resolve) => {
        emailOptionModalResolver = resolve;
    });
}

/**
 * 保存工单
 */
async function saveTicket() {
    try {
        const creatorSelect = document.getElementById('creatorSelect');
        const creatorId = creatorSelect.value;
        const creatorUser = systemUsers.find(u => u.user_id === creatorId);
        const creatorName = creatorUser ? (creatorUser.display_name || creatorUser.username) : creatorId;

        const assigneeSelect = document.getElementById('ticketAssignee');
        const assigneeId = assigneeSelect.value;
        const assigneeUser = systemUsers.find(u => u.user_id === assigneeId);
        const assigneeName = assigneeUser ? (assigneeUser.display_name || assigneeUser.username) : '';

        const formData = {
            title: document.getElementById('ticketTitle').value,
            ticket_type: document.getElementById('ticketType').value,
            priority: document.getElementById('ticketPriority').value,
            description: document.getElementById('ticketDescription').value,
            monitoring_point_id: document.getElementById('monitoringPoint').value,
            threshold_value: parseFloat(document.getElementById('thresholdValue').value) || null,
            location_info: document.getElementById('locationInfo').value,
            creator_id: creatorId || 'current_user',
            creator_name: creatorName || '用户'
        };

        // 如果选择了分配人，添加到请求
        if (assigneeId) {
            formData.assignee_id = assigneeId;
            formData.assignee_name = assigneeName;
        }

        const emailChoice = await askEmailOption('创建工单');
        if (!emailChoice.proceed) {
            return;
        }
        formData.send_email = emailChoice.send_email;

        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '创建工单失败');
        }

        const result = await response.json();
        showMessage('工单创建成功！', 'success');
        closeModal();

        // 重新加载工单列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('[ERROR] 创建工单失败:', error);
        showMessage('创建工单失败：' + error.message, 'error');
    }
}

/**
 * 更新工单状态
 */
async function updateTicketStatus(ticketId, newStatus) {
    try {
        const emailChoice = await askEmailOption(`更新工单状态为 ${getTicketStatusName(newStatus)}`);
        if (!emailChoice.proceed) {
            return;
        }

        const response = await fetch(`/api/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                user_id: 'current_user',
                user_role: 'admin',
                send_email: emailChoice.send_email
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '更新状态失败');
        }

        showMessage('工单状态已更新！', 'success');

        // 重新加载工单详情
        await showTicketDetail(ticketId);

        // 重新加载列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('[ERROR] 更新工单状态失败:', error);
        showMessage('更新状态失败：' + error.message, 'error');
    }
}

/**
 * 显示消息
 */
function showMessage(message, type = 'info') {
    const messageArea = document.getElementById('messageArea');
    const className = type === 'error' ? 'error-message' :
                     type === 'success' ? 'success-message' :
                     'info-message';

    messageArea.innerHTML = `<div class="${className}">${message}</div>`;

    // 3秒后自动清除消息
    setTimeout(() => {
        messageArea.innerHTML = '';
    }, 3000);
}

const FALLBACK_STATUS_NAMES = {
    'PENDING': '待处理',
    'IN_PROGRESS': '处理中',
    'SUSPENDED': '已挂起',
    'RESOLVED': '已解决',
    'CLOSED': '已关闭',
    'REJECTED': '已拒绝'
};

const FALLBACK_TYPE_NAMES = {
    'SETTLEMENT_ALERT': '沉降预警',
    'CRACK_ALERT': '裂缝预警',
    'EQUIPMENT_FAULT': '设备故障',
    'MAINTENANCE': '维护保养',
    'INSPECTION': '巡检任务',
    'DATA_ANALYSIS': '数据分析'
};

const FALLBACK_PRIORITY_NAMES = {
    'CRITICAL': '紧急',
    'HIGH': '高',
    'MEDIUM': '中',
    'LOW': '低'
};

/**
 * 获取工单状态名称
 */
function getTicketStatusName(statusCode) {
    return ticketConfig.status?.[statusCode]?.name || FALLBACK_STATUS_NAMES[statusCode] || '未知状态';
}

/**
 * 获取工单类型名称
 */
function getTicketTypeName(typeCode) {
    return ticketConfig.types?.[typeCode]?.name || FALLBACK_TYPE_NAMES[typeCode] || '未知类型';
}

/**
 * 获取优先级名称
 */
function getPriorityName(priorityCode) {
    return ticketConfig.priority?.[priorityCode]?.name || FALLBACK_PRIORITY_NAMES[priorityCode] || '未知';
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN');
}

// 暴露全局函数
window.showCreateModal = showCreateModal;
window.closeModal = closeModal;
window.showTicketDetail = showTicketDetail;
window.closeDetailModal = closeDetailModal;
window.refreshTickets = refreshTickets;
window.changePage = changePage;
window.updateTicketStatus = updateTicketStatus;
window.switchTab = switchTab;
window.showAssignModal = showAssignModal;
window.closeAssignModal = closeAssignModal;
window.confirmAssign = confirmAssign;
window.archiveTicket = archiveTicket;
