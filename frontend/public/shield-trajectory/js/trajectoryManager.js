/**
 * 轨迹数据管理器
 */
class TrajectoryManager {
    constructor() {
        this.trajectoryData = [];
        this.currentPointIndex = 0;
        this.isPlaying = false;
        this.playbackTimer = null;
        this.playStep = 1;
        this.frameInterval = 500;
        this.maxPoints = 10000;
        this.chartImages = [];
        this.currentChartIndex = 0;

        // 表格相关
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalPages = 1;

        // 导入数据相关
        this.importedData = null;
        this.importedFiles = [];

        // 列名定义
        this.columns = [
            '推进油缸总推力(kN)', '刀盘扭矩(kN·m)', '刀盘转速(rpm)', '切口水压(bar)',
            '送泥流量F1(m3/min)', '排泥流量F2(m3/min)', '贯入度(mm/r)', '推进平均速度(mm/min)',
            '推进区间的压力（下）(MPa)', '推进区间的压力（上）(MPa)', '推进区间的压力（右上）(MPa)', '推进区间的压力（右下）(MPa)',
            '推进区间的压力（左下）(MPa)', '推进区间的压力（左上）(MPa)',
            '盾尾垂直偏差(mm)', '盾尾水平偏差(mm)', '盾头垂直偏差(mm)', '盾头水平偏差(mm)',
            '盾头坐标N(m)', '盾头坐标E(m)', '盾头坐标Z(m)',
            '经度', '纬度'
        ];

        // 事件监听器
        this.eventListeners = new Map();
    }

    /**
     * 设置轨迹数据
     * @param {Array} data - 轨迹数据
     */
    setTrajectoryData(data) {
        this.trajectoryData = this.validateAndFixData(data);
        this.currentPointIndex = 0;
        this.currentPage = 1;
        this.updatePagination();
        this.emit('dataChanged', this.trajectoryData);
    }

