document.addEventListener('DOMContentLoaded', function() {
    console.log('监测数字孪生系统已加载');

    // 初始化页面响应式调整 - REMOVE/COMMENT OUT UNITY SPECIFIC RESIZE LOGIC
    /*
    window.addEventListener('resize', function() {
        const unityContainer = document.getElementById('unity-container'); // This ID no longer exists on settlement page
        const unityCanvas = document.getElementById('unity-canvas'); // This ID no longer exists on settlement page

        if (unityContainer && unityCanvas) { // Check if elements exist before accessing properties
            // 保持适当的宽高比
            const aspectRatio = 16 / 9;
            const containerWidth = unityContainer.clientWidth; // Error occurs here if unityContainer is null
            const containerHeight = unityContainer.clientHeight;

            if (containerWidth / containerHeight > aspectRatio) {
                unityCanvas.style.width = containerHeight * aspectRatio + 'px';
                unityCanvas.style.height = containerHeight + 'px';
            } else {
                unityCanvas.style.width = containerWidth + 'px';
                unityCanvas.style.height = containerWidth / aspectRatio + 'px';
            }
        }
    });
    */

    // 添加UI装饰元素 (This function seems generic, keep it for now)
    function addDecorations() {
        // 添加图表容器装饰
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            // 添加底部角落装饰
            const cornerBL = document.createElement('div');
            cornerBL.className = 'chart-corner-bl';
            container.appendChild(cornerBL);

            const cornerBR = document.createElement('div');
            cornerBR.className = 'chart-corner-br';
            container.appendChild(cornerBR);

            // 添加顶部光效
            const topGlow = document.createElement('div');
            topGlow.className = 'chart-top-glow';
            container.appendChild(topGlow);
        });

        // 添加背景装饰
        const unityBackground = document.querySelector('.unity-background');
        if (unityBackground) {
            // 添加背景花纹
            const bgPattern = document.createElement('div');
            bgPattern.className = 'bg-pattern';
            unityBackground.appendChild(bgPattern);

            // 添加扫描线效果
            const scanLine = document.createElement('div');
            scanLine.className = 'scan-line';
            unityBackground.appendChild(scanLine);
        }
    }
    // setTimeout(addDecorations, 500);
    // Let's comment out decoration adding temporarily to ensure it's not causing issues

    // REMOVE any explicit calls to Unity related functions from unity-loader.js if they exist here

});

// 自动刷新功能 (Keep this)
(function setupAutoRefresh() {
    // 数据自动刷新（每5分钟）
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟
    let lastRefreshTime = new Date();

    function updateLastRefreshTime() {
        lastRefreshTime = new Date();
        const timeString = lastRefreshTime.toLocaleTimeString();
        document.querySelector('.footer p').innerHTML =
            `<i class="fas fa-copyright"></i> 2024 沉降监测数字孪生系统 | <i class="fas fa-sync"></i> 上次更新: ${timeString}`;
    }

    function refreshData() {
        console.log('正在刷新数据...');

        // 刷新趋势图表
        if (typeof refreshTrendChart === 'function') {
            refreshTrendChart();
        }

        // 刷新点位分布图表
        if (typeof refreshPointsChart === 'function') {
            refreshPointsChart();
        }

        // 刷新选中监测点数据
        const selectedPoint = document.getElementById('point-selector').value;
        if (selectedPoint) {
            if (typeof loadPointData === 'function') {
                loadPointData(selectedPoint);
            }
        }

        updateLastRefreshTime();
    }

    // 初始化时更新一次时间显示
    updateLastRefreshTime();

    // 设置自动刷新定时器
    setInterval(refreshData, REFRESH_INTERVAL);

    // 将刷新函数暴露到全局，方便其他脚本调用
    window.refreshAllData = refreshData;
})();

