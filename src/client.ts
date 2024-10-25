import {MessageCallback, Options, sendMessageQueueItem} from "./type";

export default class WebSocketClient {
    static #instance: WebSocketClient;
    #url: string;
    #ws: null | WebSocket = null;
    #options: Required<Options>;
    readonly #eventListeners: Record<string, Function[]> = {};  // 事件监听器  {open: [listener1, listener2]}
    readonly #messageCache: { data: any; callback?: MessageCallback }[] = [];  // 在没有连接的时候缓存消息
    #reconnectAttempts: number = 0;     // 重连次数
    #reconnectTimeoutTimerId: ReturnType<typeof setTimeout> | null = null;  // 重连定时器
    readonly #sendMessageQueue: Record<string, sendMessageQueueItem> = {};  // 等待发送的消息队列
    #isHandleClose: boolean = false;  // 是否手动关闭的连接
    #timeoutTimerId: ReturnType<typeof setTimeout> | null = null;

    constructor(url: string, options?: Options) {
        if (!("WebSocket" in window)) throw new Error("WebSocket is not supported");
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
        if (!WebSocketClient.#instance) {
            WebSocketClient.#instance = new WebSocketClient(url, options);
        }
        return this.#instance;
    }

    connect() {
        this.#ws = new WebSocket(this.#url, this.#options.protocols);
        this.#bindEvents();
        this.#timeoutHandle();
    }

    setBinaryType(binaryType: "blob" | "arraybuffer") {
        if (this.#ws) this.#ws.binaryType = binaryType;
    }

    #timeoutHandle() {
        if (this.#options.timeout) {
            this.#timeoutTimerId = setTimeout(() => {
                if (this.#isHandleClose) return;
                if (this.#ws && this.#ws.readyState !== WebSocket.OPEN) {
                    this.#ws.close();
                    this.#emit("error", new Event("connection timeout"));
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

        if (this.#reconnectTimeoutTimerId) clearTimeout(this.#reconnectTimeoutTimerId);

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
        this.#reconnectTimeoutTimerId = setTimeout(reconnectEvent, exponentialBackoff);
    }

    #bindEvents() {
        this.#ws?.addEventListener("open", this.#openHandler.bind(this));
        this.#ws?.addEventListener("close", this.#closeHandler.bind(this));
        this.#ws?.addEventListener("message", this.#messageHandler.bind(this));
        this.#ws?.addEventListener("error", this.#errorHandler.bind(this));
    }

    #openHandler(event: Event) {
        if (this.#isHandleClose) this.#isHandleClose = false;
        this.#reconnectAttempts = 0;
        this.#emit("open", event);
        this.#sendCachedMessages();
    }

    #errorHandler(event: Event) {
        if (this.#timeoutTimerId !== null) clearTimeout(this.#timeoutTimerId);
        this.#emit("error", event);
    }

    #closeHandler(closeEvent: CloseEvent) {
        this.#emit("close", closeEvent);
        // 如果设置了重连,并且不是手动关闭的连接,则重连
        if (this.#options.reconnect && !this.#isHandleClose) this.#reconnect();
    }

    #messageHandler(messageEvent: MessageEvent) {
        this.#emit("message", messageEvent);
        let jsonData: any;
        try {
            jsonData = JSON.parse(messageEvent.data);
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

    #emit(event: string, data: any) {
        const listeners = this.#eventListeners[event];
        if (listeners && listeners.length > 0) {
            listeners.forEach((listener) => listener(data));
        }
    }

    on(event: "open" | "close" | "error" | "message", listener: (event: Event) => void): this;
    on(event: "error", listener: (event: Event) => void): this;
    on(event: "close", listener: (closeEvent: CloseEvent) => void): this;
    on(event: "message", listener: (messageEvent: MessageEvent) => void): this;
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

    once(event: "open" | "close" | "error" | "message", listener: (event: Event) => void): this;
    once(event: "error", listener: (event: Event) => void): this;
    once(event: "close", listener: (closeEvent: CloseEvent) => void): this;
    once(event: "message", listener: (messageEvent: MessageEvent) => void): this;
    once(event: "open" | "close" | "error" | "message", listener: ((event: Event) => void) | ((closeEvent: CloseEvent) => void) | ((messageEvent: MessageEvent) => void)) {
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
