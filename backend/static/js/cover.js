/**
 * 封面页数据加载和功能
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('封面页初始化...');
    
    // 初始化数据加载
    loadDashboardData();
    
    // 绑定视频切换按钮事件
    document.getElementById('camera-1').addEventListener('click', () => switchCamera('entrance'));
    document.getElementById('camera-2').addEventListener('click', () => switchCamera('middle'));
    document.getElementById('camera-3').addEventListener('click', () => switchCamera('exit'));
    
    // 设置定时刷新
    setInterval(loadDashboardData, 5 * 60 * 1000); // 每5分钟刷新一次数据
});

/**
 * 加载仪表盘数据
 */
function loadDashboardData() {
    console.log('加载监测系统概览数据...');
    
    // 加载沉降数据
    loadSettlementData();
    
    // 加载裂缝数据
    loadCrackData();
    
    // 加载温度数据
    loadTemperatureData();
    
    // 加载振动数据
    loadVibrationData();
    
    // 更新数据加载时间
    updateLastRefreshTime();
}

/**
 * 加载沉降监测数据
 */
function loadSettlementData() {
    fetch('/api/summary')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                // 计算监测点数量
                document.getElementById('settlement-points').textContent = data.length + '个';
                
                // 计算最大沉降值
                let maxSettlement = 0;
                data.forEach(point => {
                    if (point.max_settlement && parseFloat(point.max_settlement) < maxSettlement) {
                        maxSettlement = parseFloat(point.max_settlement);
                    }
                });
                document.getElementById('max-settlement').textContent = maxSettlement.toFixed(2) + 'mm';
                
                // 计算平均沉降速率
                let totalRate = 0;
                let validPoints = 0;
                data.forEach(point => {
                    if (point.avg_rate) {
                        totalRate += parseFloat(point.avg_rate);
                        validPoints++;
                    }
                });
                const avgRate = validPoints > 0 ? totalRate / validPoints : 0;
                document.getElementById('avg-settlement-rate').textContent = avgRate.toFixed(3) + 'mm/天';
                
                // 获取最近更新日期
                if (data[0].last_updated) {
                    const lastDate = new Date(data[0].last_updated).toISOString().split('T')[0];
                    document.getElementById('settlement-update-date').textContent = lastDate;
                    
                    // 计算相对时间
                    const relativeTime = getRelativeTimeString(new Date(data[0].last_updated));
                    document.getElementById('settlement-last-update').textContent = `上次数据更新于: ${relativeTime}`;
                }
            }
        })
        .catch(error => {
            console.error('加载沉降数据失败:', error);
        });
}

/**
 * 加载裂缝监测数据
 */
function loadCrackData() {
    fetch('/api/crack/stats_overview')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && data.data) {
                const stats = data.data;
                
                // 监测裂缝数量
                document.getElementById('crack-count').textContent = stats.total_points + '条';
                
                // 最大裂缝宽度 (假设数据中包含此信息)
                if (stats.max_change_rate) {
                    document.getElementById('max-crack-width').textContent = stats.max_change_rate.toFixed(2) + 'mm';
                }
                
                // 平均扩展速率
                if (stats.avg_slope) {
                    document.getElementById('avg-crack-rate').textContent = Math.abs(stats.avg_slope).toFixed(4) + 'mm/天';
                }
                
                // 获取当前日期作为更新日期（实际应从数据中获取）
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('crack-update-date').textContent = today;
                
                // 设置相对时间
                document.getElementById('crack-last-update').textContent = '上次数据更新于: 今天';
            }
        })
        .catch(error => {
            console.error('加载裂缝数据失败:', error);
        });
}

/**
 * 加载温度监测数据
 */
