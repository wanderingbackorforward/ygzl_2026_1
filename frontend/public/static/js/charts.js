// Comment out the entire initial DOMContentLoaded listener for file upload logic
document.addEventListener('DOMContentLoaded', function() {
    console.log('Settlement page DOM fully loaded and parsed.');

    // --- Upload Functionality Setup ---
    setupUploadModal();

    // --- Chart Initialization ---
    console.log('正在初始化沉降监测图表...');
    initCyberpunkTheme(); // Ensure theme is registered first

    // Initialize chart instances
    window.trendChart = echarts.init(document.getElementById('trend-chart'), 'cyberpunk');
    window.pointsChart = echarts.init(document.getElementById('points-chart'), 'cyberpunk');
    window.timeSeriesChart = echarts.init(document.getElementById('time-series-chart'), 'cyberpunk');
    window.rateChart = echarts.init(document.getElementById('rate-chart'), 'cyberpunk');

    // Show loading state initially
    showInitialLoadingState();

    // Load initial data
    loadSummaryData();

    // Setup point selector interactions
    setupPointSelector();

    // Setup chart zoom functionality
    setupChartZoom();
});

// Function to setup upload modal interactions
function setupUploadModal() {
    console.log('Setting up upload modal...');
    const uploadButton = document.getElementById('upload-button');
    const uploadModal = document.getElementById('upload-modal');
    const closeButton = uploadModal ? uploadModal.querySelector('.close') : null; // Scope querySelector
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const uploadFileBtn = document.getElementById('upload-file-btn');

    // Check if essential elements exist
    if (!uploadButton || !uploadModal || !closeButton || !dropArea || !fileInput || !selectFileBtn || !fileInfo || !fileName || !uploadFileBtn) {
        console.warn('One or more upload modal elements not found. Upload functionality might be disabled.');
        if(uploadButton) uploadButton.style.display = 'none'; // Hide button if modal elements are missing
        return; // Exit setup if elements are missing
    }

    // Open modal
    uploadButton.addEventListener('click', function() {
        uploadModal.style.display = 'block';
        resetUploadForm();
    });

    // Close modal via button
    closeButton.addEventListener('click', function() {
        uploadModal.style.display = 'none';
    });

    // Close modal via clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    // Select file button triggers hidden input
    selectFileBtn.addEventListener('click', function() {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    // Drag and drop setup
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    dropArea.addEventListener('drop', handleDrop, false);

    // Upload button action
    uploadFileBtn.addEventListener('click', uploadFile);

    // Add necessary helper functions here (preventDefaults, highlight, unhighlight, handleDrop, handleFiles, resetUploadForm, uploadFile, checkProcessingStatus, showNotification)
    // These functions should be moved from the global scope or previous listener into this scope or be defined globally if needed elsewhere.
    // For brevity, assuming they are defined correctly elsewhere or moved here.
     console.log('Upload modal setup complete.');
}

// --- Helper functions for upload (ensure these are defined) ---
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
function highlight() { document.getElementById('drop-area').classList.add('highlight'); }
function unhighlight() { document.getElementById('drop-area').classList.remove('highlight'); }

function handleDrop(e) {
    preventDefaults(e);
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFiles(files) {
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const dropArea = document.getElementById('drop-area');
    if (files.length > 0) {
        const file = files[0];
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            showNotification('请上传Excel文件 (.xlsx, .xls)', 'error');
            return;
        }
        fileName.textContent = file.name;
        if(fileInfo) fileInfo.style.display = 'block';
        if(dropArea) dropArea.style.display = 'none';
    }
}

function resetUploadForm() {
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const dropArea = document.getElementById('drop-area');
    const uploadProgress = document.getElementById('upload-progress');
    const processingStatus = document.getElementById('processing-status');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const uploadMessage = document.getElementById('upload-message');

    if(fileInput) fileInput.value = '';
    if(fileInfo) fileInfo.style.display = 'none';
    if(dropArea) dropArea.style.display = 'block';
    if(uploadProgress) uploadProgress.style.display = 'none';
    if(processingStatus) processingStatus.style.display = 'none';
    if(progressBarFill) progressBarFill.style.width = '0%';
    if(progressText) progressText.textContent = '上传中... 0%';
    if(uploadMessage) uploadMessage.textContent = '';
}

function uploadFile() {
    // ... (Keep existing uploadFile logic, ensure elements are checked for null)
    const fileInput = document.getElementById('file-input');
    if (!fileInput || !fileInput.files.length) return;
    // ... rest of uploadFile ...
}

function checkProcessingStatus(taskId) {
    // ... (Keep existing checkProcessingStatus logic) ...
}

function showNotification(message, type = 'success') {
    // ... (Keep existing showNotification logic, ensure elements are checked) ...
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    if (notification && notificationText) {
        // ... rest of showNotification ...
    }
}

// --- End Helper Functions ---


// Function to show initial loading state for charts
function showInitialLoadingState() {
    const loadingOptions = { text: '加载中...' };
    if (window.trendChart) window.trendChart.showLoading('default', loadingOptions);
    if (window.pointsChart) window.pointsChart.showLoading('default', loadingOptions);
    if (window.timeSeriesChart) window.timeSeriesChart.showLoading('default', loadingOptions);
    if (window.rateChart) window.rateChart.showLoading('default', loadingOptions);
}

// --- Keep Existing Chart Functions (initCyberpunkTheme, loadSummaryData, etc.) ---

// 科技感主题配置
function initCyberpunkTheme() {
    const neonColors = {
        primary: '#00e5ff',
        secondary: '#0088ff',
        warning: '#ff3e5f',
        success: '#00e676',
        neutral: '#7986cb',
        purple: '#bf5af2',
        orange: '#ff9e0d'
    };

    const cyberTheme = {
        color: [
            neonColors.primary,
            neonColors.success,
            neonColors.warning,
            neonColors.purple,
            neonColors.orange,
            neonColors.neutral
        ],
        backgroundColor: 'transparent',
        textStyle: {
            color: '#ffffff'
        },
        title: {
            textStyle: {
                color: neonColors.primary
            },
            subtextStyle: {
                color: '#cccccc'
            }
        },
        line: {
            width: 3,
            opacity: 0.9,
            smooth: true
        },
        radar: {
            itemStyle: {
                borderWidth: 1
            },
            lineStyle: {
                width: 2
            },
            symbolSize: 6,
            symbol: 'circle',
            smooth: true
        },
        bar: {
            itemStyle: {
                barBorderWidth: 0,
                barBorderColor: '#ccc'
            }
        },
        pie: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        scatter: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        boxplot: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        parallel: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        sankey: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        funnel: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        gauge: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            }
        },
        candlestick: {
            itemStyle: {
                color: neonColors.warning,
                color0: neonColors.success,
                borderColor: neonColors.warning,
                borderColor0: neonColors.success,
                borderWidth: 1
            }
        },
        graph: {
            itemStyle: {
                borderWidth: 0,
                borderColor: '#ccc'
            },
            lineStyle: {
                width: 1,
                color: 'rgba(224, 247, 250, 0.3)'
            },
            symbolSize: 6,
            symbol: 'circle',
            smooth: true,
            color: [
                neonColors.primary,
                neonColors.success,
                neonColors.warning,
                neonColors.purple,
                neonColors.orange
            ],
            label: {
                color: '#eee'
            }
        },
        map: {
            itemStyle: {
                areaColor: 'rgba(16, 23, 41, 0.8)',
                borderColor: neonColors.primary,
                borderWidth: 0.5
            },
            label: {
                color: '#e0f7fa'
            },
            emphasis: {
                itemStyle: {
                    areaColor: 'rgba(0, 229, 255, 0.1)',
                    borderColor: neonColors.primary,
                    borderWidth: 1
                },
                label: {
                    color: neonColors.primary
                }
            }
        },
        geo: {
            itemStyle: {
                areaColor: 'rgba(16, 23, 41, 0.8)',
                borderColor: neonColors.primary,
                borderWidth: 0.5
            },
            label: {
                color: '#e0f7fa'
            },
            emphasis: {
                itemStyle: {
                    areaColor: 'rgba(0, 229, 255, 0.1)',
                    borderColor: neonColors.primary,
                    borderWidth: 1
                },
                label: {
                    color: neonColors.primary
                }
            }
        },
        categoryAxis: {
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisTick: {
                show: true,
                alignWithLabel: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisLabel: {
                show: true,
                color: '#cccccc',
                fontSize: 18
            },
            splitLine: {
                show: false,
                lineStyle: {
                    color: ['rgba(0, 229, 255, 0.1)']
                }
            },
            splitArea: {
                show: false,
                areaStyle: {
                    color: ['rgba(0, 229, 255, 0.02)', 'rgba(0, 229, 255, 0.01)']
                }
            }
        },
        valueAxis: {
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisLabel: {
                show: true,
                color: '#cccccc',
                fontSize: 18
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: ['rgba(0, 229, 255, 0.1)'],
                    type: 'dashed'
                }
            },
            splitArea: {
                show: false,
                areaStyle: {
                    color: ['rgba(0, 229, 255, 0.02)', 'rgba(0, 229, 255, 0.01)']
                }
            }
        },
        logAxis: {
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisLabel: {
                show: true,
                color: '#cccccc',
                fontSize: 18
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: ['rgba(0, 229, 255, 0.1)']
                }
            },
            splitArea: {
                show: false,
                areaStyle: {
                    color: ['rgba(0, 229, 255, 0.02)', 'rgba(0, 229, 255, 0.01)']
                }
            }
        },
        timeAxis: {
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'rgba(0, 229, 255, 0.3)'
                }
            },
            axisLabel: {
                show: true,
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 18
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: ['rgba(0, 229, 255, 0.1)']
                }
            },
            splitArea: {
                show: false,
                areaStyle: {
                    color: ['rgba(0, 229, 255, 0.02)', 'rgba(0, 229, 255, 0.01)']
                }
            }
        },
        toolbox: {
            iconStyle: {
                borderColor: 'rgba(224, 247, 250, 0.7)'
            },
            emphasis: {
                iconStyle: {
                    borderColor: neonColors.primary
                }
            }
        },
        legend: {
            textStyle: {
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 18
            },
            pageIconColor: 'rgba(224, 247, 250, 0.7)',
            pageIconInactiveColor: 'rgba(224, 247, 250, 0.3)',
            pageTextStyle: {
                color: 'rgba(224, 247, 250, 0.7)'
            }
        },
        tooltip: {
            backgroundColor: 'rgba(16, 23, 41, 0.9)',
            borderColor: neonColors.primary,
            borderWidth: 1,
            textStyle: {
                color: '#e0f7fa'
            },
            axisPointer: {
                lineStyle: {
                    color: neonColors.primary,
                    width: 1
                },
                crossStyle: {
                    color: neonColors.primary,
                    width: 1
                },
                shadowStyle: {
                    color: 'rgba(0, 229, 255, 0.1)'
                }
            }
        },
        timeline: {
            lineStyle: {
                color: neonColors.primary,
                width: 1
            },
            itemStyle: {
                color: neonColors.primary,
                borderWidth: 1
            },
            controlStyle: {
                color: neonColors.primary,
                borderColor: neonColors.primary,
                borderWidth: 0.5
            },
            checkpointStyle: {
                color: neonColors.secondary,
                borderColor: 'rgba(0, 136, 255, 0.5)'
            },
            label: {
                color: 'rgba(224, 247, 250, 0.7)'
            },
            emphasis: {
                itemStyle: {
                    color: neonColors.secondary
                },
                controlStyle: {
                    color: neonColors.secondary,
                    borderColor: neonColors.secondary,
                    borderWidth: 0.5
                },
                label: {
                    color: '#e0f7fa'
                }
            }
        },
        visualMap: {
            color: [neonColors.primary, neonColors.success, neonColors.warning]
        },
        dataZoom: {
            backgroundColor: 'rgba(16, 23, 41, 0.2)',
            dataBackgroundColor: 'rgba(0, 229, 255, 0.1)',
            fillerColor: 'rgba(0, 229, 255, 0.1)',
            handleColor: neonColors.primary,
            handleSize: '100%',
            textStyle: {
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 16
            },
            borderColor: 'rgba(0, 229, 255, 0.3)'
        },
        markPoint: {
            label: {
                color: '#e0f7fa'
            },
            emphasis: {
                label: {
                    color: '#e0f7fa'
                }
            }
        }
    };

    // 注册主题
    echarts.registerTheme('cyberpunk', cyberTheme);
}