    /**
     * 设置导入的数据
     * @param {Object} data - 导入的数据对象
     */
    setImportedData(data) {
        console.log('setImportedData called with:', data);

        if (!data) {
            console.error('导入的数据为空');
            return;
        }

        // 处理直接传入数组的情况
        let dataArray = data;
        if (data.data && Array.isArray(data.data)) {
            dataArray = data.data;
        } else if (!Array.isArray(data)) {
            console.error('导入的数据格式无效，需要数组或包含data字段的对象:', data);
            return;
        }

        // 保存导入的数据
        this.importedData = {
            data: dataArray,
            filename: data.filename || 'imported_data',
            importTime: new Date().toISOString()
        };

        console.log('处理导入数据，数组长度:', dataArray.length);

        // 处理导入的数据
        const processedData = this.validateAndFixData(dataArray);
        console.log('验证后的数据长度:', processedData.length);

        // 如果数据是数组格式，需要转换为对象格式
        const mappedData = processedData.map((item, index) => {
            const mappedItem = {};

            if (Array.isArray(item)) {
                // 如果是数组格式，按索引映射到字段
                if (item.length >= 23) {
                    mappedItem['推进油缸总推力(kN)'] = item[0];
                    mappedItem['刀盘扭矩(kN·m)'] = item[1];
                    mappedItem['刀盘转速(rpm)'] = item[2];
                    mappedItem['切口水压(bar)'] = item[3];
                    mappedItem['送泥流量F1(m3/min)'] = item[4];
                    mappedItem['排泥流量F2(m3/min)'] = item[5];
                    mappedItem['贯入度(mm/r)'] = item[6];
                    mappedItem['推进平均速度(mm/min)'] = item[7];
                    mappedItem['推进区间的压力（下）(MPa)'] = item[8];
                    mappedItem['推进区间的压力（上）(MPa)'] = item[9];
                    mappedItem['推进区间的压力（右上）(MPa)'] = item[10];
                    mappedItem['推进区间的压力（右下）(MPa)'] = item[11];
                    mappedItem['推进区间的压力（左下）(MPa)'] = item[12];
                    mappedItem['推进区间的压力（左上）(MPa)'] = item[13];
                    mappedItem['盾尾垂直偏差(mm)'] = item[14];
                    mappedItem['盾尾水平偏差(mm)'] = item[15];
                    mappedItem['盾头垂直偏差(mm)'] = item[16];
                    mappedItem['盾头水平偏差(mm)'] = item[17];
                    mappedItem['盾头坐标N(m)'] = item[18];
                    mappedItem['盾头坐标E(m)'] = item[19];
                    mappedItem['盾头坐标Z(m)'] = item[20];
                    mappedItem['经度'] = item[21];
                    mappedItem['纬度'] = item[22];
                } else {
                    console.warn(`第${index}行数据字段不足，只有${item.length}个字段`);
                    // 填充缺失的字段
                    for (let i = 0; i < 23; i++) {
                        const fieldName = this.columns[i];
                        mappedItem[fieldName] = i < item.length ? item[i] : 0;
                    }
                }
            } else if (typeof item === 'object' && item !== null) {
                // 如果是对象格式，尝试映射常见字段
                const fieldMappings = {
                    // 推进相关
                    '推力': '推进油缸总推力(kN)',
                    '推进力': '推进油缸总推力(kN)',
                    'total_thrust': '推进油缸总推力(kN)',
                    'torque': '刀盘扭矩(kN·m)',
                    '刀盘力矩': '刀盘扭矩(kN·m)',
                    'speed': '刀盘转速(rpm)',
                    '刀盘速度': '刀盘转速(rpm)',
                    'penetration': '贯入度(mm/r)',
                    '贯入': '贯入度(mm/r)',
                    'velocity': '推进平均速度(mm/min)',
                    '速度': '推进平均速度(mm/min)',

                    // 位置相关
                    'pitch': '盾尾垂直偏差(mm)',
                    'roll': '盾尾水平偏差(mm)',
                    'yaw': '盾头垂直偏差(mm)',
                    'heading': '盾头水平偏差(mm)',
                    'x': '盾头坐标N(m)',
                    'y': '盾头坐标E(m)',
                    'z': '盾头坐标Z(m)',
                    'lng': '经度',
                    'lat': '纬度',
                    'longitude': '经度',
                    'latitude': '纬度',

                    // 压力相关
                    'pressure1': '推进区间的压力（下）(MPa)',
                    'pressure2': '推进区间的压力（上）(MPa)',
                    'pressure3': '推进区间的压力（右上）(MPa)',
                    'pressure4': '推进区间的压力（右下）(MPa)',
                    'pressure5': '推进区间的压力（左下）(MPa)',
                    'pressure6': '推进区间的压力（左上）(MPa)',

                    // 流量相关
                    'flow1': '送泥流量F1(m3/min)',
                    'flow2': '排泥流量F2(m3/min)',
                    'inflow': '送泥流量F1(m3/min)',
                    'outflow': '排泥流量F2(m3/min)',

                    // 水压相关
                    'water_pressure': '切口水压(bar)',
                    '水压': '切口水压(bar)'
                };

                // 首先使用原始字段名
                this.columns.forEach(col => {
                    if (item[col] !== undefined) {
                        mappedItem[col] = item[col];
                    }
                });

                // 然后尝试映射字段
                for (const [originalField, targetField] of Object.entries(fieldMappings)) {
                    if (item[originalField] !== undefined && mappedItem[targetField] === undefined) {
                        mappedItem[targetField] = item[originalField];
                    }
                }

                // 填充缺失的字段
                this.columns.forEach(col => {
                    if (mappedItem[col] === undefined) {
                        mappedItem[col] = 0;
                    }
                });
            } else {
                console.warn(`第${index}行数据格式无效:`, item);
                // 创建默认数据
                this.columns.forEach(col => {
                    mappedItem[col] = 0;
                });
            }

            return mappedItem;
        });

        this.trajectoryData = mappedData;
        this.currentPointIndex = 0;
        this.currentPage = 1;
        this.updatePagination();
        console.log('轨迹数据已设置，数据长度:', this.trajectoryData.length);
        this.emit('dataChanged', this.trajectoryData);
        this.emit('importedDataChanged', this.importedData);
    }

