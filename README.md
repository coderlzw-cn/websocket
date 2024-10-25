# 介绍

`@coderlzw/ws` 是一个灵活且功能丰富的 `WebSocket` 客户端(`node`、`browser`)类，用于与 `WebSocket` 服务器进行通信。它支持自动重连、消息缓存和事件监听等功能

# 安装

```shell
npm add @coderlzw/ws
// or
yarn add @coderlzw/ws
// or
pnpm add @coderlzw/ws
```

# WebSocketClient

## 特性

-   支持自动重连
-   消息缓存机制
-   支持发送和接收二进制数据
-   事件监听机制

## 用法

```javascript
import { WebSocketClient } from "@coderlzw/ws";

const ws = new WebSocketClient("ws://127.0.0.1:8080");
// 需要调用 connect 才会建立连接
ws.connect();
ws.on("open", (event) => {
    // ...
})
    .on("close", (closeEvent) => {
        // ...
    })
    .on("error", (event) => {
        // ...
    })
    .on("message", (messageEvent) => {
        // ...
    });
```

### 发送消息

```ts
/// 无回调函数
ws.sendMessage("hello");

// 有回调函数
ws.sendMessage<{ name: string }>({ name: "张三" }, (error, data) => {
    // error: null
    // data: { name: "张三", message_id: "xxxxx" }
});

// 异步
ws.sendMessageAsync<{ name: string }>({ name: "张三" }).then((data) => {
    // data: { name: "张三", message_id: "xxxxx"}
});
```

# WebSocketServer

```ts
import { WebSocketServer } from "@coderlzw/ws";

const ws = new WebSocketServer("ws://localhost:8080");

ws.connect();

ws.on("open", (instance) => {
    console.log("open", instance);
})
    .on("error", (instance, err) => {
        console.log("error", err);
    })
    .on("close", (instance, code, reason) => {
        console.log("close", event);
    })
    .on("message", (instance, data, isBinary) => {
        console.log("message", data, isBinary);
    });
```

# 贡献

如果你希望为这个项目做出贡献，请在 GitHub 上提交 [Issues](https://github.com/coderlzw-cn/client-ws/issues) 或 [Pull Requests](https://github.com/coderlzw-cn/client-ws/pulls)。

# 许可证

该项目使用 MIT 许可证 - 详情请参阅 [LICENSE](https://github.com/coderlzw-cn/client-ws/blob/main/LICENSE) 文件。
