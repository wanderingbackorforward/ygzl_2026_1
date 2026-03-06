/**
 * API 接口管理
 */
class ApiManager {
    constructor() {
        this.baseUrl = '/api/shield';
    }

    /**
     * 计算轨迹
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} 响应数据
     */
    async calculateTrajectory(data) {
        try {
            const response = await fetch(`${this.baseUrl}/trajectory/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * 获取服务器状态
     * @returns {Promise<Object>} 服务器状态
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/trajectory/status`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Status API Error:', error);
            throw error;
        }
    }

    /**
     * 导入数据文件
     * @param {File} file - 要导入的文件
     * @returns {Promise<Object>} 导入结果
     */
    async importData(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/data/import`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Import Data API Error:', error);
            throw error;
        }
    }

    /**
     * 获取已导入的数据文件列表
     * @returns {Promise<Object>} 文件列表
     */
    async getDataList() {
        try {
            const response = await fetch(`${this.baseUrl}/data/list`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Data List API Error:', error);
            throw error;
        }
    }

    /**
     * 加载指定的导入数据
     * @param {string} filename - 文件名
     * @returns {Promise<Object>} 数据内容
     */
    async loadData(filename) {
        try {
            const response = await fetch(`${this.baseUrl}/data/load/${encodeURIComponent(filename)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Load Data API Error:', error);
            throw error;
        }
    }

    /**
     * 获取图片URL
     * @param {string} imagePath - 图片路径
     * @returns {string} 完整的图片URL
     */
    getImageUrl(imagePath) {
        if (!imagePath) return '';

        // 如果是完整URL，直接返回
        if (imagePath.startsWith('http')) {
            return imagePath;
        }

        // 如果是相对路径，拼接服务器地址
        if (imagePath.startsWith('/static/')) {
            return imagePath;
        }

        // 其他情况，当作静态文件处理
        return `/static/${imagePath}`;
    }
}

// 创建全局API管理器实例
window.apiManager = new ApiManager();