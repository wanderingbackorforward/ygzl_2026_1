/**
 * 主应用程序
 */
class App {
    constructor() {
        this.isInitialized = false;
        this.currentTab = 'data';
        this.mockData = null; // 模拟数据，用于演示

        // 初始化
        this.init();
    }

    /**
     * 初始化应用程序
     */
    async init() {
        try {
            console.log('正在初始化应用程序...');

            // 等待DOM加载完成
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
            } else {
                this.onDOMReady();
            }

        } catch (error) {
            console.error('应用程序初始化失败:', error);
            this.showError('应用程序初始化失败');
        }
    }

    /**
     * DOM加载完成后的初始化
     */
    async onDOMReady() {
        try {
            // 绑定UI事件
            this.bindEvents();

            // 初始化组件
            await this.initComponents();

            // 检查服务器状态
            await this.checkServerStatus();

            // 绑定轨迹管理器事件
            this.bindTrajectoryEvents();

            this.isInitialized = true;
            console.log('应用程序初始化完成');

        } catch (error) {
            console.error('DOM初始化失败:', error);
            this.showError('DOM初始化失败');
        }
    }

    /**
     * 绑定UI事件
     */
    bindEvents() {
        // 计算按钮
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.onCalculateTrajectory();
        });

        // 数据导入按钮
        document.getElementById('importBtn').addEventListener('click', () => {
            this.onImportData();
        });

        // 加载示例数据按钮
        document.getElementById('loadSampleBtn').addEventListener('click', () => {
            this.onLoadSampleData();
        });

        // 使用数据按钮
        document.getElementById('useDataBtn').addEventListener('click', () => {
            this.onUseSelectedData();
        });

        // 文件选择变化事件
        document.getElementById('fileInput').addEventListener('change', () => {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];

            if (file) {
                const fileLabel = document.querySelector('.file-text');
                fileLabel.textContent = file.name;
            }
        });

        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 分页控件
        document.getElementById('prev-page').addEventListener('click', () => {
            window.trajectoryManager.prevPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            window.trajectoryManager.nextPage();
        });

        document.getElementById('page-input').addEventListener('change', (e) => {
            const page = parseInt(e.target.value);
            if (!isNaN(page)) {
                window.trajectoryManager.goToPage(page);
            }
        });

        // 图表切换控件
        document.getElementById('prev-image').addEventListener('click', () => {
            window.trajectoryManager.prevChart();
        });

        document.getElementById('next-image').addEventListener('click', () => {
            window.trajectoryManager.nextChart();
        });

        // 轨迹播放控件
        document.getElementById('progress-bar').addEventListener('input', (e) => {
            window.trajectoryManager.setCurrentPointIndex(parseInt(e.target.value));
        });

        document.getElementById('start-playback').addEventListener('click', () => {
            window.trajectoryManager.startPlayback();
        });

        document.getElementById('stop-playback').addEventListener('click', () => {
            window.trajectoryManager.stopPlayback();
        });

        document.getElementById('reset-to-start').addEventListener('click', () => {
            window.trajectoryManager.resetToStart();
        });

        document.getElementById('play-step').addEventListener('change', (e) => {
            window.trajectoryManager.playStep = parseInt(e.target.value) || 1;
        });

        document.getElementById('frame-interval').addEventListener('change', (e) => {
            window.trajectoryManager.frameInterval = parseInt(e.target.value) || 500;
        });

        // 提示消息关闭按钮
        document.getElementById('close-error').addEventListener('click', () => {
            this.hideToast('error-toast');
        });

        document.getElementById('close-success').addEventListener('click', () => {
            this.hideToast('success-toast');
        });
    }

    /**
     * 初始化组件
     */
    async initComponents() {
        // 初始化地图
        if (window.mapManager) {
            await window.mapManager.init();
        }

        // 初始化剖面图渲染器
        if (window.profileRenderer) {
            await window.profileRenderer.init();
        }
    }

    /**
     * 检查服务器状态
     */
    async checkServerStatus() {
        try {
            if (window.apiManager) {
                const status = await window.apiManager.getStatus();
                console.log('服务器状态:', status);
            }
        } catch (error) {
            console.warn('无法连接到服务器:', error);
            // 这里可以显示一个警告，但不阻止应用运行
        }
    }

    /**
     * 绑定轨迹管理器事件
     */
    bindTrajectoryEvents() {
        if (!window.trajectoryManager) {
            return;
        }

        // 数据变化事件
        window.trajectoryManager.on('dataChanged', (data) => {
            this.onDataChanged(data);
        });

        // 当前点变化事件
        window.trajectoryManager.on('currentPointChanged', (index) => {
            this.onCurrentPointChanged(index);
        });

        // 播放状态事件
        window.trajectoryManager.on('playbackStarted', () => {
            this.onPlaybackStarted();
        });

        window.trajectoryManager.on('playbackStopped', () => {
            this.onPlaybackStopped();
        });

        // 分页事件
        window.trajectoryManager.on('pageChanged', (page) => {
            this.onPageChanged(page);
        });

        window.trajectoryManager.on('paginationChanged', (pagination) => {
            this.onPaginationChanged(pagination);
        });

        // 图表事件
        window.trajectoryManager.on('chartImagesChanged', (images) => {
            this.onChartImagesChanged(images);
        });

        window.trajectoryManager.on('currentChartChanged', (index) => {
            this.onCurrentChartChanged(index);
        });
    }

    /**
     * 切换标签页
     * @param {string} tabName - 标签页名称
     */
    switchTab(tabName) {
        if (this.currentTab === tabName) {
            return;
        }

        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 更新标签内容
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;

        // 特殊处理物理轨迹标签页
        if (tabName === 'physical') {
            this.onPhysicalTabActivated();
        }
    }

    /**
     * 物理轨迹标签页激活时的处理
     */
    async onPhysicalTabActivated() {
        // 确保地图已初始化
        if (window.mapManager && !window.mapManager.isInitialized) {
            await window.mapManager.init();
        }

        // 如果有数据，更新显示
        const status = window.trajectoryManager.getStatus();
        if (status.hasData) {
            this.updatePhysicalDisplay();
        }
    }

    /**
     * 计算轨迹
     */
    async onCalculateTrajectory() {
        try {
            const maxPoints = parseInt(document.getElementById('maxPoints').value) || 10000;

            // 获取当前选择的输入数据
            const inputData = this.getCurrentInputData();
            if (!inputData || inputData.length === 0) {
                this.showError('请先导入数据或加载示例数据');
                return;
            }

            this.showLoading(true);

            // 准备请求数据
            const requestData = {
                type: 'trace',
                last_num: maxPoints,
                data: inputData
            };

            // 调用API
            const response = await window.apiManager.calculateTrajectory(requestData);

            if (response.success) {
                // 处理响应数据
                this.handleTrajectoryResponse(response.data);
                this.showSuccess('轨迹计算完成');
            } else {
                throw new Error(response.error || '计算失败');
            }

        } catch (error) {
            console.error('轨迹计算失败:', error);
            this.showError('轨迹计算失败: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 获取当前选择的输入数据
     */
    getCurrentInputData() {
        // 优先使用导入的数据
        const inputData = window.trajectoryManager.getCurrentInputData();
        if (inputData && inputData.isImported && inputData.data && inputData.data.length > 0) {
            return inputData.data;
        }

        // 如果没有导入的数据，使用模拟数据
        return this.getMockInputData();
    }

    /**
     * 导入数据文件
     */
    async onImportData() {
        try {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];

            if (!file) {
                this.showError('请选择要导入的文件');
                return;
            }

            // 检查文件类型
            const allowedTypes = ['csv', 'xlsx', 'xls', 'json'];
            const fileExtension = file.name.split('.').pop().toLowerCase();

            if (!allowedTypes.includes(fileExtension)) {
                this.showError('不支持的文件类型，请选择CSV、Excel或JSON文件');
                return;
            }

            this.showImportStatus('正在导入数据...', 'info');

            // 调用API导入数据
            const response = await window.apiManager.importData(file);

            if (response.success) {
                this.showImportStatus(`导入成功！共导入 ${response.record_count} 条记录`, 'success');

                // 显示文件信息
                this.showFileInfo(file, response.record_count);

                // 更新数据列表
                await this.updateDataList();

                // 预览数据
                if (response.preview && response.preview.length > 0) {
                    this.showDataPreview(response.preview);
                }
            } else {
                throw new Error(response.error || '导入失败');
            }

        } catch (error) {
            console.error('数据导入失败:', error);
            this.showImportStatus('数据导入失败: ' + error.message, 'error');
        }
    }

    /**
     * 加载示例数据
     */
    async onLoadSampleData() {
        try {
            this.showImportStatus('正在加载示例数据...', 'info');

            // 使用正确的文件名（带imported_data_前缀）
            const sampleFile = 'imported_data_medium_trajectory.json';

            // 调用API加载数据
            const response = await window.apiManager.loadData(sampleFile);

            if (response.success) {
                // 保存数据到轨迹管理器 - 传递完整的响应对象
                window.trajectoryManager.setImportedData({
                    data: response.data,
                    filename: sampleFile,
                    record_count: response.record_count
                });

                this.showImportStatus(`示例数据加载成功！共 ${response.record_count} 条记录`, 'success');

                // 更新数据列表
                await this.updateDataList();

                // 预览数据
                if (response.data && response.data.length > 0) {
                    this.showDataPreview(response.data.slice(0, 5));
                }
            } else {
                throw new Error(response.error || '加载失败');
            }

        } catch (error) {
            console.error('加载示例数据失败:', error);
            this.showImportStatus('加载示例数据失败: ' + error.message, 'error');
        }
    }

    /**
     * 使用选中的数据
     */
    async onUseSelectedData() {
        try {
            const dataSelect = document.getElementById('dataSelect');
            const filename = dataSelect.value;

            if (!filename) {
                this.showError('请选择要使用的数据');
                return;
            }

            this.showImportStatus('正在加载数据...', 'info');

            // 调用API加载数据
            const response = await window.apiManager.loadData(filename);

            if (response.success) {
                // 保存数据到轨迹管理器 - 传递完整的响应对象
                window.trajectoryManager.setImportedData({
                    data: response.data,
                    filename: filename,
                    record_count: response.record_count
                });

                this.showImportStatus(`数据加载成功！共 ${response.record_count} 条记录`, 'success');

                // 预览数据
                if (response.data && response.data.length > 0) {
                    this.showDataPreview(response.data.slice(0, 5));
                }
            } else {
                throw new Error(response.error || '加载失败');
            }

        } catch (error) {
            console.error('加载数据失败:', error);
            this.showImportStatus('加载数据失败: ' + error.message, 'error');
        }
    }

    /**
     * 更新数据列表
     */
    async updateDataList() {
        try {
            const response = await window.apiManager.getDataList();

            if (response.success && response.files.length > 0) {
                const dataSelect = document.getElementById('dataSelect');
                const dataListContainer = document.getElementById('importedDataList');

                // 清空现有选项
                dataSelect.innerHTML = '<option value="">请选择数据</option>';

                // 添加文件选项
                response.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.filename;
                    option.textContent = `${file.filename} (${file.record_count} 条记录)`;
                    dataSelect.appendChild(option);
                });

                // 显示数据列表
                dataListContainer.classList.remove('hidden');

            } else {
                // 隐藏数据列表
                const dataListContainer = document.getElementById('importedDataList');
                dataListContainer.classList.add('hidden');
            }

        } catch (error) {
            console.error('更新数据列表失败:', error);
        }
    }

    /**
     * 显示导入状态
     */
    showImportStatus(message, type = 'info') {
        let statusElement = document.querySelector('.import-status');

        if (!statusElement) {
            const importSection = document.querySelector('.import-section');
            statusElement = document.createElement('div');
            statusElement.className = 'import-status';
            importSection.appendChild(statusElement);
        }

        statusElement.className = `import-status ${type}`;
        statusElement.textContent = message;
        statusElement.style.display = 'block';

        // 3秒后自动隐藏
        setTimeout(() => {
            if (statusElement) {
                statusElement.style.display = 'none';
            }
        }, 5000);
    }

    /**
     * 显示文件信息
     */
    showFileInfo(file, recordCount) {
        let infoElement = document.querySelector('.file-info');

        if (!infoElement) {
            const importSection = document.querySelector('.import-section');
            infoElement = document.createElement('div');
            infoElement.className = 'file-info';
            importSection.appendChild(infoElement);
        }

        const fileSize = (file.size / 1024).toFixed(2);
        infoElement.innerHTML = `
            <strong>文件信息：</strong> ${file.name} |
            大小: ${fileSize} KB |
            记录数: ${recordCount} |
            类型: ${file.name.split('.').pop().toUpperCase()}
        `;
        infoElement.style.display = 'block';
    }

    /**
     * 显示数据预览
     */
    showDataPreview(data) {
        // 清除现有的预览表格
        const existingTable = document.querySelector('.preview-table');
        if (existingTable) {
            existingTable.parentElement.remove();
        }

        const existingContainer = document.querySelector('.preview-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        if (!data || data.length === 0) {
            return;
        }

        const importSection = document.querySelector('.import-section');
        const previewContainer = document.createElement('div');
        previewContainer.className = 'preview-container';

        const table = document.createElement('table');
        table.className = 'preview-table';

        // 创建表头 - 显示所有23个字段
        const headers = [
            '推进油缸总推力', '刀盘扭矩', '刀盘转速', '切口水压',
            '送泥流量F1', '排泥流量F2', '贯入度', '推进平均速度',
            '推进区间的压力（下）', '推进区间的压力（上）', '推进区间的压力（右上）', '推进区间的压力（右下）',
            '推进区间的压力（左下）', '推进区间的压力（左上）',
            '盾尾垂直偏差', '盾尾水平偏差', '盾头垂直偏差', '盾头水平偏差',
            '盾头坐标N', '盾头坐标E', '盾头坐标Z',
            '经度', '纬度'
        ];

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.style.fontSize = '12px';
            th.style.padding = '4px 6px';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // 创建表格内容
        const tbody = document.createElement('tbody');
        data.forEach((row, index) => {
            if (index >= 5) return; // 只显示前5条

            const tr = document.createElement('tr');

            // 确保数据是数组格式
            let rowData = row;
            if (Array.isArray(row)) {
                rowData = row;
            } else if (typeof row === 'object' && row !== null) {
                // 如果是对象，转换为数组
                rowData = headers.map(header => row[header] || '');
            } else {
                console.warn('无效的行数据格式:', row);
                return;
            }

            // 显示所有字段
            for (let i = 0; i < 23; i++) {
                const td = document.createElement('td');
                const value = rowData[i];

                if (typeof value === 'number' && !isNaN(value)) {
                    td.textContent = value.toFixed(2);
                } else {
                    td.textContent = value || '';
                }
                td.style.fontSize = '11px';
                td.style.padding = '3px 6px';
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        previewContainer.appendChild(table);

        // 添加预览标题
        const previewTitle = document.createElement('div');
        previewTitle.style.marginBottom = '10px';
        previewTitle.style.fontWeight = 'bold';
        previewTitle.innerHTML = `数据预览（前${Math.min(data.length, 5)}条记录）：`;
        previewContainer.insertBefore(previewTitle, table);

        importSection.appendChild(previewContainer);
        console.log('数据预览已更新，预览数据行数:', data.length);
    }

    /**
     * 处理轨迹响应数据
     * @param {Object} data - 响应数据
     */
    handleTrajectoryResponse(data) {
        // 设置轨迹数据
        if (data.all_data_arr) {
            window.trajectoryManager.setTrajectoryData(data.all_data_arr);
        }

        // 设置图表图片
        const chartImages = [];
        if (data.dsh_pic_url) {
            chartImages.push({
                src: window.apiManager.getImageUrl(data.dsh_pic_url),
                title: '盾头偏移轨迹'
            });
        }
        if (data.map_pic_url) {
            chartImages.push({
                src: window.apiManager.getImageUrl(data.map_pic_url),
                title: '地图盾构位置轨迹'
            });
        }
        window.trajectoryManager.setChartImages(chartImages);

        // 切换到数据标签页
        this.switchTab('data');
    }

    /**
     * 获取模拟输入数据（用于演示）
     */
    getMockInputData() {
        // 生成一些模拟数据用于演示
        const mockData = [];
        const numPoints = 100;

        for (let i = 0; i < numPoints; i++) {
            const row = [];
            // 生成21维数据
            for (let j = 0; j < 21; j++) {
                row.push((Math.random() * 1000).toFixed(2));
            }
            // 添加经纬度坐标（模拟北京地区的坐标）
            const baseLng = 116.404 + (Math.random() - 0.5) * 0.01;
            const baseLat = 39.915 + (Math.random() - 0.5) * 0.01;
            row.push(baseLng.toFixed(6)); // 经度
            row.push(baseLat.toFixed(6)); // 纬度

            mockData.push(row);
        }

        return mockData;
    }

    /**
     * 数据变化事件处理
     * @param {Array} data - 轨迹数据
     */
    onDataChanged(data) {
        this.updateDataDisplay();
        this.updatePhysicalDisplay();
    }

    /**
     * 当前点变化事件处理
     * @param {number} index - 当前点索引
     */
    onCurrentPointChanged(index) {
        this.updatePhysicalDisplay();
        this.updateProgressDisplay();
    }

    /**
     * 播放开始事件处理
     */
    onPlaybackStarted() {
        document.getElementById('start-playback').disabled = true;
        document.getElementById('stop-playback').disabled = false;
    }

    /**
     * 播放停止事件处理
     */
    onPlaybackStopped() {
        document.getElementById('start-playback').disabled = false;
        document.getElementById('stop-playback').disabled = true;
    }

    /**
     * 页面变化事件处理
     * @param {number} page - 页码
     */
    onPageChanged(page) {
        this.updateDataDisplay();
    }

    /**
     * 分页信息变化事件处理
     * @param {Object} pagination - 分页信息
     */
    onPaginationChanged(pagination) {
        document.getElementById('total-pages').textContent = pagination.totalPages;
        document.getElementById('total-records').textContent = pagination.totalRecords;
        document.getElementById('page-input').value = pagination.currentPage;

        // 更新分页按钮状态
        document.getElementById('prev-page').disabled = pagination.currentPage <= 1;
        document.getElementById('next-page').disabled = pagination.currentPage >= pagination.totalPages;
    }

    /**
     * 图表图片变化事件处理
     * @param {Array} images - 图片数组
     */
    onChartImagesChanged(images) {
        this.updateChartDisplay();
    }

    /**
     * 当前图表变化事件处理
     * @param {number} index - 图表索引
     */
    onCurrentChartChanged(index) {
        this.updateChartDisplay();
    }

    /**
     * 更新数据显示
     */
    updateDataDisplay() {
        const status = window.trajectoryManager.getStatus();

        if (!status.hasData) {
            // 显示空状态
            document.getElementById('data-content').classList.add('hidden');
            document.getElementById('empty-data').classList.remove('hidden');
            return;
        }

        // 显示数据内容
        document.getElementById('data-content').classList.remove('hidden');
        document.getElementById('empty-data').classList.add('hidden');

        // 更新表格
        this.updateTable();

        // 更新分页
        this.updatePagination();
    }

    /**
     * 更新表格
     */
    updateTable() {
        const tableHeader = document.getElementById('table-header');
        const tableBody = document.getElementById('table-body');
        const currentData = window.trajectoryManager.getCurrentPageData();

        // 清空表格
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';

        if (currentData.length === 0) {
            return;
        }

        // 创建表头
        const headerRow = document.createElement('tr');
        window.trajectoryManager.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headerRow.appendChild(th);
        });
        tableHeader.appendChild(headerRow);

        // 创建表格内容
        currentData.forEach(row => {
            const tr = document.createElement('tr');
            window.trajectoryManager.columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = row[col] || '';
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
    }

    /**
     * 更新分页显示
     */
    updatePagination() {
        const status = window.trajectoryManager.getStatus();

        // 显示分页控件
        if (status.totalPages > 1) {
            document.getElementById('pagination').classList.remove('hidden');
        } else {
            document.getElementById('pagination').classList.add('hidden');
        }

        // 更新页面输入框
        document.getElementById('page-input').value = status.currentPage;
    }

    /**
     * 更新图表显示
     */
    updateChartDisplay() {
        const status = window.trajectoryManager.getStatus();

        if (!status.hasData || status.chartImagesCount === 0) {
            // 显示空状态
            document.getElementById('chart-content').classList.add('hidden');
            document.getElementById('empty-chart').classList.remove('hidden');
            return;
        }

        // 显示图表内容
        document.getElementById('chart-content').classList.remove('hidden');
        document.getElementById('empty-chart').classList.add('hidden');

        const currentImage = window.trajectoryManager.getCurrentChartImage();
        if (currentImage) {
            document.getElementById('chart-image').src = currentImage.src;
            document.getElementById('chart-image').alt = currentImage.title;
            document.getElementById('chart-image').classList.remove('hidden');
            document.getElementById('image-title').textContent = currentImage.title;
        }

        // 更新图片计数器
        document.getElementById('image-counter').textContent =
            `${status.currentChartIndex + 1} / ${status.chartImagesCount}`;

        // 更新按钮状态
        document.getElementById('prev-image').disabled = status.currentChartIndex <= 0;
        document.getElementById('next-image').disabled =
            status.currentChartIndex >= status.chartImagesCount - 1;
    }

    /**
     * 更新物理轨迹显示
     */
    updatePhysicalDisplay() {
        const status = window.trajectoryManager.getStatus();

        if (!status.hasData) {
            // 显示空状态
            document.getElementById('physical-content').classList.add('hidden');
            document.getElementById('empty-physical').classList.remove('hidden');
            return;
        }

        // 显示物理轨迹内容
        document.getElementById('physical-content').classList.remove('hidden');
        document.getElementById('empty-physical').classList.add('hidden');

        // 更新地图显示
        if (window.mapManager && window.mapManager.isInitialized) {
            window.mapManager.drawTrajectory(window.trajectoryManager.trajectoryData, status.currentPointIndex);
        }

        // 更新剖面图显示
        if (window.profileRenderer && window.profileRenderer.isInitialized) {
            window.profileRenderer.renderTrajectory(window.trajectoryManager.trajectoryData, status.currentPointIndex);
        }

        // 更新进度条
        this.updateProgressDisplay();
    }

    /**
     * 更新进度显示
     */
    updateProgressDisplay() {
        const status = window.trajectoryManager.getStatus();
        const currentPoint = window.trajectoryManager.getCurrentPoint();

        // 更新进度条
        const progressBar = document.getElementById('progress-bar');
        progressBar.min = 0;
        progressBar.max = status.maxPoints;
        progressBar.value = status.currentPointIndex;

        // 更新当前点信息
        document.getElementById('current-point').textContent = status.currentPointIndex + 1;
        document.getElementById('max-point').textContent = status.maxPoints + 1;

        // 更新坐标显示
        if (currentPoint) {
            const lng = parseFloat(currentPoint.经度 || currentPoint.longitude || 0);
            const lat = parseFloat(currentPoint.纬度 || currentPoint.latitude || 0);
            document.getElementById('coordinates').textContent =
                `坐标: (${lng.toFixed(6)}, ${lat.toFixed(6)})`;
        } else {
            document.getElementById('coordinates').textContent = '坐标: (0, 0)';
        }

        // 更新进度条标签
        const progressLabels = document.querySelector('.progress-labels');
        if (progressLabels) {
            progressLabels.innerHTML = `
                <span>起点 (0)</span>
                <span>终点 (${status.maxPoints})</span>
            `;
        }
    }

    /**
     * 显示/隐藏加载状态
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        const loadingIndicators = [
            'loading-indicator',
            'chart-loading',
            'physical-loading'
        ];

        loadingIndicators.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.toggle('hidden', !show);
            }
        });

        // 禁用计算按钮
        document.getElementById('calculateBtn').disabled = show;
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        this.showToast('error-toast', 'error-message', message);
    }

    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     */
    showSuccess(message) {
        this.showToast('success-toast', 'success-message', message);
    }

    /**
     * 显示提示消息
     * @param {string} toastId - 提示框ID
     * @param {string} messageId - 消息元素ID
     * @param {string} message - 消息内容
     */
    showToast(toastId, messageId, message) {
        const toast = document.getElementById(toastId);
        const messageElement = document.getElementById(messageId);

        if (toast && messageElement) {
            messageElement.textContent = message;
            toast.classList.remove('hidden');

            // 自动隐藏
            setTimeout(() => {
                this.hideToast(toastId);
            }, 5000);
        }
    }

    /**
     * 隐藏提示消息
     * @param {string} toastId - 提示框ID
     */
    hideToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('hidden');
        }
    }
}

// 启动应用程序
window.app = new App();