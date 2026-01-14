const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Unity WebRTC信令服务器\n');
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ noServer: true });
const connections = new Map();

// 监听HTTP服务器的upgrade事件
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  
  if (pathname === '/signaling') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket连接处理
wss.on('connection', (ws) => {
  console.log('新客户端连接');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // 根据消息类型处理
      if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
        const connectionId = data.connectionId;
        
        if (data.type === 'offer') {
          // 存储offer方的WebSocket连接
          connections.set(connectionId, ws);
          console.log(`存储连接ID: ${connectionId}`);
          
          // 广播给其他客户端
          broadcastExcept(ws, message);
        } else if (connections.has(connectionId)) {
          // 将消息发送给指定的连接
          const targetWs = connections.get(connectionId);
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(message);
            console.log(`转发${data.type}消息到连接ID: ${connectionId}`);
          }
        }
      }
    } catch (e) {
      console.error('消息处理错误:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('客户端断开连接');
    
    // 移除关闭的连接
    connections.forEach((value, key) => {
      if (value === ws) {
        connections.delete(key);
        console.log(`移除连接ID: ${key}`);
      }
    });
  });
});

// 广播消息给除发送者外的所有连接
function broadcastExcept(sender, message) {
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 启动服务器
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`信令服务器运行在 http://localhost:${PORT}`);
  console.log(`WebSocket路径: ws://localhost:${PORT}/signaling`);
}); 