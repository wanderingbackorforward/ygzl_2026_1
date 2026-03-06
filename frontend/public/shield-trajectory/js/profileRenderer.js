/**
 * 剖面轨迹渲染器
 */
class ProfileRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.baseImage = null;
        this.isInitialized = false;
        this.anchors = {
            // PNG纵坐标：319像素 = Z=0, 576像素 = Z=-20
            z: {
                pngStart: 319,
                pngEnd: 576,
                zStart: 0,
                zEnd: -20
            },
            // PNG横坐标：513像素 = N起点, 883像素 = N终点
            n: {
                pngStart: 513,
                pngEnd: 883,
                nStart: 0,
                nEnd: 0
            }
        };
    }

    /**
     * 初始化剖面图渲染器
     */
    async init() {
        if (this.isInitialized) {
            return true;
        }

        try {
            this.canvas = document.getElementById('profile-canvas');
            if (!this.canvas) {
                console.error('剖面图画布不存在');
                return false;
            }

            this.ctx = this.canvas.getContext('2d');

            // 加载基础剖面图
            await this.loadBaseImage();

            this.isInitialized = true;
            console.log('剖面图渲染器初始化成功');
            return true;

        } catch (error) {
            console.error('剖面图渲染器初始化失败:', error);
            return false;
        }
    }

    /**
     * 加载基础剖面图
     */
    loadBaseImage() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.baseImage = img;

                // 设置画布尺寸为图片的原始尺寸
                this.canvas.width = img.naturalWidth;
                this.canvas.height = img.naturalHeight;

                // 重新获取上下文（因为尺寸改变了）
                this.ctx = this.canvas.getContext('2d');

                // 绘制基础图
                this.ctx.drawImage(img, 0, 0);

                resolve(img);
            };

            img.onerror = () => {
                console.error('基础剖面图加载失败');
                reject(new Error('基础剖面图加载失败'));
            };

            img.src = '/shield-trajectory/images/ProfileView.png';
        });
    }

    /**
     * 更新锚定点
     * @param {Array} trajectoryData - 轨迹数据
     */
    updateAnchors(trajectoryData) {
        if (!trajectoryData || trajectoryData.length === 0) {
            return;
        }

        // 计算N坐标的范围
        const nValues = trajectoryData
            .map(item => parseFloat(item['盾头坐标N(m)'] || 0))
            .filter(val => !isNaN(val));

        if (nValues.length > 0) {
            const minN = Math.min(...nValues);
            const maxN = Math.max(...nValues);

            this.anchors.n.nStart = minN;
            this.anchors.n.nEnd = maxN;
        }
    }

    /**
     * 物理坐标到PNG坐标的转换
     * @param {number} n - N坐标
     * @param {number} z - Z坐标
     * @returns {Object} PNG坐标 {x, y}
     */
    convertToPngCoordinates(n, z) {
        // 防止除零错误
        if (this.anchors.n.nEnd === this.anchors.n.nStart) {
            console.warn('N坐标范围为零，使用默认值');
            this.anchors.n.nEnd = this.anchors.n.nStart + 1;
        }

        if (this.anchors.z.zEnd === this.anchors.z.zStart) {
            console.warn('Z坐标范围为零，使用默认值');
            this.anchors.z.zEnd = this.anchors.z.zStart - 1;
        }

        // 横坐标转换：N坐标 → PNG像素
        const pngX = this.anchors.n.pngStart +
            (n - this.anchors.n.nStart) *
            (this.anchors.n.pngEnd - this.anchors.n.pngStart) /
            (this.anchors.n.nEnd - this.anchors.n.nStart);

        // 纵坐标转换：Z坐标 → PNG像素
        const pngY = this.anchors.z.pngStart +
            (z - this.anchors.z.zStart) *
            (this.anchors.z.pngEnd - this.anchors.z.pngStart) /
            (this.anchors.z.zEnd - this.anchors.z.zStart);

        return { x: pngX, y: pngY };
    }

    /**
     * 清除画布并重新绘制基础图
     */
    clearCanvas() {
        if (!this.ctx || !this.baseImage) {
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.baseImage, 0, 0);
    }

    /**
     * 绘制标记点
     * @param {Object} point - PNG坐标点
     * @param {string} label - 标签
     * @param {string} color - 颜色
     */
    drawMarker(point, label, color = '#1976d2') {
        if (!this.ctx) {
            return;
        }

        const ctx = this.ctx;

        // 绘制圆形标记
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // 绘制标签背景
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const padding = 8;
        const labelHeight = 24;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(
            point.x - textWidth / 2 - padding,
            point.y - 50 - labelHeight,
            textWidth + padding * 2,
            labelHeight + 8
        );

        // 绘制标签文字
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, point.x, point.y - 40);
    }

    /**
     * 绘制轨迹路径
     * @param {Array} points - PNG坐标点数组
     * @param {string} color - 线条颜色
     * @param {number} width - 线条宽度
     */
    drawPath(points, color = '#00FF00', width = 4) {
        if (!this.ctx || points.length < 2) {
            return;
        }

        const ctx = this.ctx;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    /**
     * 渲染轨迹
     * @param {Array} trajectoryData - 轨迹数据
     * @param {number} currentIndex - 当前点索引
     */
    renderTrajectory(trajectoryData, currentIndex = 0) {
        if (!this.isInitialized || !trajectoryData || trajectoryData.length === 0) {
            return;
        }

        // 更新锚定点
        this.updateAnchors(trajectoryData);

        // 清除画布并重新绘制基础图
        this.clearCanvas();

        // 转换数据为PNG坐标
        const points = trajectoryData
            .map(item => {
                const n = parseFloat(item['盾头坐标N(m)'] || 0);
                const z = parseFloat(item['盾头坐标Z(m)'] || 0);

                if (!isNaN(n) && !isNaN(z)) {
                    return this.convertToPngCoordinates(n, z);
                }
                return null;
            })
            .filter(point => point !== null);

        if (points.length === 0) {
            console.warn('没有有效的剖面坐标点');
            return;
        }

        // 绘制起点标记
        if (points[0]) {
            this.drawMarker(points[0], '起点', '#999');
        }

        // 绘制终点标记
        if (points[points.length - 1]) {
            this.drawMarker(points[points.length - 1], '终点', '#999');
        }

        // 绘制当前点标记
        if (currentIndex >= 0 && currentIndex < points.length && trajectoryData[currentIndex]) {
            const n = parseFloat(trajectoryData[currentIndex]['盾头坐标N(m)'] || 0);
            const z = parseFloat(trajectoryData[currentIndex]['盾头坐标Z(m)'] || 0);

            if (!isNaN(n) && !isNaN(z)) {
                const currentPoint = this.convertToPngCoordinates(n, z);
                this.drawMarker(currentPoint, '当前位置', '#1976d2');
            }
        }

        // 绘制轨迹线条
        if (points.length > 1) {
            // 绘制完整轨迹（绿色）
            this.drawPath(points, '#00FF00', 6);

            // 如果有当前点，重新绘制当前点之后的轨迹（灰色）
            if (currentIndex >= 0 && currentIndex < points.length - 1) {
                const afterPoints = points.slice(currentIndex);
                this.drawPath(afterPoints, '#CCCCCC', 4);
            }
        }
    }

    /**
     * 测试绘制功能
     */
    testDrawing() {
        if (!this.isInitialized) {
            console.error('渲染器未初始化');
            return;
        }

        this.clearCanvas();

        const ctx = this.ctx;

        // 测试绘制红色矩形
        ctx.fillStyle = 'red';
        ctx.fillRect(50, 50, 100, 50);

        // 测试绘制蓝色线条
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(200, 100);
        ctx.lineTo(400, 200);
        ctx.stroke();

        // 测试绘制绿色圆形
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(300, 300, 30, 0, 2 * Math.PI);
        ctx.fill();

        console.log('剖面图渲染器测试完成');
    }

    /**
     * 获取起点信息
     * @param {Array} trajectoryData - 轨迹数据
     * @returns {string} 起点信息
     */
    getStartPointInfo(trajectoryData) {
        if (!trajectoryData || trajectoryData.length === 0) {
            return '无数据';
        }

        const start = trajectoryData[0];
        const n = parseFloat(start['盾头坐标N(m)'] || 0);
        const z = parseFloat(start['盾头坐标Z(m)'] || 0);

        return `N:${n.toFixed(2)}, Z:${z.toFixed(2)}`;
    }

    /**
     * 获取终点信息
     * @param {Array} trajectoryData - 轨迹数据
     * @returns {string} 终点信息
     */
    getEndPointInfo(trajectoryData) {
        if (!trajectoryData || trajectoryData.length === 0) {
            return '无数据';
        }

        const end = trajectoryData[trajectoryData.length - 1];
        const n = parseFloat(end['盾头坐标N(m)'] || 0);
        const z = parseFloat(end['盾头坐标Z(m)'] || 0);

        return `N:${n.toFixed(2)}, Z:${z.toFixed(2)}`;
    }

    /**
     * 获取当前点信息
     * @param {Array} trajectoryData - 轨迹数据
     * @param {number} currentIndex - 当前点索引
     * @returns {string} 当前点信息
     */
    getCurrentPointInfo(trajectoryData, currentIndex) {
        if (!trajectoryData || trajectoryData.length === 0 ||
            currentIndex < 0 || currentIndex >= trajectoryData.length) {
            return '无数据';
        }

        const current = trajectoryData[currentIndex];
        const n = parseFloat(current['盾头坐标N(m)'] || 0);
        const z = parseFloat(current['盾头坐标Z(m)'] || 0);

        return `N:${n.toFixed(2)}, Z:${z.toFixed(2)}`;
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        this.canvas = null;
        this.ctx = null;
        this.baseImage = null;
        this.isInitialized = false;
    }
}

// 创建全局剖面图渲染器实例
window.profileRenderer = new ProfileRenderer();