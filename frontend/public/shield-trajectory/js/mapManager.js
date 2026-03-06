/**
 * 百度地图管理器
 */
class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.polylines = [];
        this.isInitialized = false;
        this.mapContainerId = 'baidu-map';
    }

    /**
     * 初始化地图
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        if (!window.BMap) {
            console.error('百度地图API未加载');
            return false;
        }

        try {
            const mapContainer = document.getElementById(this.mapContainerId);
            if (!mapContainer) {
                console.error('地图容器不存在');
                return false;
            }

            // 创建地图实例
            this.map = new window.BMap.Map(this.mapContainerId);

            // 设置默认中心点和缩放级别
            this.map.centerAndZoom(new window.BMap.Point(116.404, 39.915), 15);

            // 添加控件
            this.map.addControl(new window.BMap.NavigationControl());
            this.map.addControl(new window.BMap.ScaleControl());
            this.map.enableScrollWheelZoom();

            this.isInitialized = true;
            console.log('百度地图初始化成功');
            return true;

        } catch (error) {
            console.error('百度地图初始化失败:', error);
            this.showMapError();
            return false;
        }
    }

    /**
     * 显示地图错误信息
     */
    showMapError() {
        const mapContainer = document.getElementById(this.mapContainerId);
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="map-error">
                    <div class="error-icon">🗺️</div>
                    <h3>地图加载失败</h3>
                    <p>请检查网络连接和百度地图API配置</p>
                </div>
            `;
        }
    }

    /**
     * 清除所有覆盖物
     */
    clearOverlays() {
        if (this.map) {
            this.map.clearOverlays();
        }
        this.markers = [];
        this.polylines = [];
    }

    /**
     * 添加标记点
     * @param {Object} point - 坐标点 {lng, lat}
     * @param {Object} options - 标记选项
     */
    addMarker(point, options = {}) {
        if (!this.map || !window.BMap) {
            return null;
        }

        const baiduPoint = new window.BMap.Point(point.lng, point.lat);
        const marker = new window.BMap.Marker(baiduPoint, options);

        this.map.addOverlay(marker);
        this.markers.push(marker);

        return marker;
    }

    /**
     * 添加带标签的标记点
     * @param {Object} point - 坐标点
     * @param {string} labelText - 标签文本
     * @param {Object} options - 标记选项
     */
    addMarkerWithLabel(point, labelText, options = {}) {
        if (!this.map || !window.BMap) {
            return null;
        }

        const baiduPoint = new window.BMap.Point(point.lng, point.lat);

        // 创建标签
        const label = new window.BMap.Label(labelText, {
            offset: new window.BMap.Size(0, -30),
            style: {
                color: '#333',
                fontSize: '12px',
                backgroundColor: 'rgba(255,255,255,0.8)',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '2px 6px'
            }
        });

        // 创建标记
        const marker = new window.BMap.Marker(baiduPoint, options);
        marker.setLabel(label);

        this.map.addOverlay(marker);
        this.markers.push(marker);

        return marker;
    }

    /**
     * 绘制轨迹线
     * @param {Array} points - 坐标点数组
     * @param {Object} options - 线条选项
     */
    drawPolyline(points, options = {}) {
        if (!this.map || !window.BMap || points.length < 2) {
            return null;
        }

        const baiduPoints = points.map(point => new window.BMap.Point(point.lng, point.lat));
        const polyline = new window.BMap.Polyline(baiduPoints, {
            strokeColor: '#00FF00',
            strokeWeight: 4,
            strokeOpacity: 1,
            ...options
        });

        this.map.addOverlay(polyline);
        this.polylines.push(polyline);

        return polyline;
    }

    /**
     * 设置地图中心点
     * @param {Object} point - 坐标点
     * @param {number} zoom - 缩放级别
     */
    setCenter(point, zoom = 15) {
        if (this.map && window.BMap) {
            const baiduPoint = new window.BMap.Point(point.lng, point.lat);
            this.map.centerAndZoom(baiduPoint, zoom);
        }
    }

    /**
     * 调整视野以显示所有点
     * @param {Array} points - 坐标点数组
     */
    fitBounds(points) {
        if (!this.map || !window.BMap || points.length === 0) {
            return;
        }

        const baiduPoints = points.map(point => new window.BMap.Point(point.lng, point.lat));
        this.map.setViewport(baiduPoints);
    }

    /**
     * 创建起点标记
     * @param {Object} point - 坐标点
     */
    addStartMarker(point) {
        return this.addMarkerWithLabel(point, '起点', {
            icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyQzIgMTcuNTIgNi40OCAyMiAxMiAyMkMxNy41MiAyMiAyMiAxNy41MiAyMiAxMkMyMiA2LjQ4IDE3LjUyIDIgMTIgMloiIGZpbGw9IiM5OTkiLz4KPHBhdGggZD0iTTEyIDZDNi40OCA2IDIgMTAuNDggMiAxNkMyIDIxLjUyIDYuNDggNiAxMiA2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+', new window.BMap.Size(24, 24))
        });
    }

    /**
     * 创建终点标记
     * @param {Object} point - 坐标点
     */
    addEndMarker(point) {
        return this.addMarkerWithLabel(point, '终点', {
            icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyQzIgMTcuNTIgNi40OCAyMiAxMiAyMkMxNy41MiAyMiAyMiAxNy41MiAyMiAxMkMyMiA2LjQ4IDE3LjUyIDIgMTIgMloiIGZpbGw9IiM5OTkiLz4KPHBhdGggZD0iTTEyIDZDNi40OCA2IDIgMTAuNDggMiAxNkMyIDIxLjUyIDYuNDggNiAxMiA2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+', new window.BMap.Size(24, 24))
        });
    }

    /**
     * 创建当前位置标记
     * @param {Object} point - 坐标点
     */
    addCurrentLocationMarker(point) {
        return this.addMarkerWithLabel(
            point,
            `当前位置（${point.lng.toFixed(6)}, ${point.lat.toFixed(6)}）`,
            {
                icon: new window.BMap.Icon('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJDNi40OCAyIDIgNi40OCAyIDE2QzIgMjUuNTIgNi40OCAzMCAxNiAzMEMyNS41MiAzMCAzMCAyNS41MiAzMCAxNkMzMCA2LjQ4IDI1LjUyIDIgMTYgMloiIGZpbGw9IiMxOTc2ZDIiLz4KPHBhdGggZD0iTTE2IDhDOC45NiA4IDIgMTQuOTYgMiAyM0MyIDMxLjA0IDguOTYgMzggMTYgMzhDMjMuMDQgMzggMzAgMzEuMDQgMzAgMjNDMzAgMTQuOTYgMjMuMDQgOCAxNiA4WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+', new window.BMap.Size(32, 32)),
                label: new window.BMap.Label(`当前位置（${point.lng.toFixed(6)}, ${point.lat.toFixed(6)}）`, {
                    offset: new window.BMap.Size(0, -40),
                    style: {
                        color: '#1976d2',
                        fontSize: '12px',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        border: '1px solid #1976d2',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontWeight: 'bold'
                    }
                })
            }
        );
    }

    /**
     * 绘制完整轨迹
     * @param {Array} trajectoryData - 轨迹数据
     * @param {number} currentIndex - 当前点索引
     */
    drawTrajectory(trajectoryData, currentIndex = 0) {
        if (!this.isInitialized || !trajectoryData || trajectoryData.length === 0) {
            return;
        }

        this.clearOverlays();

        // 转换数据格式
        const points = trajectoryData.map(item => ({
            lng: parseFloat(item.经度 || item.longitude || 0),
            lat: parseFloat(item.纬度 || item.latitude || 0)
        })).filter(point => !isNaN(point.lng) && !isNaN(point.lat));

        if (points.length === 0) {
            console.warn('没有有效的坐标点');
            return;
        }

        // 添加起点和终点标记
        this.addStartMarker(points[0]);
        this.addEndMarker(points[points.length - 1]);

        // 添加当前点标记
        if (currentIndex >= 0 && currentIndex < points.length) {
            this.addCurrentLocationMarker(points[currentIndex]);
        }

        // 绘制轨迹线
        if (points.length > 1) {
            // 绘制当前点之前的轨迹（绿色）
            if (currentIndex > 0) {
                const beforePoints = points.slice(0, currentIndex + 1);
                this.drawPolyline(beforePoints, {
                    strokeColor: '#00FF00',
                    strokeWeight: 4,
                    strokeOpacity: 1
                });
            }

            // 绘制当前点之后的轨迹（灰色）
            if (currentIndex < points.length - 1) {
                const afterPoints = points.slice(currentIndex);
                this.drawPolyline(afterPoints, {
                    strokeColor: '#CCCCCC',
                    strokeWeight: 2,
                    strokeOpacity: 0.6
                });
            }
        }

        // 调整视野
        this.fitBounds(points);

        // 居中到当前点
        if (currentIndex >= 0 && currentIndex < points.length) {
            this.setCenter(points[currentIndex], 15);
        }
    }

    /**
     * 销毁地图
     */
    destroy() {
        if (this.map) {
            this.clearOverlays();
            this.map = null;
            this.isInitialized = false;
        }
    }
}

// 创建全局地图管理器实例
window.mapManager = new MapManager();