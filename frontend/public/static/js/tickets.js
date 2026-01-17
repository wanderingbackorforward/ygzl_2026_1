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

        console.log('[OK] Ticket system initialized');
    } catch (error) {
        console.error('[ERROR] Ticket system init failed:', error);
        showMessage('System init failed: ' + error.message, 'error');
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
            systemUsers = result.data || [];

            // 填充用户选择器
            populateUserSelectors();
        }
    } catch (error) {
        console.error('[WARN] Failed to load users:', error);
        // 使用默认用户
        systemUsers = [
            { user_id: 'admin', display_name: 'System Administrator', role: 'admin' },
            { user_id: 'monitoring_engineer', display_name: 'Monitoring Engineer 1', role: 'monitoring_engineer' },
            { user_id: 'field_technician', display_name: 'Field Technician 1', role: 'field_technician' }
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
        'admin': 'Admin',
        'monitoring_engineer': 'Engineer',
        'field_technician': 'Technician',
        'data_analyst': 'Analyst',
        'operator': 'Operator'
    };
    return roleNames[role] || role;
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

        console.log('[OK] Ticket config loaded');
    } catch (error) {
        console.error('[ERROR] Load ticket config failed:', error);
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
        console.error('[ERROR] Load statistics failed:', error);
    }
}

/**
 * 加载工单列表
 */