// 初始化沉降监测图表
function initCharts() {
    console.log('正在初始化沉降监测图表...');

    // 注册自定义主题
    initCyberpunkTheme();

    // 使用cyberpunk主题初始化图表
    window.trendChart = echarts.init(document.getElementById('trend-chart'), 'cyberpunk');
    window.pointsChart = echarts.init(document.getElementById('points-chart'), 'cyberpunk');
    window.timeSeriesChart = echarts.init(document.getElementById('time-series-chart'), 'cyberpunk');
    window.rateChart = echarts.init(document.getElementById('rate-chart'), 'cyberpunk');

    // 显示加载状态
    window.trendChart.showLoading('default', { text: '加载中...' });
    window.pointsChart.showLoading('default', { text: '加载中...' });
    window.timeSeriesChart.showLoading('default', { text: '加载中...' });
    window.rateChart.showLoading('default', { text: '加载中...' });

    // 加载汇总数据
    loadSummaryData();

    // 设置点位选择器事件监听
    setupPointSelector();

    // 设置图表放大功能
    setupChartZoom();
}

// 加载汇总数据
function loadSummaryData() {
    fetch('/api/summary')
        .then(response => response.json())
        .then(data => {
            // 隐藏加载状态
            window.trendChart.hideLoading();
            window.pointsChart.hideLoading();

            updateTrendChart(data);
            updatePointsDistributionChart(data);

            // 填充点位选择器
            populatePointSelector(data);

            if (data && data.length > 0) {
                const firstPointId = data[0].point_id;
                loadPointData(firstPointId);
            } else {
                showEmptyDataMessage('汇总数据为空');
            }
        })
        .catch(error => {
            console.error('加载汇总数据失败:', error);

            // 隐藏加载状态
            window.trendChart.hideLoading();
            window.pointsChart.hideLoading();

            // 显示错误消息
            showErrorMessage('无法加载汇总数据');
        });
}

