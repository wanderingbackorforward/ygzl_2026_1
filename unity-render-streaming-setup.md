# Unity Render Streaming 设置指南

此指南说明如何设置Unity Render Streaming与网页客户端进行通信。

## 前提条件

1. Unity 2020.3或更高版本
2. 已安装的Unity Render Streaming包 (2.0.0或更高版本)

## 步骤1: 安装Unity Render Streaming包

1. 打开Unity项目
2. 依次点击 Window > Package Manager
3. 点击左上角的 "+" 按钮
4. 选择 "Add package from git URL..."
5. 输入 `com.unity.renderstreaming` 然后点击 "Add"
6. 等待包安装完成

## 步骤2: 设置信令服务器

1. 使用提供的 `signaling-server.js` 运行信令服务器:
   ```bash
   node signaling-server.js
   ```

2. 服务器将在 `ws://localhost:80/signaling` 运行

## 步骤3: 在Unity中设置场景

1. 创建一个空的游戏对象并命名为 "RenderStreamingManager"
2. 添加 `SimpleRenderStreaming` 组件 (已创建)
3. 确保场景中有一个摄像机，并将其拖拽到 `SimpleRenderStreaming` 组件的 "Streaming Camera" 字段中
4. 添加以下组件到 "RenderStreamingManager" 游戏对象:
   - `RenderStreaming` 组件
   - `WebSocketSignalingModule` 组件，并设置URL为 `ws://localhost:80/signaling`

5. 在场景中的摄像机上添加 `VideoStreamSender` 组件

## 步骤4: 配置焦点位置

在 `SimpleRenderStreaming` 组件中设置焦点位置:

1. 展开 "Focus Points" 列表
2. 添加以下焦点位置:
   - ID: "S1", Position: (0, 1, 0)
   - ID: "S2", Position: (5, 1, 0)
   - ID: "S3", Position: (0, 1, 5)
   - ID: "S25", Position: (-5, 1, 0)

## 步骤5: 连接网页客户端

1. 在浏览器中打开 `unity_test.html` 网页
2. 确保信令服务器URL设置为 `ws://localhost:80/signaling`
3. 点击 "连接到Unity" 按钮
4. 若连接成功，你会看到Unity的摄像机画面在网页中显示
5. 使用焦点位置按钮 (S1, S2, S3, S25) 可以控制Unity中的摄像机位置

## 位置控制消息格式

网页客户端发送给Unity的消息格式如下:

```json
// 移动到焦点位置
{
  "type": "focusPoint",
  "pointId": "S1"  // 可以是 S1, S2, S3, S25
}

// 重置视图
{
  "type": "resetView"
}
```

## 故障排除

1. 确保信令服务器正在运行
2. 检查Unity控制台中的错误信息
3. 确保网页中的信令服务器URL与实际运行的URL一致
4. 检查防火墙设置，确保端口80未被阻止
5. 如果连接失败，尝试重启Unity和信令服务器 