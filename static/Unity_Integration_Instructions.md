# Unity 与网页交互集成指南

本文档提供了如何在 Unity 项目中集成与网页交互功能的详细步骤，以实现在选择监测点时同步更新 Unity 模型视角。

## 一、Unity 项目配置

### 1. 添加控制脚本

1. 在 Unity 项目中创建一个名为 `MonitoringPointController.cs` 的脚本
2. 复制提供的脚本内容到该文件中
3. 将此脚本保存到 Assets/Scripts 文件夹下

### 2. 配置场景

1. 在 Unity 场景中找到或创建一个空的游戏对象，命名为 "Model"
2. 将 `MonitoringPointController.cs` 脚本添加到该游戏对象上
3. 在 Inspector 面板中配置脚本参数：
   - 设置 `Main Camera` 引用到场景的主摄像机
   - 如果已知监测点对象，将它们拖拽到 `Monitoring Points` 列表中
   - 调整 `Camera Lerp Speed`, `Camera Distance` 和 `Camera Height` 参数以获取理想的相机行为

### 3. 配置监测点

确保所有监测点游戏对象都正确命名为与 Web 前端匹配的 ID（如 "S1", "S2", "S3" 等）。对每个监测点：

1. 添加一个 Collider 组件（如果没有）- 球形碰撞器最为简单
2. 确保它们有可见的 Renderer 组件以便高亮显示
3. 可选：给所有监测点添加 "MonitoringPoint" 标签便于自动查找

### 4. WebGL 构建设置

1. 打开 Unity 的 Player Settings (Edit > Project Settings > Player)
2. 在 WebGL 选项卡下：
   - 启用 "Allow 'window.unitySendSelectedPoint' Access"
   - 设置 "Resolution and Presentation" > "WebGL Template" 为 "Minimal"
   - 确保 "Publishing Settings" > "Compression Format" 设置为 "Disabled" 或 "Gzip"

### 5. 生成 WebGL 构建

1. 选择 File > Build Settings
2. 选择 WebGL 平台
3. 点击 "Build" 或 "Build And Run"
4. 选择输出目录为网站的 `/static/Build` 文件夹

## 二、前端集成

Unity 构建完成后，确保以下文件已正确放置：

1. `/static/js/unity-loader.js` - 包含与 Unity 通信的 JavaScript 代码
2. `/static/Build/` - 包含 Unity WebGL 构建输出的文件夹

## 三、JavaScript 与 Unity 通信

### 通信原理

1. **JavaScript 到 Unity**：使用 `unityInstance.SendMessage('GameObject', 'Method', 'Parameter')` 方法
2. **Unity 到 JavaScript**：使用 `unitySendSelectedPoint()` 方法，需要在 Unity 中通过 `[DllImport("__Internal")]` 声明

### 主要通信功能

1. **聚焦到监测点**：
   ```javascript
   // 在 JS 中调用
   window.sendToUnity('Model', 'FocusOnPoint', pointId);
   ```

2. **旋转模型**：
   ```javascript
   // 向左旋转
   window.sendToUnity('Model', 'RotateLeft', '');
   
   // 向右旋转
   window.sendToUnity('Model', 'RotateRight', '');
   ```

3. **重置视图**：
   ```javascript
   window.sendToUnity('Model', 'ResetView', '');
   ```

4. **Unity 选中点位时更新 Web 界面**：
   ```javascript
   // 在 Unity 中调用，会触发此函数
   window.unitySendSelectedPoint = function(pointId) {
       console.log("Unity选中了点位: " + pointId);
       // 更新点位选择器及图表
   };
   ```

## 四、测试集成

1. 启动 Web 服务器
2. 在浏览器中打开网站
3. 测试通过左侧下拉菜单选择监测点，验证 Unity 视图是否聚焦到对应点位
4. 测试在 Unity 场景中点击监测点，验证 Web 界面是否更新选择和图表

## 五、故障排除

1. **Unity 与 JavaScript 通信失败**
   - 检查浏览器控制台是否有错误
   - 确认 Unity WebGL 构建设置正确
   - 验证 GameObject 和方法名称在 SendMessage 调用中拼写正确

2. **监测点无法点击**
   - 确保监测点有正确配置的碰撞器
   - 检查相机是否可以射线检测到监测点
   - 验证 MonitoringPointBehavior 组件已正确附加

3. **无法高亮显示监测点**
   - 确保监测点有 Renderer 组件
   - 检查材质是否支持颜色修改和发光效果

4. **相机移动不平滑**
   - 调整 cameraLerpSpeed 参数以获得更好的移动效果
   - 检查 Update 函数中的相机插值代码

如需更多帮助，请查看 Unity WebGL 文档和 JavaScript 集成指南。 