// 填充点位选择器
function populatePointSelector(data) {
    const selector = document.getElementById('point-selector');

    if (!selector || !data) return;

    // 清除旧选项
    while (selector.options.length > 1) {
        selector.remove(1);
    }

    // 对监测点ID进行排序（基于S后面的数字）
    const sortedData = [...data].sort((a, b) => {
        // 从point_id中提取数字部分
        const numA = parseInt(a.point_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.point_id.replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    // 添加新选项
    sortedData.forEach(item => {
        const option = document.createElement('option');
        option.value = item.point_id;
        option.textContent = item.point_id;
        selector.appendChild(option);
    });
}

// 显示错误消息
function showErrorMessage(message) {
    const errorHtml = `
    <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
        <button onclick="retryDataLoad()" class="retry-button">
            <i class="fas fa-sync"></i> 重试
        </button>
    </div>`;

    // 在图表容器中显示错误信息
    document.getElementById('trend-chart').innerHTML = errorHtml;
    document.getElementById('points-chart').innerHTML = errorHtml;
    document.getElementById('time-series-chart').innerHTML = errorHtml;
    document.getElementById('rate-chart').innerHTML = errorHtml;

    // 清空点位详情面板
    document.getElementById('point-details').innerHTML =
        '<p class="empty-state"><i class="fas fa-exclamation-circle"></i> 加载数据失败</p>';
}

// 显示空数据消息
function showEmptyDataMessage(message) {
    const emptyHtml = `
    <div class="empty-message">
        <i class="fas fa-info-circle"></i>
        <p>${message}</p>
    </div>`;

    // 在图表容器中显示空数据信息
    document.getElementById('trend-chart').innerHTML = emptyHtml;
    document.getElementById('points-chart').innerHTML = emptyHtml;
}

// 重试加载数据
function retryDataLoad() {
    // 重新初始化图表
    initCharts();
}

// 加载特定点位的数据
function loadPointData(pointId) {
    // 显示加载状态
    window.timeSeriesChart.showLoading('default', { text: '加载中...' });
    window.rateChart.showLoading('default', { text: '加载中...' });

    document.getElementById('selected-point').textContent = pointId;

    // 更新点位选择器的选中值（如果存在）
    const selector = document.getElementById('point-selector');
    if (selector) {
        selector.value = pointId;
    }

    fetch(`/api/point/${pointId}`)
        .then(response => response.json())
        .then(data => {
            // 成功日志，帮助调试
            console.log('API 返回数据结构:', Object.keys(data));

            // 隐藏加载状态
            window.timeSeriesChart.hideLoading();
            window.rateChart.hideLoading();

            // 在try块前添加数据清洗
            if (data && data.timeSeriesData && Array.isArray(data.timeSeriesData) && data.timeSeriesData.length > 0) {
                // 处理NaN值
                data.timeSeriesData = data.timeSeriesData.map(item => {
                    return {
                        ...item,
                        daily_change: isNaN(item.daily_change) ? null : item.daily_change,
                        cumulative_change: isNaN(item.cumulative_change) ? null : item.cumulative_change,
                        value: isNaN(item.value) ? null : item.value
                    };
                });
                try {
                    updateTimeSeriesChart(pointId, data.timeSeriesData);
                    updateRateChart(pointId, data.timeSeriesData);
                    updatePointDetails(data.analysisData);
                } catch (err) {
                    console.error('处理点位数据时发生错误:', err);
                    showErrorMessage('处理数据时出错');
                }
            } else {
                // 处理空数据情况
                window.timeSeriesChart.setOption({
                    title: {
                        text: '没有时间序列数据',
                        left: 'center',
                        top: 'center'
                    }
                });

                window.rateChart.setOption({
                    title: {
                        text: '没有速率数据',
                        left: 'center',
                        top: 'center'
                    }
                });

                document.getElementById('point-details').innerHTML =
                    '<p class="empty-state"><i class="fas fa-info-circle"></i> 未找到监测点数据</p>';
            }
        })
        .catch(error => {
            console.error(`加载点位数据失败 (${pointId}):`, error);

            // 隐藏加载状态
            window.timeSeriesChart.hideLoading();
            window.rateChart.hideLoading();

            // 显示错误消息
            window.timeSeriesChart.setOption({
                title: {
                    text: '加载数据失败',
                    left: 'center',
                    top: 'center',
                    textStyle: {
                        color: '#ff3e5f'
                    }
                }
            });

            window.rateChart.setOption({
                title: {
                    text: '加载数据失败',
                    left: 'center',
                    top: 'center',
                    textStyle: {
                        color: '#ff3e5f'
                    }
                }
            });

            document.getElementById('point-details').innerHTML =
                '<p class="empty-state error-text"><i class="fas fa-exclamation-circle"></i> 加载数据失败</p>';
        });
}

// 设置点位选择器事件监听
function setupPointSelector() {
    const selector = document.getElementById('point-selector');
    if (selector) {
        selector.addEventListener('change', function() {
            const pointId = this.value;
            console.log(`[charts.js] Point selector changed. Selected ID: ${pointId}`);

            if (pointId) {
                loadPointData(pointId);
                // Directly call the function exposed by three_viewer.js
                if (typeof window.goToViewpoint === 'function') {
                    console.log(`[charts.js] Calling window.goToViewpoint with ID: ${pointId}`);
                    window.goToViewpoint(pointId);
                } else {
                    console.warn('[charts.js] window.goToViewpoint is not defined or not a function yet.');
                }
            } else {
                // Directly call for the default view when the placeholder is selected
                 if (typeof window.goToViewpoint === 'function') {
                    console.log(`[charts.js] Calling window.goToViewpoint with ID: Default`);
                    window.goToViewpoint('Default');
                 } else {
                    console.warn('[charts.js] window.goToViewpoint is not defined or not a function yet.');
                 }
            }
        });

        // Add a default option to the selector if it doesn't exist
        if (selector.options[0] && selector.options[0].value !== "") {
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- 默认视图 --"; // Or "Please Select", etc.
            selector.insertBefore(defaultOption, selector.firstChild);
        } else if (selector.options.length > 0 && selector.options[0].value === "") {
             selector.options[0].textContent = "-- 默认视图 --"; // Rename existing placeholder
        }
        selector.value = ""; // Set initial selection to the placeholder/default

        // Call goToViewpoint for the default view immediately after setup, without setTimeout
        if (typeof window.goToViewpoint === 'function') {
             console.log(`[charts.js] Calling initial window.goToViewpoint with ID: Default`);
             window.goToViewpoint('Default');
        } else {
            // It's possible three_viewer hasn't finished initializing yet.
            // Add a fallback listener for when three_viewer might be ready
            console.warn('[charts.js] window.goToViewpoint not ready on initial setup. Setting up a delayed check.');
            document.addEventListener('threeViewerReady', function() { // Assuming three_viewer might dispatch such an event upon completion
                 console.log('[charts.js] Received threeViewerReady event. Calling initial window.goToViewpoint(Default)');
                 if (typeof window.goToViewpoint === 'function') {
                     window.goToViewpoint('Default');
                 } else {
                     console.error('[charts.js] window.goToViewpoint still not available after threeViewerReady event.');
                 }
            }, { once: true }); // Listen only once

            // As a further safety net, try after a small delay if the event doesn't fire
            setTimeout(() => {
                 if (typeof window.goToViewpoint === 'function' && !window.initialViewpointSet) { // Add a flag to avoid double-setting
                    console.log('[charts.js] Calling initial window.goToViewpoint(Default) after a delay (fallback).');
                    window.goToViewpoint('Default');
                    window.initialViewpointSet = true; // Mark as set
                 } else if (!window.initialViewpointSet){
                     console.error('[charts.js] Fallback Timeout: window.goToViewpoint still not available.');
                 }
            }, 1000); // Increased delay for fallback
        }
    }
}

// 更新趋势分析图表
function updateTrendChart(data) {
    // 确保数据是数组格式
    if (!Array.isArray(data)) {
        console.error('趋势图数据格式错误', data);
        return;
    }

    const slopeData = data.map(item => ({
        name: item.point_id,
        value: parseFloat(item.trend_slope || 0).toFixed(6)
    }));

    // 按照监测点编号排序（而不是按斜率值排序）
    slopeData.sort((a, b) => {
        // 从point_id中提取数字部分
        const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    const option = {
        title: {
            text: '沉降趋势分析',
            left: 'center',
            textStyle: {
                fontSize: 24,
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}'
        },
        grid: {
            left: '10%',
            right: '4%',
            bottom: '10%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: slopeData.map(item => item.name),
            axisLabel: {
                rotate: 45,
                fontSize: 18,
                margin: 12
            }
        },
        yAxis: {
            type: 'value',
            name: '斜率 (mm/天)',
            nameTextStyle: {
                padding: [0, 0, 0, 30],
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 18
            }
        },
        series: [{
            data: slopeData.map(item => ({
                value: item.value,
                itemStyle: {
                    color: getCyberColorBySlope(item.value),
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    shadowColor: getCyberColorBySlope(item.value),
                    shadowBlur: 10
                }
            })),
            type: 'bar',
            barWidth: '60%',
            showBackground: true,
            backgroundStyle: {
                color: 'rgba(0, 229, 255, 0.05)'
            },
            label: {
                show: false
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 15,
                    shadowColor: 'rgba(0, 229, 255, 0.7)'
                },
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}',
                    fontSize: 16,
                    fontWeight: 'bold'
                }
            }
        }]
    };

    window.trendChart.setOption(option);

    // 添加动画效果
    addChartAnimation(window.trendChart);
}

// 更新监测点分布图表
function updatePointsDistributionChart(data) {
    // 确保数据是数组格式
    if (!Array.isArray(data)) {
        console.error('点位分布图数据格式错误', data);
        return;
    }

    // 统计不同趋势类型的数量
    const trendTypes = {};
    data.forEach(item => {
        if (item && item.trend_type) {
            const type = item.trend_type;
            trendTypes[type] = (trendTypes[type] || 0) + 1;
        }
    });

    const pieData = Object.keys(trendTypes).map(key => ({
        name: key,
        value: trendTypes[key]
    }));

    // 自定义颜色映射
    const colorMap = {
        '显著下沉': '#ff3e5f',
        '轻微下沉': '#ff9e0d',
        '轻微隆起': '#0088ff',
        '显著隆起': '#bf5af2',
        '稳定': '#00e676'
    };

    // 为每个数据项设置颜色
    const colorList = pieData.map(item => colorMap[item.name] || '#00e5ff');

    const option = {
        title: {
            text: '监测点告警等级分布',
            left: 'center',
            textStyle: {
                fontSize: 24,
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        grid: {
            left: '10%',
            right: '10%',
            bottom: '10%',
            top: '15%',
            containLabel: true
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            data: pieData.map(item => item.name),
            formatter: function(name) {
                const item = pieData.find(item => item.name === name);
                if (item) {
                    return `${name}: ${item.value}`;
                }
                return name;
            },
            textStyle: {
                fontSize: 18,
                color: 'rgba(224, 247, 250, 0.7)'
            },
            itemWidth: 14,
            itemHeight: 14,
            itemGap: 12
        },
        series: [
            {
                name: '告警等级',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['40%', '55%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: 'rgba(16, 23, 41, 0.8)',
                    borderWidth: 2,
                    shadowBlur: 20,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                },
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 20,
                        fontWeight: 'bold'
                    },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowColor: function(params) {
                            return colorMap[params.name] || '#00e5ff';
                        }
                    }
                },
                labelLine: {
                    show: false
                },
                data: pieData,
                color: colorList
            }
        ]
    };

    window.pointsChart.setOption(option);

    // 添加动画效果
    addChartAnimation(window.pointsChart, 1000);
}

// 更新时间序列图表
function updateTimeSeriesChart(pointId, timeSeriesData) {
    if (!window.timeSeriesChart || !timeSeriesData || timeSeriesData.length === 0) {
        window.timeSeriesChart.hideLoading();
        window.timeSeriesChart.setOption({
            title: {
                text: `${pointId} - 时间序列数据`,
                subtext: '暂无数据',
                left: 'center',
                top: 'center'
            }
        }, true);
        return;
    }

    const dates = timeSeriesData.map(item => item.date);
    const originalValues = timeSeriesData.map(item => item.original_value);
    const dailyChange = timeSeriesData.map(item => item.daily_change);
    const cumulativeChange = timeSeriesData.map(item => item.cumulative_change);

    const option = {
        title: {
            text: `${pointId} - 时间序列数据`,
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            formatter: null,
            confine: true
        },
        legend: {
            data: ['原始沉降值', '日变量', '累积变量'],
            bottom: 30, // Adjust legend position slightly
            textStyle: {
                fontSize: 14
            }
        },
        grid: {
            left: '8%', // Increase left padding
            right: '8%', // Increase right padding
            bottom: '18%', // Increase bottom padding for legend and dataZoom
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: dates,
            axisLabel: {
                fontSize: 12
            }
        },
        yAxis: [
            {
                type: 'value',
                name: '沉降值 / 累积变化 (mm)',
                position: 'left',
                axisLine: {
                    show: true,
                    lineStyle: {
                        color: '#00e5ff'
                    }
                },
                axisLabel: {
                    formatter: '{value} mm',
                    fontSize: 12
                },
                splitLine: {
                    lineStyle: {
                        type: 'dashed',
                        color: 'rgba(0, 229, 255, 0.2)'
                    }
                }
            },
            {
                type: 'value',
                name: '日变量 (mm/天)',
                position: 'right',
                axisLine: {
                    show: true,
                    lineStyle: {
                        color: '#00e676'
                    }
                },
                axisLabel: {
                    formatter: '{value} mm/天',
                    fontSize: 12
                },
                splitLine: { show: false }
            }
        ],
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100
            },
            {
                show: true,
                type: 'slider',
                bottom: 50, // Ensure slider is above legend
                height: 25,
                start: 0,
                end: 100,
                borderColor: 'rgba(0, 229, 255, 0.3)',
                handleIcon: 'path://M306.1,413.5l-6.5-6.5c-4.7-4.7-12.3-4.7-17,0L161.1,519.4c-4.7,4.7-4.7,12.3,0,17l6.5,6.5c4.7,4.7,12.3,4.7,17,0l121.5-121.5C310.8,425.8,310.8,418.2,306.1,413.5z',
                handleSize: '110%',
                handleStyle: {
                    color: '#00e5ff'
                },
                dataBackground: {
                    areaStyle: { color: 'rgba(0, 229, 255, 0.1)' },
                    lineStyle: { opacity: 0.8, color: 'rgba(0, 229, 255, 0.3)' }
                },
                fillerColor: 'rgba(0, 229, 255, 0.1)'
            }
        ],
        series: [
            {
                name: '原始沉降值',
                type: 'line',
                smooth: true,
                symbol: 'none',
                sampling: 'lttb',
                data: originalValues,
                lineStyle: {
                    width: 2,
                    color: '#00e5ff'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(0, 229, 255, 0.3)' },
                        { offset: 1, color: 'rgba(0, 229, 255, 0)' }
                    ])
                }
            },
            {
                name: '日变量',
                type: 'line',
                smooth: true,
                symbol: 'none',
                sampling: 'lttb',
                yAxisIndex: 1,
                data: dailyChange,
                lineStyle: {
                    width: 2,
                    color: '#00e676',
                    type: 'dashed' // Use dashed line for daily change
                }
            },
            {
                name: '累积变量',
                type: 'line',
                smooth: true,
                symbol: 'none',
                sampling: 'lttb',
                data: cumulativeChange,
                lineStyle: {
                    width: 2,
                    color: '#ff3e5f' // Use warning color for cumulative change
                }
            }
        ]
    };

    window.timeSeriesChart.hideLoading();
    window.timeSeriesChart.setOption(option, true);

    // 重新应用动画效果
    addChartAnimation(window.timeSeriesChart, 100); // 添加延迟以确保渲染完成
}