// --- Drag and Drop Functionality (Keep this) ---
document.addEventListener('DOMContentLoaded', () => {
    // Only run this on pages with draggable charts (settlement, cracks, temperature, or vibration)
    const isSettlementPage = document.body.querySelector('#trend-chart'); // ID from settlement.html
    const isCracksPage = document.body.querySelector('#chart-trend'); // ID from cracks.html
    const isTemperaturePage = document.body.querySelector('#temperature-distribution-chart'); // ID from temperature.html
    const isVibrationPage = document.body.querySelector('#waveform-factor-chart'); // ID from vibration.html
    if (!isSettlementPage && !isCracksPage && !isTemperaturePage && !isVibrationPage) {
        return; // Exit if not on a relevant page
    }

    const panels = document.querySelectorAll('.left-panel, .right-panel');
    let draggedItem = null;
    let dropIndicator = null; // Element to show insertion point

    function createDropIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'drag-over-indicator';
        return indicator;
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.chart-container:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    panels.forEach(panel => {
        const draggables = panel.querySelectorAll('.chart-container[draggable="true"]');

        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                // Use the draggable element itself, not its children
                draggedItem = draggable;
                setTimeout(() => draggable.classList.add('dragging'), 0); // Add class slightly after drag starts
                e.dataTransfer.effectAllowed = 'move';
                // Optionally set drag data (though not strictly needed if using draggedItem variable)
                // e.dataTransfer.setData('text/plain', draggable.id || 'draggable-item');
            });

            draggable.addEventListener('dragend', () => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                }
                 if (dropIndicator && dropIndicator.parentNode) {
                    dropIndicator.parentNode.removeChild(dropIndicator);
                }
                draggedItem = null;
                dropIndicator = null;
                panel.classList.remove('drag-over'); // Clean up panel style
            });
        });

        panel.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            panel.classList.add('drag-over'); // Highlight drop zone
            e.dataTransfer.dropEffect = 'move';

            if (!dropIndicator) {
                dropIndicator = createDropIndicator();
            }

            const afterElement = getDragAfterElement(panel, e.clientY);
            if (afterElement == null) {
                if (!panel.contains(dropIndicator) || panel.lastElementChild !== dropIndicator) {
                     if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
                    panel.appendChild(dropIndicator);
                }
            } else {
                 if (!panel.contains(dropIndicator) || afterElement.previousSibling !== dropIndicator) {
                     if (dropIndicator.parentNode) dropIndicator.parentNode.removeChild(dropIndicator);
                     panel.insertBefore(dropIndicator, afterElement);
                 }
            }
        });

        panel.addEventListener('dragleave', (e) => {
            // Remove indicator only if leaving the panel itself, not moving over children
            if (!panel.contains(e.relatedTarget)) {
                 if (dropIndicator && dropIndicator.parentNode) {
                    dropIndicator.parentNode.removeChild(dropIndicator);
                }
                panel.classList.remove('drag-over');
                dropIndicator = null; // Reset indicator when leaving panel
            }
        });

        panel.addEventListener('drop', (e) => {
            e.preventDefault();
            panel.classList.remove('drag-over');
            // console.log('Drop event triggered on:', panel);
            // console.log('Dragged item:', draggedItem);
            // console.log('Drop indicator:', dropIndicator);

            if (draggedItem && dropIndicator && dropIndicator.parentNode === panel) {
                // Determine where to insert based on the indicator's position
                const nextSibling = dropIndicator.nextSibling;

                // Remove the indicator first to avoid conflicts
                panel.removeChild(dropIndicator);
                dropIndicator = null; // Reset indicator reference

                // Insert the dragged item
                if (nextSibling) {
                    // console.log('Inserting before:', nextSibling);
                    panel.insertBefore(draggedItem, nextSibling);
                } else {
                    // console.log('Appending to end of panel.');
                    panel.appendChild(draggedItem);
                }
            } else if (draggedItem) {
                 // Fallback if indicator wasn't placed correctly - just append
                 // console.log('Indicator issue - Appending dragged item as fallback.');
                 // Ensure it's removed from its original position if it's already in this panel
                 if(draggedItem.parentNode === panel) {
                    // panel.removeChild(draggedItem); // Avoid removing if just appending?
                 }
                 panel.appendChild(draggedItem);
            }

            // Reset dropIndicator just in case it wasn't cleared
            if (dropIndicator && dropIndicator.parentNode) {
                try { dropIndicator.parentNode.removeChild(dropIndicator); } catch(err) {}
            }
            dropIndicator = null;
            // draggedItem is reset in dragend
        });
    });
});