async function loadTickets() {
    try {
        showMessage('Loading tickets...', 'info');

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
            throw new Error('Failed to load tickets');
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

        showMessage(`Loaded ${tickets.length} tickets`, 'success');
    } catch (error) {
        console.error('[ERROR] Load tickets failed:', error);
        showMessage('Load tickets failed: ' + error.message, 'error');
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
                <p>${isArchive ? 'No archived tickets' : 'No tickets found'}</p>
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
                ${isArchive ? '<span class="archived-badge"><i class="fas fa-archive"></i> Archived</span>' : ''}
                ${dueInfo.badge}
            </div>
            <div class="ticket-title">${ticket.title}</div>
            <div class="ticket-details">
                <div class="ticket-info">
                    <span class="ticket-type">${getTicketTypeName(ticket.ticket_type)}</span>
                    <span class="priority-${ticket.priority.toLowerCase()}">
                        ${getPriorityName(ticket.priority)}
                    </span>
                    <span><i class="fas fa-user"></i> ${ticket.creator_name || 'Unknown'}</span>
                    <span><i class="fas fa-user-cog"></i> ${ticket.assignee_name || 'Unassigned'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(ticket.created_at)}</span>
                    ${ticket.monitoring_point_id ? `<span><i class="fas fa-map-marker-alt"></i> ${ticket.monitoring_point_id}</span>` : ''}
                    ${ticket.due_at ? `<span class="${dueInfo.class}"><i class="fas fa-hourglass-half"></i> Due: ${formatDueDate(ticket.due_at)}</span>` : ''}
                </div>
            </div>
            ${!isArchive && ticket.status !== 'CLOSED' && ticket.status !== 'REJECTED' ? `
            <div class="quick-actions" onclick="event.stopPropagation();">
                ${!ticket.assignee_id ? `<button class="action-btn assign" onclick="showAssignModal(${ticket.id})"><i class="fas fa-user-plus"></i> Assign</button>` : ''}
                ${(ticket.status === 'CLOSED' || ticket.status === 'REJECTED') ? `<button class="action-btn archive" onclick="archiveTicket(${ticket.id})"><i class="fas fa-archive"></i> Archive</button>` : ''}
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
            badge: '<span class="due-badge overdue"><i class="fas fa-exclamation-circle"></i> Overdue</span>'
        };
    } else if (hoursUntilDue < 24) {
        return {
            class: 'due-soon',
            badge: '<span class="due-badge due-soon"><i class="fas fa-clock"></i> Due Soon</span>'
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
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Create Ticket';
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
        showMessage('Please select an assignee', 'error');
        return;
    }

    // 获取选中用户的名称
    const user = systemUsers.find(u => u.user_id === assigneeId);
    const assigneeName = user ? (user.display_name || user.username) : assigneeId;

    try {
        const response = await fetch(`/api/tickets/${ticketId}/assign`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assignee_id: assigneeId,
                assignee_name: assigneeName
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Assign failed');
        }

        showMessage('Ticket assigned successfully!', 'success');
        closeAssignModal();

        // 重新加载工单列表
        await loadTickets();

    } catch (error) {
        console.error('[ERROR] Assign ticket failed:', error);
        showMessage('Assign failed: ' + error.message, 'error');
    }
}

/**
 * 归档工单
 */
async function archiveTicket(ticketId) {
    if (!confirm('Are you sure you want to archive this ticket?')) {
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
            throw new Error(errorData.message || 'Archive failed');
        }

        showMessage('Ticket archived successfully!', 'success');

        // 重新加载工单列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('[ERROR] Archive ticket failed:', error);
        showMessage('Archive failed: ' + error.message, 'error');
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
            throw new Error('Failed to get ticket details');
        }

        const result = await response.json();
        const ticket = result.data;

        renderTicketDetail(ticket, isArchive);
    } catch (error) {
        console.error('[ERROR] Get ticket detail failed:', error);
        showMessage('Get ticket detail failed: ' + error.message, 'error');
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
                    ${isArchive ? '<span class="archived-badge" style="margin-left:5px;"><i class="fas fa-archive"></i> Archived</span>' : ''}
                    ${dueInfo.badge}
                </div>
            </div>

            <div style="background: rgba(16, 23, 41, 0.8); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #ffffff; margin-top: 0;">${ticket.title}</h4>
                <p style="color: #8aabcc; margin: 10px 0;">${ticket.description || 'No description'}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Type</div>
                    <div style="color: #40aeff; font-weight: bold;">${getTicketTypeName(ticket.ticket_type)}</div>
                </div>
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Priority</div>
                    <div style="color: #40aeff; font-weight: bold;">${getPriorityName(ticket.priority)}</div>
                </div>
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Creator</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.creator_name || 'Unknown'}</div>
                </div>
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Assignee</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.assignee_name || 'Unassigned'}</div>
                </div>
                ${ticket.monitoring_point_id ? `
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Monitoring Point</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.monitoring_point_id}</div>
                </div>
                ` : ''}
                ${ticket.current_value ? `
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Current Value</div>
                    <div style="color: #40aeff; font-weight: bold;">${ticket.current_value}</div>
                </div>
                ` : ''}
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Created At</div>
                    <div style="color: #40aeff; font-weight: bold;">${formatDate(ticket.created_at)}</div>
                </div>
                ${ticket.due_at ? `
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">Due Date</div>
                    <div class="${dueInfo.class}" style="font-weight: bold;">${formatDueDate(ticket.due_at)}</div>
                </div>
                ` : ''}
            </div>

            ${ticket.resolution ? `
            <div style="background: rgba(82, 196, 26, 0.1); border: 1px solid #52c41a; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h5 style="color: #52c41a; margin-top: 0;">Resolution</h5>
                <p style="color: #ffffff; margin: 0;">${ticket.resolution}</p>
            </div>
            ` : ''}
        </div>

        <div style="border-top: 1px solid rgba(64, 174, 255, 0.3); padding-top: 15px;">
            <h4 style="color: #40aeff; margin-top: 0;">Comments</h4>
            <div id="commentsContainer">
                ${renderComments(ticket.comments || [])}
            </div>
        </div>

        <div style="text-align: right; margin-top: 20px;">
            <button class="btn" onclick="closeDetailModal()">Close</button>
            ${!isArchive ? `
                ${!ticket.assignee_id ? `
                <button class="btn" onclick="showAssignModal(${ticketId}); closeDetailModal();">
                    <i class="fas fa-user-plus"></i> Assign
                </button>
                ` : ''}
                ${ticket.status === 'PENDING' ? `
                <button class="btn btn-primary" onclick="updateTicketStatus(${ticketId}, 'IN_PROGRESS')">
                    <i class="fas fa-play"></i> Start
                </button>
                ` : ''}
                ${ticket.status === 'IN_PROGRESS' ? `
                <button class="btn btn-primary" onclick="updateTicketStatus(${ticketId}, 'RESOLVED')">
                    <i class="fas fa-check"></i> Resolve
                </button>
                ` : ''}
                ${ticket.status === 'RESOLVED' ? `
                <button class="btn btn-primary" onclick="updateTicketStatus(${ticketId}, 'CLOSED')">
                    <i class="fas fa-times"></i> Close
                </button>
                ` : ''}
                ${(ticket.status === 'CLOSED' || ticket.status === 'REJECTED') ? `
                <button class="btn" onclick="archiveTicket(${ticketId}); closeDetailModal();">
                    <i class="fas fa-archive"></i> Archive
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
        return '<p style="color: #8aabcc; text-align: center;">No comments</p>';
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
            creator_name: creatorName || 'User'
        };

        // 如果选择了分配人，添加到请求
        if (assigneeId) {
            formData.assignee_id = assigneeId;
            formData.assignee_name = assigneeName;
        }

        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Create ticket failed');
        }

        const result = await response.json();
        showMessage('Ticket created successfully!', 'success');
        closeModal();

        // 重新加载工单列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('[ERROR] Create ticket failed:', error);
        showMessage('Create ticket failed: ' + error.message, 'error');
    }
}

/**
 * 更新工单状态
 */
async function updateTicketStatus(ticketId, newStatus) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                user_id: 'current_user',
                user_role: 'admin'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Update status failed');
        }

        showMessage('Ticket status updated!', 'success');

        // 重新加载工单详情
        await showTicketDetail(ticketId);

        // 重新加载列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('[ERROR] Update ticket status failed:', error);
        showMessage('Update status failed: ' + error.message, 'error');
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

/**
 * 获取工单状态名称
 */
function getTicketStatusName(statusCode) {
    return ticketConfig.status?.[statusCode]?.name || statusCode;
}

/**
 * 获取工单类型名称
 */
function getTicketTypeName(typeCode) {
    return ticketConfig.types?.[typeCode]?.name || typeCode;
}

/**
 * 获取优先级名称
 */
function getPriorityName(priorityCode) {
    return ticketConfig.priority?.[priorityCode]?.name || priorityCode;
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

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