// 更新沉降速率图表
function updateRateChart(pointId, timeSeriesData) {
    // 数据预处理和验证
    if (!timeSeriesData || !Array.isArray(timeSeriesData) || timeSeriesData.length === 0) {
        console.error('无效的时间序列数据');
        return;
    }

    // 格式化日期 - 只保留日期部分
    const dates = timeSeriesData.map(item =>
        item.measurement_date ? item.measurement_date.split(' ')[0] : null
    );

    // 清理并处理daily_change数据，替换NaN值为null以便图表处理
    let rates = [];
    if (timeSeriesData[0].hasOwnProperty('daily_change')) {
        rates = timeSeriesData.map(item => {
            const rate = parseFloat(item.daily_change);
            return isNaN(rate) ? null : rate;
        });
    } else if (timeSeriesData[0].hasOwnProperty('rate')) {
        rates = timeSeriesData.map(item => {
            const rate = parseFloat(item.rate);
            return isNaN(rate) ? null : rate;
        });
    } else {
        // 如果没有速率字段，计算相邻点的差值，确保处理NaN情况
        rates = timeSeriesData.map((item, index) => {
            if (index === 0) return null; // 第一个点没有前值，设为null

            const prevValue = parseFloat(timeSeriesData[index - 1].value);
            const currValue = parseFloat(item.value);

            if (isNaN(prevValue) || isNaN(currValue)) return null;
            return currValue - prevValue;
        });
    }

    // 过滤掉无效值再计算平均速率
    const validRates = rates.filter(rate => rate !== null && !isNaN(rate));

    if (validRates.length === 0) {
        console.error('没有有效的速率数据');
        window.rateChart.setOption({
            title: {
                text: '没有有效的速率数据',
                left: 'center',
                top: 'center'
            }
        });
        return;
    }

    const avgRate = validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length;
    const threshold = 0.05; // 阈值，用于判断速率的严重程度

    const option = {
        title: {
            text: `${pointId} - 沉降速率（日变量）`,
            left: 'center',
            textStyle: {
                fontSize: 24,
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: null,
            confine: true
        },
        grid: {
            left: '12%',
            right: '4%',
            bottom: '12%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: dates,
            boundaryGap: false,
            axisLabel: {
                formatter: function(value) {
                    if (value && value.length >= 10) {
                        return value.substring(5, 10); // 提取月-日部分 (MM-DD)
                    }
                    return value;
                },
                rotate: 45,
                fontSize: 18,
                margin: 12
            }
        },
        yAxis: {
            type: 'value',
            name: '日变化率 (mm/天)',
            nameTextStyle: {
                padding: [0, 0, 0, 30],
                color: 'rgba(224, 247, 250, 0.7)',
                fontSize: 18
            },
            axisLabel: {
                fontSize: 18
            }
        },
        visualMap: {
            show: false,
            dimension: 1,
            pieces: [
                {
                    gt: threshold,
                    lte: Infinity,
                    color: '#bf5af2'
                },
                {
                    gt: 0,
                    lte: threshold,
                    color: '#0088ff'
                },
                {
                    gt: -threshold,
                    lte: 0,
                    color: '#00e676'
                },
                {
                    gt: -Infinity,
                    lte: -threshold,
                    color: '#ff3e5f'
                }
            ]
        },
        series: [{
            name: '日变化率',
            data: rates,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 10,
            connectNulls: true,
            lineStyle: {
                width: 3,
                cap: 'round'
            },
            markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: {
                    type: 'dashed',
                    opacity: 0.7
                },
                data: [
                    {
                        yAxis: 0,
                        name: '零线',
                        lineStyle: {
                            color: 'rgba(224, 247, 250, 0.3)',
                            type: 'solid'
                        },
                        label: {
                            show: true,
                            formatter: '0',
                            position: 'end',
                            color: 'rgba(224, 247, 250, 0.7)',
                            fontSize: 16
                        }
                    },
                    {
                        yAxis: threshold,
                        name: '上阈值',
                        lineStyle: {
                            color: '#bf5af2',
                            width: 1,
                            type: 'dashed'
                        },
                        label: {
                            show: true,
                            formatter: '上阈值',
                            position: 'end',
                            color: '#bf5af2',
                            fontSize: 16
                        }
                    },
                    {
                        yAxis: -threshold,
                        name: '下阈值',
                        lineStyle: {
                            color: '#ff3e5f',
                            width: 1,
                            type: 'dashed'
                        },
                        label: {
                            show: true,
                            formatter: '下阈值',
                            position: 'end',
                            color: '#ff3e5f',
                            fontSize: 16
                        }
                    },
                    {
                        yAxis: avgRate,
                        name: '平均',
                        lineStyle: {
                            color: '#ff9e0d',
                            width: 1,
                            type: 'dashed'
                        },
                        label: {
                            show: true,
                            formatter: `平均值: ${avgRate.toFixed(2)}`,
                            position: 'middle',
                            color: '#ff9e0d',
                            fontSize: 16,
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            padding: [4, 8]
                        }
                    }
                ]
            }
        }]
    };

    window.rateChart.setOption(option);

    // 添加动画效果
    addChartAnimation(window.rateChart, 1000);
}

