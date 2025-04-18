# Unity WebRTC渲染流项目

这是一个Unity WebRTC渲染流项目，实现了从Unity向网页客户端发送实时视频流，并通过网页客户端控制Unity中的摄像机位置。

## 已完成工作

1. 准备了网页客户端代码 (`static/unity_test.html`)，包含:
   - WebRTC视频接收
   - 信令服务器连接
   - 数据通道通信
   - 摄像机控制UI

2. 创建了信令服务器代码 (`signaling-server.js`):
   - WebSocket服务器实现
   - SDP交换处理
   - ICE候选交换处理
   - 连接管理

3. Unity脚本准备:
   - `SimpleRenderStreaming.cs` - 处理摄像机控制和焦点位置

## 接下来的步骤

要完全实现该功能，需要执行以下步骤:

1. 安装Unity Render Streaming包:
   ```
   com.unity.renderstreaming
   ```

2. 详细步骤请参考 `unity-render-streaming-setup.md` 文件，其中包含:
   - 安装Render Streaming包
   - 设置信令服务器
   - 配置Unity场景
   - 连接网页客户端

## 使用方法

1. 启动信令服务器:
   ```bash
   node signaling-server.js
   ```

2. 启动Unity项目并确保Render Streaming设置正确

3. 在浏览器中打开 `static/unity_test.html`

4. 点击 "连接到Unity" 按钮

5. 成功连接后，可以使用S1、S2、S3、S25按钮控制Unity中的摄像机位置

## 故障排除

参见 `unity-render-streaming-setup.md` 中的故障排除部分 