function loadTemperatureData() {
    fetch('/api/temperature/stats')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && data.data) {
                const stats = data.data;
                
                // 加载传感器数量（在温度总结中获取）
                fetch('/api/temperature/summary')
                    .then(response => response.json())
                    .then(summaryData => {
                        if (summaryData.status === 'success' && summaryData.data) {
                            document.getElementById('temp-sensor-count').textContent = summaryData.data.length + '个';
                        }
                    });
                
                // 当前平均温度
                if (stats.current_temperature && stats.current_temperature.avg !== null) {
                    document.getElementById('avg-temp').textContent = stats.current_temperature.avg.toFixed(1) + '°C';
                }
                
                // 温度范围
                if (stats.current_temperature && 
                    stats.current_temperature.min !== null && 
                    stats.current_temperature.max !== null) {
                    const minTemp = stats.current_temperature.min.toFixed(1);
                    const maxTemp = stats.current_temperature.max.toFixed(1);
                    document.getElementById('temp-range').textContent = `${minTemp}°C - ${maxTemp}°C`;
                }
                
                // 更新日期
                if (stats.current_temperature && stats.current_temperature.date) {
                    document.getElementById('temp-update-date').textContent = stats.current_temperature.date;
                    
                    // 计算相对时间
                    const today = new Date().toISOString().split('T')[0];
                    const updateDate = stats.current_temperature.date;
                    
                    let relativeTime = '今天';
                    if (updateDate !== today) {
                        const daysDiff = Math.floor((new Date(today) - new Date(updateDate)) / (24 * 60 * 60 * 1000));
                        relativeTime = daysDiff === 1 ? '昨天' : `${daysDiff}天前`;
                    }
                    
                    document.getElementById('temp-last-update').textContent = `上次数据更新于: ${relativeTime}`;
                }
            }
        })
        .catch(error => {
            console.error('加载温度数据失败:', error);
        });
}

/**
 * 加载振动监测数据
 */
function loadVibrationData() {
    fetch('/api/vibration/datasets')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && data.data && data.data.length > 0) {
                const latestDataset = data.data[0]; // 获取最新的数据集
                
                // 设置通道数量
                document.getElementById('vibration-channel-count').textContent = '8个';
                
                // 获取最新数据集的详细信息
                return fetch(`/api/vibration/dataset/${latestDataset.id}`);
            }
        })
        .then(response => {
            if (response) return response.json();
        })
        .then(dataset => {
            if (dataset && dataset.status === 'success' && dataset.data) {
                const vibData = dataset.data;
                
                // 更新振动数据值
                if (vibData.stats) {
                    // 最大振幅
                    if (vibData.stats.peak_value) {
                        document.getElementById('max-amplitude').textContent = 
                            parseFloat(vibData.stats.peak_value).toFixed(2) + 'g';
                    }
                    
                    // 中心频率
                    if (vibData.stats.center_frequency) {
                        document.getElementById('center-frequency').textContent = 
                            parseFloat(vibData.stats.center_frequency).toFixed(1) + 'Hz';
                    }
                }
                
                // 更新日期（从数据集获取）
                if (vibData.upload_time) {
                    const uploadDate = new Date(vibData.upload_time).toISOString().split('T')[0];
                    document.getElementById('vibration-update-date').textContent = uploadDate;
                    
                    // 计算相对时间
                    const relativeTime = getRelativeTimeString(new Date(vibData.upload_time));
                    document.getElementById('vibration-last-update').textContent = `上次数据更新于: ${relativeTime}`;
                }
            }
        })
        .catch(error => {
            console.error('加载振动数据失败:', error);
        });
}

/**
 * 更新最后刷新时间
 */
function updateLastRefreshTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.querySelector('.footer p').innerHTML =
        `<i class="fas fa-copyright"></i> 2024 杨高中路隧道监测系统 | <i class="fas fa-sync"></i> 数据同步时间: ${timeString}`;
}

/**
 * 获取相对时间字符串
 */