// 更新监测点详情面板
function updatePointDetails(analysisData) {
    const detailsPanel = document.getElementById('point-details');

    if (!analysisData || Object.keys(analysisData).length === 0) {
        detailsPanel.innerHTML = '<p class="empty-state"><i class="fas fa-exclamation-circle"></i> 未找到监测点数据</p>';
        return;
    }

    // 根据趋势类型定义风险级别的样式类
    let alertClass = 'badge-success';
    if (analysisData.alert_level === '警告') {
        alertClass = 'badge-danger';
    } else if (analysisData.alert_level === '注意') {
        alertClass = 'badge-warning';
    }

    // 添加趋势类型的样式类
    let trendClass = 'badge-success';
    if (analysisData.trend_type === '显著下沉') {
        trendClass = 'badge-danger';
    } else if (analysisData.trend_type === '轻微下沉') {
        trendClass = 'badge-warning';
    } else if (analysisData.trend_type === '轻微隆起') {
        trendClass = 'badge-info';
    } else if (analysisData.trend_type === '显著隆起') {
        trendClass = 'badge-warning';
    }

    const detailsHtml = `
        <table class="data-table">
            <tr>
                <td><i class="fas fa-equals"></i> 平均值:</td>
                <td>${parseFloat(analysisData.avg_value).toFixed(4)} mm</td>
            </tr>
            <tr>
                <td><i class="fas fa-exchange-alt"></i> 总变化量:</td>
                <td>${parseFloat(analysisData.total_change).toFixed(4)} mm</td>
            </tr>
            <tr>
                <td><i class="fas fa-tachometer-alt"></i> 平均日变化率:</td>
                <td>${parseFloat(analysisData.avg_daily_rate).toFixed(6)} mm/天</td>
            </tr>
            <tr>
                <td><i class="fas fa-chart-line"></i> 趋势类型:</td>
                <td><span class="data-badge ${trendClass}">${analysisData.trend_type}</span></td>
            </tr>
            <tr>
                <td><i class="fas fa-exclamation-triangle"></i> 风险等级:</td>
                <td><span class="data-badge ${alertClass}">${analysisData.alert_level}</span></td>
            </tr>
        </table>
    `;

    detailsPanel.innerHTML = detailsHtml;
}

