# WebSocket Client

一个功能强大的 WebSocket 客户端，支持自动重连、心跳检测、消息缓存、认证等功能。

## 特性

- 🔄 自动重连机制
- 💓 可配置的心跳检测
- 📦 消息缓存功能
- 🔐 认证支持
- 📊 连接状态统计
- 🔄 单例模式支持
- 📨 二进制数据支持
- ⏱️ 超时处理
- 🚀 Promise 风格的 API

## 安装

```bash
npm install @your-org/websocket-client
# 或
yarn add @your-org/websocket-client
# 或
pnpm add @your-org/websocket-client
```

## 使用方法

### 基本用法

```javascript
import WebSocketClient from '@your-org/websocket-client';

// 创建实例
const ws = new WebSocketClient('ws://example.com', {
  autoConnect: true, // 自动连接
  clientId: 'client-123',
});

// 监听事件
ws.on('open', (stats) => {
  console.log('Connected!', stats);
});

ws.on('message', (data) => {
  console.log('Received:', data);
});

ws.on('error', (errorInfo) => {
  console.error('Error:', errorInfo);
});

// 发送消息
ws.send({ type: 'message', content: 'Hello' });
```

### 使用单例模式

```javascript
// 获取单例实例
const ws1 = WebSocketClient.getInstance('ws://example.com', {
  singleton: true,
  clientId: 'client-123',
});

// 再次获取相同的实例
const ws2 = WebSocketClient.getInstance('ws://example.com', {
  singleton: true,
  clientId: 'client-123',
});

console.log(ws1 === ws2); // true

// 销毁单例实例
WebSocketClient.destroyInstance('ws://example.com', {
  singleton: true,
  clientId: 'client-123',
});

// 销毁所有实例
WebSocketClient.destroyAllInstances();
```

### 认证

```javascript
const ws = new WebSocketClient('ws://example.com', {
  authToken: 'your-auth-token',
  clientId: 'client-123',
});

ws.on('auth', ({ success }) => {
  console.log('Authentication:', success ? 'successful' : 'failed');
});
```

### 消息缓存

```javascript
const ws = new WebSocketClient('ws://example.com', {
  enableMessageCache: true,
  maxCacheSize: 100,
});

// 获取缓存的消息
const cachedMessages = ws.getCachedMessages();

// 清空缓存
ws.clearMessageCache();
```

### 二进制数据

```javascript
const ws = new WebSocketClient('ws://example.com', {
  binaryType: 'blob', // 或 'arraybuffer'
});

// 发送二进制数据
const binaryData = new Blob(['Hello, World!']);
ws.sendBinary(binaryData);

// 监听二进制数据
ws.on('binary', (data) => {
  console.log('Received binary data:', data);
});
```

## API 文档

### 构造函数

```javascript
new WebSocketClient(url, options);
```

#### 参数

- `url`: WebSocket 服务器地址
- `options`: 配置对象
  - `reconnectInterval`: 重连间隔时间（毫秒），默认 3000
  - `heartbeatInterval`: 心跳间隔时间（毫秒），默认 30000
  - `maxReconnectAttempts`: 最大重连次数，默认 5
  - `enableReconnect`: 是否启用重连，默认 true
  - `infiniteReconnect`: 是否无限重连，默认 false
  - `enableMessageCache`: 是否启用消息缓存，默认 false
  - `maxCacheSize`: 最大缓存消息数量，默认 100
  - `clientId`: 客户端ID
  - `authToken`: 认证token
  - `heartbeatData`: 自定义心跳数据
  - `binaryType`: 二进制数据类型，'blob' 或 'arraybuffer'，默认 'blob'
  - `autoConnect`: 是否自动连接，默认 false
  - `singleton`: 是否使用单例模式，默认 false

### 静态方法

- `WebSocketClient.getInstance(url, options)`: 获取单例实例
- `WebSocketClient.destroyInstance(url, options)`: 销毁单例实例
- `WebSocketClient.destroyAllInstances()`: 销毁所有实例

### 实例方法

- `connect()`: 建立连接
- `disconnect()`: 断开连接
- `send(data, options)`: 发送消息
- `sendBinary(data, options)`: 发送二进制数据
- `on(event, callback)`: 监听事件
- `off(event, callback)`: 取消监听事件
- `getConnectionStats()`: 获取连接统计信息
- `getCachedMessages()`: 获取缓存的消息
- `clearMessageCache()`: 清空消息缓存

### 事件

- `open`: 连接建立
- `close`: 连接关闭
- `message`: 收到消息
- `error`: 发生错误
- `reconnect`: 重连尝试
- `auth`: 认证结果
- `heartbeat`: 心跳发送
- `binary`: 收到二进制数据

## 错误处理

错误事件会提供以下信息：

```typescript
interface ErrorInfo {
  type: WebSocketErrorType;
  error: Error;
  timestamp: Date;
  connectionStats: ConnectionStats;
}
```

## 许可证

MIT