function getRelativeTimeString(date) {
    const now = new Date();
    const diff = now - date;
    
    // 计算时间差（毫秒）
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) {
        return `${minutes}分钟前`;
    } else if (hours < 24) {
        return `${hours}小时前`;
    } else if (days === 1) {
        return '昨天 ' + date.toLocaleTimeString();
    } else if (days < 7) {
        return `${days}天前`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * 切换摄像头视频源
 */
function switchCamera(position) {
    const video = document.getElementById('tunnel-video');
    
    // 在实际应用中，这里应该替换为真实的视频源URL
    let videoSource = '';
    let posterImage = '';
    
    switch (position) {
        case 'entrance':
            videoSource = '/static/videos/entrance.mp4'; // 入口摄像头视频
            posterImage = '/static/images/tunnel_entrance.jpg';
            break;
        case 'middle':
            videoSource = '/static/videos/middle.mp4'; // 中段摄像头视频
            posterImage = '/static/images/tunnel_middle.jpg';
            break;
        case 'exit':
            videoSource = '/static/videos/exit.mp4'; // 出口摄像头视频
            posterImage = '/static/images/tunnel_exit.jpg';
            break;
        default:
            videoSource = '';
            posterImage = 'https://via.placeholder.com/800x450.png?text=隧道监控视频';
    }
    
    // 更新视频源
    if (videoSource) {
        const sourceElement = video.querySelector('source');
        sourceElement.src = videoSource;
        video.poster = posterImage;
        video.load(); // 重新加载视频
        video.play(); // 自动播放
    }
    
    // 高亮当前选中的摄像头按钮
    document.querySelectorAll('.video-btn').forEach(btn => {
        btn.style.background = 'rgba(64, 174, 255, 0.1)';
    });
    
    const btnId = position === 'entrance' ? 'camera-1' : 
                 (position === 'middle' ? 'camera-2' : 'camera-3');
    document.getElementById(btnId).style.background = 'rgba(64, 174, 255, 0.3)';
} 

// cover.js - Drag and Drop for Data Cards on Cover Page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Cover page specific JS loaded.');

    const container = document.querySelector('.data-overview');
    if (!container) {
        console.log('Data overview container not found on this page.');
        return; // Exit if the main container isn't present
    }

    const draggables = container.querySelectorAll('.data-card[draggable="true"]');
    let draggedItem = null;
    let dropIndicator = null;

    function createDropIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'drag-over-indicator';
        // Make indicator visually distinct for cards if needed
        indicator.style.height = '10px'; 
        indicator.style.margin = '5px 0';
        indicator.style.width = '100%'; // Span full width
        return indicator;
    }

    // Slightly different logic for flexbox/grid might be needed for getDragAfterElement
    // This version checks horizontal position primarily due to wrap
    function getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.data-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // Prioritize vertical position first within a row
            const offsetY = y - box.top - box.height / 2;
            // Then consider horizontal position to determine order within the row
            const offsetX = x - box.left - box.width / 2;

            // Check if the cursor is vertically within the element's bounds
            const isVerticallyAligned = y >= box.top && y <= box.bottom;

            // Find the element directly below the cursor or closest to the left/right
            if (offsetY < 0 && offsetY > closest.offsetY) { // Directly below
                 return { offsetX: offsetX, offsetY: offsetY, element: child };
             } else if (offsetY >= 0 && isVerticallyAligned && offsetX < 0 && offsetX > closest.offsetX ) { // To the left within the same row
                 return { offsetX: offsetX, offsetY: offsetY, element: child };
             } else {
                return closest;
             }

        }, { offsetX: Number.NEGATIVE_INFINITY, offsetY: Number.NEGATIVE_INFINITY }).element;
    }


    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            draggedItem = draggable;
            setTimeout(() => draggable.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
            draggable.style.cursor = 'grabbing'; // Change cursor while dragging
        });

        draggable.addEventListener('dragend', () => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                 draggedItem.style.cursor = 'move'; // Restore cursor
            }
            if (dropIndicator && dropIndicator.parentNode) {
                dropIndicator.parentNode.removeChild(dropIndicator);
            }
            draggedItem = null;
            dropIndicator = null;
            container.classList.remove('drag-over');
        });
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';

        if (!dropIndicator) {
            dropIndicator = createDropIndicator();
        }

        const afterElement = getDragAfterElement(container, e.clientX, e.clientY);
        if (afterElement == null) {
            if (!container.contains(dropIndicator) || container.lastElementChild !== dropIndicator) {
                 if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
                container.appendChild(dropIndicator);
            }
        } else {
             if (!container.contains(dropIndicator) || afterElement.previousSibling !== dropIndicator) {
                 if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
                 container.insertBefore(dropIndicator, afterElement);
             }
        }
    });

    container.addEventListener('dragleave', (e) => {
        if (!container.contains(e.relatedTarget)) {
            if (dropIndicator && dropIndicator.parentNode) {
                dropIndicator.parentNode.removeChild(dropIndicator);
            }
            container.classList.remove('drag-over');
            dropIndicator = null;
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');

        if (draggedItem && dropIndicator && dropIndicator.parentNode === container) {
            const nextSibling = dropIndicator.nextSibling;
            container.removeChild(dropIndicator);
            dropIndicator = null;

            if (nextSibling) {
                container.insertBefore(draggedItem, nextSibling);
            } else {
                container.appendChild(draggedItem);
            }
        } else if (draggedItem) {
             container.appendChild(draggedItem); // Fallback append
        }

        if (dropIndicator && dropIndicator.parentNode) {
            try { dropIndicator.parentNode.removeChild(dropIndicator); } catch(err) {}
        }
        dropIndicator = null;
        // draggedItem reset in dragend
    });
}); 