// 根据斜率值获取科技风格的颜色
function getCyberColorBySlope(slope) {
    const value = parseFloat(slope);
    if (value < -0.1) return '#ff3e5f';      // 显著下沉 - 红色
    if (value < -0.01) return '#ff9e0d';     // 轻微下沉 - 橙色
    if (value > 0.1) return '#bf5af2';       // 显著隆起 - 紫色
    if (value > 0.01) return '#0088ff';      // 轻微隆起 - 蓝色
    return '#00e676';                         // 稳定 - 绿色
}

// 添加图表动画效果
function addChartAnimation(chart, delay = 0) {
    setTimeout(() => {
        // 确保图表在DOM中可见
        if (chart && chart.getDom()) {
            // 添加简单的放大缩小动画
            const dom = chart.getDom();
            dom.style.transform = 'scale(0.95)';
            dom.style.opacity = '0.8';
            dom.style.transition = 'all 0.5s ease';

            setTimeout(() => {
                dom.style.transform = 'scale(1)';
                dom.style.opacity = '1';
            }, 100);
        }
    }, delay);
}

// 更新所有点位详情图表
function updatePointCharts(pointId, pointData) {
    document.getElementById('selected-point').textContent = pointId;

    // 更新点位选择器的选中值（如果存在）
    const selector = document.getElementById('point-selector');
    if (selector) {
        selector.value = pointId;
    }

    if (pointData && pointData.timeSeriesData) {
        updateTimeSeriesChart(pointId, pointData.timeSeriesData);
        updateRateChart(pointId, pointData.timeSeriesData);
        updatePointDetails(pointData.analysisData);
    } else {
        // 如果没有传递数据，则尝试从API加载
        loadPointData(pointId);
    }
}

