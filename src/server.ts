import WebSocket, {RawData} from "ws";
import {MessageCallback, Options, sendMessageQueueItem} from "./type";

export default class WebSocketServer {
    static #instance: WebSocketServer;
    #url: string;
    #ws: null | WebSocket = null;
    #options: Required<Options>;
    readonly #eventListeners: Record<string, Function[]> = {};  // 事件监听器  {open: [listener1, listener2]}
    readonly #messageCache: { data: any; callback?: MessageCallback }[] = [];  // 在没有连接的时候缓存消息
    #reconnectAttempts: number = 0;     // 重连次数
    #reconnectTimeout: ReturnType<typeof setTimeout> | null = null;  // 重连定时器
    readonly #sendMessageQueue: Record<string, sendMessageQueueItem> = {};  // 等待发送的消息队列
    #isHandleClose: boolean = false;  // 是否手动关闭的连接
    #timeoutTimerId: ReturnType<typeof setTimeout> | null = null;

    constructor(url: string, options?: Options) {
        if (!url) throw new Error("url is required");
        this.#url = url;
        this.#options = {
            timeout: 5000,
            reconnect: true,
            reconnectInterval: 5000,
            reconnectMaxInterval: 10000,
            reconnectMaxTimes: 0,
            cacheMessage: false,
            maxCacheMessage: 100,
            uniqueKey: "message_id",
            ...options
        } as Required<Options>;
    }

    static getInstance(url: string, options?: Options) {
        if (!WebSocketServer.#instance) {
            WebSocketServer.#instance = new WebSocketServer(url, options);
        }
        return this.#instance;
    }

    connect() {
        this.#ws = new WebSocket(this.#url, this.#options.protocols);
        this.#bindEvents();
        this.#timeoutHandle();
        return this;
    }

    #timeoutHandle() {
        if (this.#options.timeout) {
            this.#timeoutTimerId = setTimeout(() => {
                if (this.#isHandleClose) return;
                if (this.#ws && this.#ws.readyState !== WebSocket.OPEN) {
                    this.#ws.close();
                    this.#emit("error", new Error("connection timeout"));
                    if (this.#options.reconnect) this.#reconnect(true);
                }
            }, this.#options.timeout);
        }
    }

    #reconnect(immediate: boolean = false) {
        if (!this.#ws) return;

        if (this.#options.reconnectMaxTimes && (this.#reconnectAttempts >= this.#options.reconnectMaxTimes)) {
            throw new Error("Max reconnect attempts reached");
        }

        if (this.#reconnectTimeout) clearTimeout(this.#reconnectTimeout);

        const reconnectEvent = () => {
            this.#ws = new WebSocket(this.#url, this.#options.protocols);
            this.#bindEvents();
            this.#reconnectAttempts++;
        };

        if (immediate) {
            reconnectEvent();
            this.#timeoutHandle();
            return;
        }

        if (this.#ws.readyState === WebSocket.CONNECTING || this.#ws.readyState === WebSocket.OPEN) return;

        const exponentialBackoff = Math.min(this.#options.reconnectInterval * Math.pow(2, this.#reconnectAttempts), this.#options.reconnectMaxInterval);
        this.#reconnectTimeout = setTimeout(reconnectEvent, exponentialBackoff);
    }

    #bindEvents() {
        this.#ws?.on("open", () => this.#openHandler(this));
        this.#ws?.on("close", (code: number, reason: Buffer) => this.#closeHandler.call(this, code, reason));
        this.#ws?.on("message", (data: RawData, isBinary: boolean) => this.#messageHandler.call(this, data, isBinary));
        this.#ws?.on("error", (err: Error) => this.#errorHandler.call(this, err));
    }

    #openHandler(event: WebSocketServer) {
        if (this.#isHandleClose) this.#isHandleClose = false;
        this.#reconnectAttempts = 0;
        this.#emit("open", event);
        this.#sendCachedMessages();
    }

    #errorHandler(event: Error) {
        if (this.#timeoutTimerId !== null) clearTimeout(this.#timeoutTimerId);
        this.#emit("error", event);
    }

    #closeHandler(code: number, reason: Buffer) {
        this.#emit("close", code, reason);
        if (this.#options.reconnect && !this.#isHandleClose) this.#reconnect();
    }

    #messageHandler(buffer: RawData, isBinary: boolean) {
        this.#emit("message", buffer, isBinary);
        let jsonData: any;
        try {
            jsonData = JSON.parse(buffer.toString("utf-8"));
        } catch {
            return;
        }
        const uniqueKey = jsonData[this.#options.uniqueKey];
        if (!uniqueKey) return;
        const callback = this.#sendMessageQueue[uniqueKey].callback;
        if (callback != null) {
            if (this.#ws?.readyState === WebSocket.OPEN) {
                callback(null, jsonData);
            } else {
                callback(new Error("websocket connection is not open"), null);
            }
            delete this.#sendMessageQueue[uniqueKey];
        }
    }

    #emit(event: "open" | "close" | "error" | "message", data: any): void;
    #emit(event: "open", data: WebSocketServer): void;
    #emit(event: "close", code: number, reason: Buffer): void;
    #emit(event: "message", data: RawData, isBinary: boolean): void;
    #emit(event: "error", err: Error): void;
    #emit(event: "open" | "close" | "error" | "message", ...args: any[]) {
        const listeners = this.#eventListeners[event];
        if (listeners && listeners.length > 0) {
            listeners.forEach((listener) => listener(...args));
        }
    }

    on(event: "open" | "close" | "error" | "message", listener: (instance: WebSocketServer) => void): this;
    on(event: "close", listener: (instance: WebSocketServer, code: number, reason: Buffer) => void): this;
    on(event: "message", listener: (instance: WebSocketServer, data: RawData, isBinary: boolean) => void): this;
    on(event: "error", listener: (instance: WebSocketServer, err: Error) => void): this;
    on(event: "open" | "close" | "error" | "message", listener: Function) {
        if (["open", "close", "message", "error"].indexOf(event) === -1) {
            throw new Error(`Event "${event}" is not supported`);
        }
        // 如果没有这个事件的监听器数组,则创建一个空数组
        if (!this.#eventListeners[event]) {
            this.#eventListeners[event] = [];
        }
        // 如果这个监听器不在这个事件的监听器数组中,则添加进去
        if (!this.#eventListeners[event].includes(listener)) {
            this.#eventListeners[event].push(listener);
        }
        return this;
    }

    once(event: "open" | "close" | "error" | "message", listener: (instance: WebSocketServer,) => void): void;
    once(event: "close", listener: (instance: WebSocketServer, code: number, reason: Buffer) => void): void;
    once(event: "message", listener: (instance: WebSocketServer, data: RawData, isBinary: boolean) => void): void;
    once(event: "error", listener: (instance: WebSocketServer, err: Error) => void): void;
    once(event: "open" | "close" | "error" | "message", listener: any) {
        if (["open", "close", "message", "error"].indexOf(event) === -1) {
            throw new Error(`Event "${event}" is not supported`);
        }
        const onceListener: any = (data: any) => {
            listener(data);
            this.#off(event, onceListener);
        };

        this.on(event, onceListener);
        return this;
    }

    #off(event: string, listener: Function) {
        const listeners = this.#eventListeners[event];
        if (listeners) {
            this.#eventListeners[event] = listeners.filter((l) => l !== listener);
        }
    }

    #sendCachedMessages() {
        let index = 0;
        const sendNextMessage = () => {
            if (index < this.#messageCache.length) {
                const message = this.#messageCache[index];
                if (message) {
                    this.sendMessage(message.data, message.callback);
                    index++;
                    setTimeout(sendNextMessage, 100);
                }
            }
        };
        sendNextMessage();
    }

    sendMessage<R = any, S = any>(data: S, callback?: MessageCallback<R>) {
        if (this.#options.cacheMessage && !this.#ws) {
            if (this.#messageCache.length < this.#options.maxCacheMessage) {
                this.#messageCache.push({data, callback});
            } else {
                this.#messageCache.shift();
                this.#messageCache.push({data, callback});
            }
        }

        if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
            callback?.(new Error("websocket 未连接"), null as R);
            return;
        }

        if (Buffer.isBuffer(data)) {
            this.#ws.send(data);
            return;
        }

        // data 只能是字符串或者json 对象
        if (typeof data !== "string" && typeof data !== "object") {
            throw new Error("data must be a string or an object");
        }
        // data 如果是纯文本,则直接发送
        if (typeof data === "string") {
            this.#ws.send(data);
            return;
        }
        // data 如果是对象,则需要添加一个唯一的key,用于标识这条消息
        const key = this.#generateUniqueKey();
        const objMsg = Object.assign({}, {[this.#options.uniqueKey]: key}, data);
        const message = JSON.stringify(objMsg);
        this.#sendMessageQueue[key] = {message, callback};
        this.#ws.send(message);
    }

    sendMessageAsync<R = any, S = any>(data: S): Promise<R> {
        if (typeof data !== "object") {
            throw new Error("data must be an object");
        }
        return new Promise((resolve, reject) => this.sendMessage(data, (error, data) => error ? reject(error) : resolve(data as R)));
    }

    close() {
        this.#isHandleClose = true;
        this.#ws?.close();
    }

    removeListener(event: "open" | "close" | "error" | "message") {
        delete this.#eventListeners[event];
    }

    removeAllListeners() {
        Object.keys(this.#eventListeners).forEach((key) => {
            delete this.#eventListeners[key];
        });
    }

    destroy() {
        this.removeAllListeners();
        this.close();
        this.#ws = null;
    }

    #generateUniqueKey(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2);
        return timestamp + random;
    }
}