    /**
     * 设置导入的文件列表
     * @param {Array} files - 导入的文件列表
     */
    setImportedFiles(files) {
        this.importedFiles = files || [];
        this.emit('importedFilesChanged', this.importedFiles);
    }

    /**
     * 获取当前输入数据（优先使用导入的数据）
     * @returns {Object|null} 当前输入数据
     */
    getCurrentInputData() {
        // 如果有导入的数据，优先使用导入的数据
        if (this.importedData) {
            return {
                data: this.importedData.data,
                filename: this.importedData.filename || 'imported_data',
                isImported: true
            };
        }

        // 否则返回空对象，表示需要从API获取数据
        return {
            data: [],
            filename: 'api_data',
            isImported: false
        };
    }

    /**
     * 验证和修复数据
     * @param {Array} data - 原始数据
     * @returns {Array} 修复后的数据
     */
    validateAndFixData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('轨迹数据为空或无效');
            return [];
        }

        return data.map((item, index) => {
            if (Array.isArray(item)) {
                // 如果是数组格式，转换为对象
                const row = {};
                this.columns.forEach((col, idx) => {
                    row[col] = item[idx] !== undefined ? item[idx] : '';
                });
                return row;
            } else if (typeof item === 'object' && item !== null) {
                // 如果是对象格式，直接返回
                return item;
            } else {
                console.warn(`第${index}行数据格式无效:`, item);
                return {};
            }
        }).filter(row => Object.keys(row).length > 0);
    }

    /**
     * 设置图表图片
     * @param {Array} images - 图片数组
     */
    setChartImages(images) {
        this.chartImages = images || [];
        this.currentChartIndex = 0;
        this.emit('chartImagesChanged', this.chartImages);
    }

    /**
     * 获取当前轨迹点
     * @returns {Object|null} 当前轨迹点
     */
    getCurrentPoint() {
        if (this.trajectoryData.length === 0 ||
            this.currentPointIndex < 0 ||
            this.currentPointIndex >= this.trajectoryData.length) {
            return null;
        }
        return this.trajectoryData[this.currentPointIndex];
    }

    /**
     * 获取有效坐标数量
     * @returns {number} 有效坐标数量
     */
    getValidCoordinateCount() {
        return this.trajectoryData.filter(item => {
            const lng = parseFloat(item.经度 || item.longitude || 0);
            const lat = parseFloat(item.纬度 || item.latitude || 0);
            return !isNaN(lng) && !isNaN(lat);
        }).length;
    }

    /**
     * 获取坐标范围
     * @returns {string} 坐标范围描述
     */
    getCoordinateRange() {
        const validCoords = this.trajectoryData.filter(item => {
            const lng = parseFloat(item.经度 || item.longitude || 0);
            const lat = parseFloat(item.纬度 || item.latitude || 0);
            return !isNaN(lng) && !isNaN(lat);
        });

        if (validCoords.length === 0) {
            return '无有效坐标';
        }

        const lngs = validCoords.map(item => parseFloat(item.经度 || item.longitude || 0));
        const lats = validCoords.map(item => parseFloat(item.纬度 || item.latitude || 0));

        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        return `经度: ${minLng.toFixed(6)} ~ ${maxLng.toFixed(6)}, 纬度: ${minLat.toFixed(6)} ~ ${maxLat.toFixed(6)}`;
    }

    /**
     * 获取进度条最大值
     * @returns {number} 进度条最大值
     */
    getProgressMax() {
        const maxAllowed = Math.min(10000, this.maxPoints);
        return Math.min(this.trajectoryData.length - 1, maxAllowed - 1);
    }

    /**
     * 设置当前点索引
     * @param {number} index - 索引值
     */
    setCurrentPointIndex(index) {
        const maxIndex = this.getProgressMax();
        this.currentPointIndex = Math.min(Math.max(0, index), maxIndex);
        this.emit('currentPointChanged', this.currentPointIndex);
    }

    /**
     * 开始播放
     */
    startPlayback() {
        if (this.isPlaying) {
            return;
        }

        this.isPlaying = true;
        this.emit('playbackStarted');

        this.playbackTimer = setInterval(() => {
            const maxIndex = this.getProgressMax();
            let nextIndex = this.currentPointIndex + this.playStep;

            if (nextIndex >= maxIndex) {
                nextIndex = maxIndex;
                this.stopPlayback();
            }

            this.setCurrentPointIndex(nextIndex);
        }, this.frameInterval);
    }

    /**
     * 停止播放
     */
    stopPlayback() {
        if (this.playbackTimer) {
            clearInterval(this.playbackTimer);
            this.playbackTimer = null;
        }

        this.isPlaying = false;
        this.emit('playbackStopped');
    }

    /**
     * 重置到起点
     */
    resetToStart() {
        this.setCurrentPointIndex(0);
        this.emit('resetToStart');
    }

    /**
     * 更新分页信息
     */
    updatePagination() {
        this.totalPages = Math.max(1, Math.ceil(this.trajectoryData.length / this.pageSize));
        this.emit('paginationChanged', {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalRecords: this.trajectoryData.length
        });
    }

    /**
     * 获取当前页数据
     * @returns {Array} 当前页数据
     */
    getCurrentPageData() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.trajectoryData.slice(start, end);
    }

    /**
     * 跳转到指定页
     * @param {number} page - 页码
     */
    goToPage(page) {
        if (page < 1) page = 1;
        if (page > this.totalPages) page = this.totalPages;

        this.currentPage = page;
        this.emit('pageChanged', this.currentPage);
    }

    /**
     * 上一页
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    /**
     * 下一页
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    /**
     * 获取当前图表图片
     * @returns {Object|null} 当前图表图片
     */
    getCurrentChartImage() {
        if (this.chartImages.length === 0) {
            return null;
        }
        return this.chartImages[this.currentChartIndex];
    }

    /**
     * 设置当前图表索引
     * @param {number} index - 图表索引
     */
    setCurrentChartIndex(index) {
        if (index < 0) index = 0;
        if (index >= this.chartImages.length) index = this.chartImages.length - 1;

        this.currentChartIndex = index;
        this.emit('currentChartChanged', this.currentChartIndex);
    }

    /**
     * 上一张图表
     */
    prevChart() {
        this.setCurrentChartIndex(this.currentChartIndex - 1);
    }

    /**
     * 下一张图表
     */
    nextChart() {
        this.setCurrentChartIndex(this.currentChartIndex + 1);
    }

    /**
     * 清空数据
     */
    clearData() {
        this.stopPlayback();
        this.trajectoryData = [];
        this.currentPointIndex = 0;
        this.currentPage = 1;
        this.chartImages = [];
        this.currentChartIndex = 0;
        this.importedData = null;
        this.importedFiles = [];
        this.updatePagination();
        this.emit('dataCleared');
    }

    /**
     * 添加事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件处理器错误 (${event}):`, error);
                }
            });
        }
    }

    /**
     * 获取状态信息
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            hasData: this.trajectoryData.length > 0,
            dataLength: this.trajectoryData.length,
            currentPointIndex: this.currentPointIndex,
            maxPoints: this.getProgressMax(),
            isPlaying: this.isPlaying,
            playStep: this.playStep,
            frameInterval: this.frameInterval,
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            chartImagesCount: this.chartImages.length,
            currentChartIndex: this.currentChartIndex,
            validCoordinates: this.getValidCoordinateCount(),
            coordinateRange: this.getCoordinateRange(),
            hasImportedData: this.importedData !== null,
            importedDataInfo: this.importedData ? {
                filename: this.importedData.filename || 'unknown',
                recordCount: this.importedData.data ? this.importedData.data.length : 0,
                importTime: this.importedData.importTime || new Date().toISOString()
            } : null,
            importedFilesCount: this.importedFiles.length
        };
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.stopPlayback();
        this.clearData();
        this.eventListeners.clear();
    }
}

// 创建全局轨迹管理器实例
window.trajectoryManager = new TrajectoryManager();