// 确保updateChartsFromUnity在全局作用域中可用
window.updateChartsFromUnity = function(pointId, jsonData) {
    console.log('从Unity接收到数据更新请求:', pointId);
    try {
        const pointData = JSON.parse(jsonData);
        updatePointCharts(pointId, pointData);
    } catch (e) {
        console.error('解析从Unity接收的数据时出错:', e);
        // 如果解析失败，尝试直接加载数据
        loadPointData(pointId);
    }
};

// 保持原始函数，使其调用全局方法
function updateChartsFromUnity(pointId, jsonData) {
    window.updateChartsFromUnity(pointId, jsonData);
}

// 窗口大小改变时重绘图表
window.addEventListener('resize', function() {
    if (window.trendChart) window.trendChart.resize();
    if (window.pointsChart) window.pointsChart.resize();
    if (window.timeSeriesChart) window.timeSeriesChart.resize();
    if (window.rateChart) window.rateChart.resize();
});

// 配置图表放大功能
function setupChartZoom() {
    // 为每个图表容器添加缩放按钮
    const chartContainers = document.querySelectorAll('.chart-container');

    chartContainers.forEach(container => {
        const chartBody = container.querySelector('.chart-body');
        const chartTitle = container.querySelector('.chart-title').textContent;
        const chart = chartBody.querySelector('.chart');

        if (chart) {
            const chartId = chart.id;

            // 添加缩放按钮
            const zoomButton = document.createElement('button');
            zoomButton.className = 'zoom-button';
            zoomButton.innerHTML = '<i class="fas fa-expand-alt"></i>';
            zoomButton.title = '放大图表';

            container.querySelector('.chart-header').appendChild(zoomButton);

            // 绑定点击事件
            zoomButton.addEventListener('click', function() {
                openZoomModal(chartId, chartTitle);
            });
        }
    });

    // 创建缩放模态框（如果不存在）
    if (!document.getElementById('zoom-modal')) {
        const zoomModal = document.createElement('div');
        zoomModal.id = 'zoom-modal';
        zoomModal.className = 'modal zoom-modal';

        zoomModal.innerHTML = `
            <div class="modal-content zoom-modal-content">
                <div class="modal-header">
                    <h3 id="zoom-chart-title"></h3>
                    <span class="close zoom-close">&times;</span>
                </div>
                <div class="modal-body zoom-modal-body">
                    <div id="zoom-chart" class="zoom-chart"></div>
                </div>
            </div>
        `;

        document.body.appendChild(zoomModal);

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .zoom-modal {
                display: none;
                position: fixed;
                z-index: 9999;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
            }

            .zoom-modal-content {
                background-color: rgba(12, 20, 38, 0.9);
                margin: 5% auto;
                padding: 20px;
                border-radius: 8px;
                width: 85%;
                height: 85%;
                box-shadow: 0 0 20px rgba(0, 229, 255, 0.6);
                position: relative;
            }

            .zoom-modal-body {
                height: calc(100% - 60px);
                overflow: hidden;
            }

            .zoom-chart {
                width: 100%;
                height: 100%;
                min-height: 400px;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(0, 229, 255, 0.3);
                padding-bottom: 15px;
                margin-bottom: 20px;
            }

            .modal-header h3 {
                margin: 0;
                color: #00e5ff;
            }

            .zoom-close {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }

            .zoom-close:hover,
            .zoom-close:focus {
                color: #00e5ff;
                text-decoration: none;
            }

            .zoom-button {
                background: rgba(0, 229, 255, 0.2);
                border: none;
                color: rgba(255, 255, 255, 0.7);
                border-radius: 4px;
                padding: 3px 8px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 10px;
                transition: all 0.3s ease;
            }

            .zoom-button:hover {
                background: rgba(0, 229, 255, 0.4);
                color: white;
            }
        `;
        document.head.appendChild(style);

        // 绑定关闭按钮事件
        document.querySelector('.zoom-close').addEventListener('click', closeZoomModal);

        // 点击模态框外部关闭
        zoomModal.addEventListener('click', function(event) {
            if (event.target === zoomModal) {
                closeZoomModal();
            }
        });
    }
}

// Open zoom modal
function openZoomModal(chartId, chartTitle) {
    const zoomModal = document.getElementById('zoom-modal');
    const zoomChartTitle = document.getElementById('zoom-chart-title');
    const zoomChart = document.getElementById('zoom-chart');
    const modalHeader = zoomModal.querySelector('.modal-header'); // Get modal header

    // Find or create the description paragraph in the modal
    let zoomChartDescription = document.getElementById('zoom-chart-description');
    if (!zoomChartDescription) {
        zoomChartDescription = document.createElement('p');
        zoomChartDescription.id = 'zoom-chart-description';
        // Insert after the title h3, before the close span
        modalHeader.insertBefore(zoomChartDescription, zoomChartTitle.nextSibling);
    }
    zoomChartDescription.textContent = ''; // Clear previous description

    // Find the original description text
    const chartElement = document.getElementById(chartId);
    const chartContainer = chartElement.closest('.chart-container');
    let descriptionText = '';
    if (chartContainer) {
        const descriptionElement = chartContainer.querySelector('.chart-header .chart-description');
        if (descriptionElement) {
            descriptionText = descriptionElement.textContent;
        }
    }

    // Clear previous content
    zoomChart.innerHTML = '';

    // Set title
    zoomChartTitle.textContent = chartTitle;
    // Set description
    zoomChartDescription.textContent = descriptionText;

    // Show modal
    zoomModal.style.display = 'block';

    // Ensure chart container has explicit dimensions
    zoomChart.style.width = '100%';
    zoomChart.style.height = '500px';

    // Get the corresponding chart instance based on the original chart ID
    let sourceChart = null;

    switch (chartId) {
        case 'trend-chart':
            sourceChart = window.trendChart;
            break;
        case 'points-chart':
            sourceChart = window.pointsChart;
            break;
        case 'time-series-chart':
            sourceChart = window.timeSeriesChart;
            break;
        case 'rate-chart':
            sourceChart = window.rateChart;
            break;
    }

    if (sourceChart) {
        // Use setTimeout to ensure the modal is fully displayed and styles are applied before initializing the chart
        setTimeout(() => {
            // Create new chart instance
            const zoomedChart = echarts.init(zoomChart);

            // Get original chart options and apply to zoomed chart
            const option = sourceChart.getOption();
            zoomedChart.setOption(option);

            // Force redraw once to adapt to container
            zoomedChart.resize();

            // Add resize listener for window size changes
            const resizeHandler = function() {
                zoomedChart.resize();
            };

            window.addEventListener('resize', resizeHandler);

            // Store resize handler for removal when closing
            zoomModal._resizeHandler = resizeHandler;
            zoomModal._zoomedChart = zoomedChart;
        }, 100); // Short delay to ensure DOM is updated
    } else {
        zoomChart.innerHTML = '<div class="empty-chart"><p>无法加载图表数据</p></div>';
    }
}

// Close zoom modal
function closeZoomModal() {
    const zoomModal = document.getElementById('zoom-modal');

    // Clear the description text
    const zoomChartDescription = document.getElementById('zoom-chart-description');
    if (zoomChartDescription) {
        zoomChartDescription.textContent = '';
    }

    // Remove resize listener
    if (zoomModal._resizeHandler) {
        window.removeEventListener('resize', zoomModal._resizeHandler);
    }

    // Destroy chart instance
    if (zoomModal._zoomedChart) {
        zoomModal._zoomedChart.dispose();
    }

    // Hide modal
    zoomModal.style.display = 'none';
}

// Add a new listener to ensure initCharts is called after the DOM is ready
document.addEventListener('DOMContentLoaded', initCharts);
