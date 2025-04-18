# Unity Render Streaming 实现指南

本文档提供了如何在Unity项目中实现高级Render Streaming功能的详细说明。

## 1. 架构概述

Unity Render Streaming的高级版本使用以下架构:

```
+------------------+     WebRTC      +------------------+
|    Unity应用     | <-------------> |    网页浏览器    |
+------------------+                 +------------------+
        |
        | 内置
        v
+------------------+
|    Web服务器     |
+------------------+
```

特点:
- 直接从Unity启动Web服务器
- 使用WebRTC进行视频流和数据通道通信
- 内置信令服务器，无需外部服务

## 2. 安装必要组件

1. 确保你的Unity版本至少为2022.1
2. 安装Unity Render Streaming包:
   - Window > Package Manager
   - "+" > "Add package from git URL..."
   - 输入: `com.unity.renderstreaming`

## 3. 核心组件

在实现中，我们需要几个关键组件:

### 3.1 RenderStreaming组件

添加到场景的GameObject上，负责初始化WebRTC和信令服务:

```csharp
using UnityEngine;
using Unity.RenderStreaming;

public class RSController : MonoBehaviour
{
    private RenderStreaming renderStreaming;
    
    void Start()
    {
        renderStreaming = GetComponent<RenderStreaming>();
        if (renderStreaming == null)
            renderStreaming = gameObject.AddComponent<RenderStreaming>();
            
        // 配置RenderStreaming组件
        renderStreaming.runOnAwake = true;
        
        // 事件监听
        renderStreaming.onCreatedConnection += OnCreatedConnection;
    }
    
    void OnCreatedConnection(string connectionId, RTCDataChannel channel)
    {
        Debug.Log($"创建连接: {connectionId}");
        if (channel != null)
        {
            // 设置数据通道消息处理
            channel.OnMessage += bytes => HandleDataChannelMessage(connectionId, bytes);
        }
    }
    
    void HandleDataChannelMessage(string connectionId, byte[] bytes)
    {
        string message = System.Text.Encoding.UTF8.GetString(bytes);
        Debug.Log($"收到消息: {message}");
        
        // 处理摄像机控制消息
        var cameraController = FindObjectOfType<CameraController>();
        if (cameraController != null)
        {
            cameraController.ReceiveMessage(message);
        }
    }
}
```

### 3.2 HttpServer组件

提供Web界面服务:

```csharp
using UnityEngine;
using Unity.RenderStreaming;

public class WebServerController : MonoBehaviour
{
    [SerializeField] private int port = 80;
    
    private HttpServer httpServer;
    
    void Start()
    {
        httpServer = new HttpServer(port, "", false);
        httpServer.Start();
        
        Debug.Log($"Web服务器启动在端口: {port}");
    }
    
    void OnDestroy()
    {
        if (httpServer != null)
        {
            httpServer.Stop();
            Debug.Log("Web服务器已停止");
        }
    }
}
```

### 3.3 VideoStreamSender组件

添加到摄像机上，负责视频流:

```csharp
// 在Inspector中配置
// 1. 在Camera上添加VideoStreamSender组件
// 2. 设置编码器、分辨率、帧率和比特率
```

### 3.4 CameraController组件

处理摄像机位置控制:

```csharp
// 我们已经创建了完整的CameraController.cs脚本
// 它处理通过WebRTC数据通道接收的摄像机移动消息
```

## 4. 完整设置流程

1. 创建空GameObject命名为"RenderStreamingManager"
2. 添加RenderStreaming组件
3. 添加一个空GameObject命名为"WebServer"
4. 添加WebServerController脚本
5. 创建一个空GameObject命名为"CameraController"
6. 添加CameraController脚本
7. 找到场景中的主摄像机，添加VideoStreamSender组件

## 5. Web界面说明

Unity Render Streaming包中包含默认的Web界面，位于:
`Packages/com.unity.renderstreaming/Runtime/WebApp/`

要自定义Web界面:
1. 将这些文件复制到你的项目中
2. 修改HTML和JavaScript以支持你的特定需求
3. 在WebServerController中指向新的Web文件夹路径

## 6. 调试指南

当遇到问题时:

1. 检查Unity控制台输出
2. 验证RenderStreaming组件配置
3. 确认Web服务器正常运行
4. 使用浏览器开发工具检查网络状态和WebRTC连接
5. 尝试不同端口，如果默认端口被占用

## 7. 生产环境注意事项

对于生产环境:

1. 考虑配置HTTPS和SSL证书
2. 实现身份验证机制
3. 优化视频流分辨率和比特率
4. 考虑添加连接状态监控和自动重连机制

## 8. 进一步阅读

- Unity Render Streaming官方文档: [链接](https://docs.unity3d.com/Packages/com.unity.renderstreaming@3.1/manual/index.html)
- WebRTC标准: [链接](https://webrtc.org/)
- Unity官方示例项目: [链接](https://github.com/Unity-Technologies/UnityRenderStreaming)