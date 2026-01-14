// 通用图表放大功能
function setupChartZoom(chartsObj) {
    console.log('设置图表放大功能');
    
    // 创建模态框（如果不存在）
    let zoomModal = document.getElementById('chart-zoom-modal');
    if (!zoomModal) {
        zoomModal = document.createElement('div');
        zoomModal.id = 'chart-zoom-modal';
        zoomModal.className = 'chart-zoom-modal';
        zoomModal.style.display = 'none';
        zoomModal.style.position = 'fixed';
        zoomModal.style.zIndex = '1000';
        zoomModal.style.left = '0';
        zoomModal.style.top = '0';
        zoomModal.style.width = '100%';
        zoomModal.style.height = '100%';
        zoomModal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        zoomModal.style.display = 'none';
        zoomModal.style.justifyContent = 'center';
        zoomModal.style.alignItems = 'center';
        
        // 添加关闭按钮
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '20px';
        closeBtn.style.right = '30px';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '35px';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.zIndex = '1001';
        closeBtn.onclick = function() {
            closeZoomModal();
        };
        
        // 添加内容容器
        const contentDiv = document.createElement('div');
        contentDiv.id = 'chart-zoom-content';
        contentDiv.style.width = '80%';
        contentDiv.style.height = '80%';
        contentDiv.style.backgroundColor = 'rgba(12, 20, 38, 0.95)';
        contentDiv.style.borderRadius = '8px';
        contentDiv.style.padding = '20px';
        contentDiv.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.5)';
        contentDiv.style.position = 'relative';
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';
        
        // 添加标题
        const titleDiv = document.createElement('div');
        titleDiv.id = 'chart-zoom-title';
        titleDiv.style.color = 'white';
        titleDiv.style.fontSize = '20px';
        titleDiv.style.fontWeight = 'bold';
        titleDiv.style.marginBottom = '15px';
        titleDiv.style.borderBottom = '1px solid rgba(0, 229, 255, 0.3)';
        titleDiv.style.paddingBottom = '10px';
        
        // 添加图表容器
        const chartDiv = document.createElement('div');
        chartDiv.id = 'chart-zoom-chart';
        chartDiv.style.flex = '1';
        chartDiv.style.width = '100%';
        
        // 添加数据表格容器
        const tableDiv = document.createElement('div');
        tableDiv.id = 'chart-zoom-table';
        tableDiv.style.marginTop = '15px';
        tableDiv.style.width = '100%';
        tableDiv.style.maxHeight = '200px';
        tableDiv.style.overflowY = 'auto';
        tableDiv.style.display = 'none'; // 默认隐藏表格区域
        
        // 组装DOM
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(chartDiv);
        contentDiv.appendChild(tableDiv);
        zoomModal.appendChild(closeBtn);
        zoomModal.appendChild(contentDiv);
        document.body.appendChild(zoomModal);
    }
    
    // 为所有图表容器添加点击事件
    const chartContainers = document.querySelectorAll('.chart');
    chartContainers.forEach(container => {
        container.style.cursor = 'pointer';
        
        // 添加小图标提示点击可放大
        const zoomIcon = document.createElement('div');
        zoomIcon.className = 'chart-zoom-icon';
        zoomIcon.innerHTML = '<i class="fas fa-search-plus"></i>';
        zoomIcon.style.position = 'absolute';
        zoomIcon.style.top = '10px';
        zoomIcon.style.right = '10px';
        zoomIcon.style.color = 'rgba(255, 255, 255, 0.7)';
        zoomIcon.style.fontSize = '14px';
        zoomIcon.style.zIndex = '10';
        zoomIcon.style.background = 'rgba(0, 0, 0, 0.3)';
        zoomIcon.style.padding = '5px';
        zoomIcon.style.borderRadius = '4px';
        
        // 确保容器有相对定位，才能正确放置图标
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        
        container.appendChild(zoomIcon);
        
        // 点击事件
        container.addEventListener('click', function() {
            const chartId = this.id;
            const chartTitle = this.closest('.chart-container').querySelector('.chart-title').textContent;
            openZoomModal(chartId, chartTitle, chartsObj);
        });
    });
    
    // 为所有表格添加放大功能
    const dataTables = document.querySelectorAll('.data-table');
    dataTables.forEach(table => {
        // 获取表格所在容器
        const container = table.closest('.chart-body');
        container.style.cursor = 'pointer';
        
        // 添加小图标提示点击可放大
        const zoomIcon = document.createElement('div');
        zoomIcon.className = 'chart-zoom-icon';
        zoomIcon.innerHTML = '<i class="fas fa-search-plus"></i>';
        zoomIcon.style.position = 'absolute';
        zoomIcon.style.top = '10px';
        zoomIcon.style.right = '10px';
        zoomIcon.style.color = 'rgba(255, 255, 255, 0.7)';
        zoomIcon.style.fontSize = '14px';
        zoomIcon.style.zIndex = '10';
        zoomIcon.style.background = 'rgba(0, 0, 0, 0.3)';
        zoomIcon.style.padding = '5px';
        zoomIcon.style.borderRadius = '4px';
        
        // 确保容器有相对定位
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        
        container.appendChild(zoomIcon);
        
        // 点击事件
        container.addEventListener('click', function() {
            const tableTitle = this.closest('.chart-container').querySelector('.chart-title').textContent;
            openTableZoomModal(table, tableTitle);
        });
    });
    
    // 打开放大模态框 - 图表
    function openZoomModal(chartId, chartTitle, chartsObj) {
        console.log('打开放大模态框:', chartId);
        
        // 设置标题
        document.getElementById('chart-zoom-title').textContent = chartTitle;
        
        // 隐藏表格区域，显示图表区域
        document.getElementById('chart-zoom-table').style.display = 'none';
        document.getElementById('chart-zoom-chart').style.display = 'block';
        
        // 显示模态框
        const modal = document.getElementById('chart-zoom-modal');
        modal.style.display = 'flex';
        
        // 获取原图表实例
        let originalChart = null;
        for (const [key, chart] of Object.entries(chartsObj)) {
            if (chart && chart.getDom() && chart.getDom().id === chartId) {
                originalChart = chart;
                break;
            }
        }
        
        if (!originalChart) {
            console.error('找不到原图表实例:', chartId);
            return;
        }
        
        // 初始化放大图表
        const zoomChart = echarts.init(document.getElementById('chart-zoom-chart'));
        
        // 获取原图表的配置并应用
        const option = originalChart.getOption();
        // 可以在这里对option进行修改，例如增大字体大小等
        if (option.title) {
            option.title.show = false; // 隐藏标题，因为已经有了模态框标题
        }
        if (option.grid) {
            option.grid.left = '5%';
            option.grid.right = '5%';
            option.grid.top = '5%';
            option.grid.bottom = '10%';
        }
        if (option.legend) {
            option.legend.textStyle = option.legend.textStyle || {};
            option.legend.textStyle.fontSize = 14;
        }
        if (option.xAxis) {
            if (Array.isArray(option.xAxis)) {
                option.xAxis.forEach(axis => {
                    axis.axisLabel = axis.axisLabel || {};
                    axis.axisLabel.fontSize = 14;
                });
            } else {
                option.xAxis.axisLabel = option.xAxis.axisLabel || {};
                option.xAxis.axisLabel.fontSize = 14;
            }
        }
        if (option.yAxis) {
            if (Array.isArray(option.yAxis)) {
                option.yAxis.forEach(axis => {
                    axis.axisLabel = axis.axisLabel || {};
                    axis.axisLabel.fontSize = 14;
                });
            } else {
                option.yAxis.axisLabel = option.yAxis.axisLabel || {};
                option.yAxis.axisLabel.fontSize = 14;
            }
        }
        
        zoomChart.setOption(option);
        
        // 添加窗口调整时重设图表大小
        const resizeHandler = function() {
            zoomChart.resize();
        };
        window.addEventListener('resize', resizeHandler);
        
        // 点击模态框背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeZoomModal();
                window.removeEventListener('resize', resizeHandler);
            }
        });
    }
    
    // 打开放大模态框 - 表格
    function openTableZoomModal(table, tableTitle) {
        console.log('打开表格放大模态框:', tableTitle);
        
        // 设置标题
        document.getElementById('chart-zoom-title').textContent = tableTitle;
        
        // 隐藏图表区域，显示表格区域
        document.getElementById('chart-zoom-chart').style.display = 'none';
        const tableContainer = document.getElementById('chart-zoom-table');
        tableContainer.style.display = 'block';
        
        // 复制表格到模态框
        tableContainer.innerHTML = '';
        const clonedTable = table.cloneNode(true);
        clonedTable.style.width = '100%';
        clonedTable.style.borderCollapse = 'collapse';
        clonedTable.style.color = '#eee';
        clonedTable.style.fontSize = '16px';
        
        // 设置表格单元格样式
        const cells = clonedTable.querySelectorAll('th, td');
        cells.forEach(cell => {
            cell.style.border = '1px solid rgba(64, 174, 255, 0.3)';
            cell.style.padding = '10px';
            cell.style.textAlign = 'center';
        });
        
        // 设置表头样式
        const headers = clonedTable.querySelectorAll('th');
        headers.forEach(header => {
            header.style.backgroundColor = 'rgba(64, 174, 255, 0.2)';
            header.style.fontWeight = 'bold';
            header.style.color = '#40aeff';
        });
        
        // 设置奇偶行样式
        const rows = clonedTable.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            if (index % 2 === 0) {
                row.style.backgroundColor = 'rgba(12, 30, 57, 0.9)';
            } else {
                row.style.backgroundColor = 'rgba(12, 25, 47, 0.9)';
            }
        });
        
        tableContainer.appendChild(clonedTable);
        
        // 显示模态框
        const modal = document.getElementById('chart-zoom-modal');
        modal.style.display = 'flex';
        
        // 点击模态框背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeZoomModal();
            }
        });
    }
    
    // 关闭放大模态框
    function closeZoomModal() {
        const modal = document.getElementById('chart-zoom-modal');
        modal.style.display = 'none';
        
        // 销毁图表实例释放内存
        const chartContainer = document.getElementById('chart-zoom-chart');
        if (chartContainer.style.display !== 'none') {
            const zoomChart = echarts.getInstanceByDom(chartContainer);
            if (zoomChart) {
                zoomChart.dispose();
            }
        }
    }
    
    // 添加样式到文档
    const style = document.createElement('style');
    style.textContent = `
        .chart-container .chart:hover .chart-zoom-icon,
        .chart-container .chart-body:hover .chart-zoom-icon {
            color: rgba(0, 229, 255, 0.9);
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .chart-zoom-modal.active .chart-zoom-icon {
            animation: pulse 1.5s infinite;
        }
        
        /* 表格样式 */
        #chart-zoom-table {
            scrollbar-width: thin;
            scrollbar-color: rgba(64, 174, 255, 0.5) rgba(12, 20, 38, 0.3);
        }
        
        #chart-zoom-table::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }
        
        #chart-zoom-table::-webkit-scrollbar-track {
            background: rgba(12, 20, 38, 0.3);
            border-radius: 5px;
        }
        
        #chart-zoom-table::-webkit-scrollbar-thumb {
            background: rgba(64, 174, 255, 0.5);
            border-radius: 5px;
        }
        
        #chart-zoom-table::-webkit-scrollbar-thumb:hover {
            background: rgba(64, 174, 255, 0.7);
        }
    `;
    document.head.appendChild(style);
} 