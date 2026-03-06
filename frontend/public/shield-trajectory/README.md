# 盾构机轨迹展示系统 - 前端

基于现代Web技术的盾构机轨迹可视化前端应用。

## 功能特性

- 轨迹数据表格展示（支持分页）
- 轨迹图片展示（支持切换）
- 物理轨迹可视化：
  - 百度地图平面轨迹显示
  - 剖面轨迹图Canvas绘制
  - 进度条控制和播放功能
- 响应式设计，支持移动端
- 模块化架构，易于维护和扩展

## 技术栈

- HTML5 + CSS3 + JavaScript (ES6+)
- 百度地图API
- Canvas API
- 模块化设计

## 目录结构

```
frontend/
├── index.html              # 主页面
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── api.js             # API接口管理
│   ├── mapManager.js      # 百度地图管理
│   ├── profileRenderer.js # 剖面图渲染器
│   ├── trajectoryManager.js # 轨迹数据管理
│   └── main.js            # 主应用程序
├── images/
│   └── ProfileView.png    # 基础剖面图
└── README.md              # 说明文档
```

## 使用方法

### 直接访问
将frontend文件夹部署到Web服务器，通过浏览器访问index.html即可。

### 本地开发
可以使用任何HTTP服务器来运行，例如：

```bash
# 使用Python内置服务器
cd frontend
python -m http.server 8080

# 或使用Node.js的http-server
npx http-server -p 8080

# 或使用Live Server等VSCode插件
```

然后在浏览器中访问：http://localhost:8080

## 主要组件

### API管理器 (api.js)
- 封装与后端的HTTP通信
- 统一的错误处理
- 图片URL处理

### 地图管理器 (mapManager.js)
- 百度地图初始化和管理
- 轨迹点标记和线条绘制
- 地图视野控制

### 剖面图渲染器 (profileRenderer.js)
- Canvas绘制剖面轨迹
- 坐标转换算法
- 标记点和轨迹线绘制

### 轨迹管理器 (trajectoryManager.js)
- 轨迹数据管理
- 播放控制逻辑
- 分页功能
- 事件系统

### 主应用程序 (main.js)
- 应用程序入口
- UI事件处理
- 组件协调
- 状态管理

## API接口

### 计算轨迹
```javascript
const response = await apiManager.calculateTrajectory({
    type: 'trace',
    last_num: 10000,
    data: [/* 轨迹数据数组 */]
});
```

### 获取服务器状态
```javascript
const status = await apiManager.getStatus();
```

## 配置说明

### 百度地图API
在index.html中配置百度地图API密钥：
```html
<script type="text/javascript" src="https://api.map.baidu.com/api?v=3.0&ak=YOUR_API_KEY"></script>
```

### 后端服务地址
在api.js中配置后端服务地址：
```javascript
constructor() {
    this.baseUrl = 'http://localhost:5000/api';
}
```

## 样式特性

- 现代化UI设计
- 渐变色彩和阴影效果
- 响应式布局
- 平滑的动画过渡
- 移动端适配

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 开发说明

### 模块化设计
采用模块化设计，各组件职责清晰：
- API层：负责与后端通信
- UI层：负责用户界面交互
- 数据层：负责数据管理和状态维护
- 渲染层：负责地图和Canvas绘制

### 事件系统
轨迹管理器实现了事件系统，支持：
- 数据变化事件
- 播放状态事件
- 分页事件
- 自定义事件

### 错误处理
- 统一的错误提示机制
- 网络错误处理
- 组件加载失败处理
- 用户友好的错误信息

## 部署说明

### 生产环境部署
1. 确保后端服务已启动
2. 修改api.js中的baseUrl为生产环境地址
3. 将frontend文件夹内容部署到Web服务器
4. 确保静态资源（如ProfileView.png）可正常访问

### 代理配置
如果前后端不在同一域名下，需要配置代理：
- Nginx配置反向代理
- 开发服务器配置代理
- 后端配置CORS

## 性能优化

- 图片懒加载
- 事件委托
- 虚拟滚动（大数据量时）
- Canvas绘制优化
- 地图性能优化

## 故障排除

### 地图无法显示
1. 检查百度地图API密钥是否有效
2. 检查网络连接
3. 查看浏览器控制台错误信息

### 轨迹数据不显示
1. 检查后端服务是否正常运行
2. 检查API接口响应
3. 查看浏览器控制台网络请求

### 剖面图绘制异常
1. 检查ProfileView.png是否存在
2. 检查Canvas是否支持
3. 查看控制台绘制错误信息