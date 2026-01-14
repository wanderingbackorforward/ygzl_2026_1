/**
 * 工单管理系统前端脚本
 * 处理工单的增删改查、状态流转、评论等功能
 */

// 全局变量
let currentPage = 1;
let pageSize = 20;
let currentFilters = {};
let ticketConfig = {};

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

        // 初始化筛选器
        initFilters();

        // 加载统计信息
        await loadTicketStatistics();

        // 加载工单列表
        await loadTickets();

        // 绑定表单事件
        bindFormEvents();

        console.log('工单系统初始化完成');
    } catch (error) {
        console.error('工单系统初始化失败:', error);
        showMessage('系统初始化失败: ' + error.message, 'error');
    }
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

        console.log('工单配置加载完成');
    } catch (error) {
        console.error('加载工单配置失败:', error);
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
        }
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

/**
 * 加载工单列表
 */
async function loadTickets() {
    try {
        showMessage('正在加载工单数据...', 'info');

        // 构建查询参数
        const params = new URLSearchParams({
            page: currentPage,
            limit: pageSize,
            ...currentFilters
        });

        const response = await fetch(`/api/tickets?${params}`);
        if (!response.ok) {
            throw new Error('获取工单列表失败');
        }

        const result = await response.json();
        const tickets = result.data.tickets;
        const pagination = result.data.pagination;

        // 渲染工单列表
        renderTicketList(tickets);

        // 渲染分页
        renderPagination(pagination);

        showMessage(`成功加载 ${tickets.length} 条工单记录`, 'success');
    } catch (error) {
        console.error('加载工单列表失败:', error);
        showMessage('加载工单列表失败: ' + error.message, 'error');
    }
}

/**
 * 渲染工单列表
 */
function renderTicketList(tickets) {
    const listContainer = document.getElementById('ticketList');

    if (!tickets || tickets.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #8aabcc;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px;"></i>
                <p>暂无工单数据</p>
            </div>
        `;
        return;
    }

    const ticketsHtml = tickets.map(ticket => `
        <div class="ticket-item" onclick="showTicketDetail(${ticket.id})">
            <div class="ticket-meta">
                <div class="ticket-number">${ticket.ticket_number}</div>
                <div class="ticket-status status-${ticket.status.toLowerCase()}">
                    ${getTicketStatusName(ticket.status)}
                </div>
            </div>
            <div class="ticket-title">${ticket.title}</div>
            <div class="ticket-details">
                <div class="ticket-info">
                    <span class="ticket-type">${getTicketTypeName(ticket.ticket_type)}</span>
                    <span class="priority-${ticket.priority.toLowerCase()}">
                        ${getPriorityName(ticket.priority)}
                    </span>
                    <span><i class="fas fa-user"></i> ${ticket.creator_name || '未知'}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(ticket.created_at)}</span>
                    ${ticket.monitoring_point_id ? `<span><i class="fas fa-map-marker-alt"></i> ${ticket.monitoring_point_id}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    listContainer.innerHTML = ticketsHtml;
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
    document.getElementById('modalTitle').textContent = '创建工单';
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
 * 显示工单详情
 */
async function showTicketDetail(ticketId) {
    try {
        document.getElementById('detailModal').style.display = 'flex';

        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) {
            throw new Error('获取工单详情失败');
        }

        const result = await response.json();
        const ticket = result.data;

        renderTicketDetail(ticket);
    } catch (error) {
        console.error('获取工单详情失败:', error);
        showMessage('获取工单详情失败: ' + error.message, 'error');
        closeDetailModal();
    }
}

/**
 * 渲染工单详情
 */
function renderTicketDetail(ticket) {
    const detailContainer = document.getElementById('ticketDetail');

    const detailHtml = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: #40aeff; margin: 0;">${ticket.ticket_number}</h3>
                <div class="ticket-status status-${ticket.status.toLowerCase()}">
                    ${getTicketStatusName(ticket.status)}
                </div>
            </div>

            <div style="background: rgba(16, 23, 41, 0.8); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #ffffff; margin-top: 0;">${ticket.title}</h4>
                <p style="color: #8aabcc; margin: 10px 0;">${ticket.description || '暂无描述'}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(16, 23, 41, 0.8); padding: 10px; border-radius: 5px;">
                    <div style="color: #8aabcc; font-size: 12px;">工单类型</div>
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
            </div>

            ${ticket.resolution ? `
            <div style="background: rgba(82, 196, 26, 0.1); border: 1px solid #52c41a; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                <h5 style="color: #52c41a; margin-top: 0;">解决方案</h5>
                <p style="color: #ffffff; margin: 0;">${ticket.resolution}</p>
            </div>
            ` : ''}
        </div>

        <div style="border-top: 1px solid rgba(64, 174, 255, 0.3); padding-top: 15px;">
            <h4 style="color: #40aeff; margin-top: 0;">评论记录</h4>
            <div id="commentsContainer">
                ${renderComments(ticket.comments || [])}
            </div>
        </div>

        <div style="text-align: right; margin-top: 20px;">
            <button class="btn" onclick="closeDetailModal()">关闭</button>
            ${ticket.status === 'PENDING' ? `
            <button class="btn btn-primary" onclick="updateTicketStatus(${ticket.id}, 'IN_PROGRESS')">
                <i class="fas fa-play"></i> 开始处理
            </button>
            ` : ''}
            ${ticket.status === 'IN_PROGRESS' ? `
            <button class="btn btn-primary" onclick="updateTicketStatus(${ticket.id}, 'RESOLVED')">
                <i class="fas fa-check"></i> 标记解决
            </button>
            ` : ''}
            ${ticket.status === 'RESOLVED' ? `
            <button class="btn btn-primary" onclick="updateTicketStatus(${ticket.id}, 'CLOSED')">
                <i class="fas fa-times"></i> 关闭工单
            </button>
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

/**
 * 保存工单
 */
async function saveTicket() {
    try {
        const formData = {
            title: document.getElementById('ticketTitle').value,
            ticket_type: document.getElementById('ticketType').value,
            priority: document.getElementById('ticketPriority').value,
            description: document.getElementById('ticketDescription').value,
            monitoring_point_id: document.getElementById('monitoringPoint').value,
            threshold_value: parseFloat(document.getElementById('thresholdValue').value) || null,
            location_info: document.getElementById('locationInfo').value,
            creator_id: 'current_user',
            creator_name: document.getElementById('creatorName').value
        };

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
        console.error('创建工单失败:', error);
        showMessage('创建工单失败: ' + error.message, 'error');
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
            throw new Error(errorData.message || '更新状态失败');
        }

        showMessage('工单状态更新成功！', 'success');

        // 重新加载工单详情
        await showTicketDetail(ticketId);

        // 重新加载列表和统计信息
        await loadTickets();
        await loadTicketStatistics();

    } catch (error) {
        console.error('更新工单状态失败:', error);
        showMessage('更新工单状态失败: ' + error.message, 'error');
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