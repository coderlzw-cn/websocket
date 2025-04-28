// 事件类型
export type WebSocketEvent = 'open' | 'close' | 'message' | 'error' | 'reconnect' | 'auth' | 'heartbeat' | 'binary';

// 错误类型
export type WebSocketErrorType =
  | 'CONNECTION_ERROR'
  | 'WEBSOCKET_ERROR'
  | 'AUTH_ERROR'
  | 'MESSAGE_ERROR'
  | 'HEARTBEAT_ERROR'
  | 'UNKNOWN_ERROR';

// 连接统计信息
export interface ConnectionStats {
  /** 总尝试次数 */
  totalAttempts: number;
  /** 成功连接次数 */
  successfulConnections: number;
  /** 失败连接次数 */
  failedConnections: number;
  /** 最后连接时间 */
  lastConnectionTime: Date | null;
  /** 最后断开连接时间 */
  lastDisconnectionTime: Date | null;
  /** 总在线时间 */
  totalUptime: number;
  connectionStartTime: Date | null;
  /** 最后一次错误 */
  lastError?: ErrorInfo;
}

// 错误信息
export interface ErrorInfo {
  /** 错误类型 */
  type: WebSocketErrorType;
  /** 错误对象 */
  error: Error;
  /** 错误发生时间 */
  timestamp: Date;
  /** 连接统计信息 */
  connectionStats: ConnectionStats;
}

// 关闭事件信息
export interface CloseEventInfo {
  /** 关闭代码 */
  code: number;
  /** 关闭原因 */
  reason: string;
  /** 是否干净关闭 */
  wasClean: boolean;
  /** 连接统计信息 */
  stats: ConnectionStats;
}

// 认证响应
export interface AuthResponse {
  /** 认证是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

// 消息类型
export interface Message {
  /** 消息ID */
  id?: number;
  /** 消息类型 */
  type?: string;
  /** 消息内容 */
  [key: string]: unknown;
}

// 客户端选项
export interface WebSocketClientOptions {
  /** 重连间隔时间（毫秒），默认 3000 */
  reconnectInterval?: number;
  /** 心跳间隔时间（毫秒），默认 30000 */
  heartbeatInterval?: number;
  /** 最大重连次数，默认 5 */
  maxReconnectAttempts?: number;
  /** 是否启用重连，默认 true */
  enableReconnect?: boolean;
  /** 是否无限重连，默认 false */
  infiniteReconnect?: boolean;
  /** 是否启用消息缓存，默认 false */
  enableMessageCache?: boolean;
  /** 最大缓存消息数量，默认 100 */
  maxCacheSize?: number;
  /** 客户端ID，用于标识客户端 */
  clientId?: string;
  /** 认证token，用于身份验证 */
  authToken?: string;
  /** 自定义心跳数据，默认 { type: 'heartbeat', clientId: '', timestamp: Date.now() } */
  heartbeatData?: unknown;
  /** 二进制数据类型，'blob' 或 'arraybuffer'，默认 'blob' */
  binaryType?: 'blob' | 'arraybuffer';
  /** 是否自动连接，默认 false */
  autoConnect?: boolean;
  /** 是否使用单例模式，默认 false */
  singleton?: boolean;
}

// 发送选项
export interface SendOptions {
  /** 是否等待响应，默认 false */
  waitForResponse?: boolean;
  /** 超时时间，默认 30000 */
  timeout?: number;
  /** 是否发送二进制数据，默认 false */
  binary?: boolean;
}

// 事件回调类型
export type EventCallback = (...args: unknown[]) => void;

// Promise 解析器类型
interface PromiseResolver<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export default class WebSocketClient {
  // 单例实例
  private static instances: Map<string, WebSocketClient> = new Map();

  /** 连接URL */
  private readonly url: string;
  /** 配置选项 */
  private readonly options: Required<WebSocketClientOptions>;
  /** WebSocket实例 */
  private ws: WebSocket | null = null;
  /** 连接统计信息 */
  private readonly connectionStats: ConnectionStats;
  /** 重连尝试次数 */
  private reconnectAttempts: number = 0;
  /** 心跳定时器 */
  private heartbeatTimer: number | null = null;
  /** 重连定时器 */
  private reconnectTimer: number | null = null;
  /** 是否已连接 */
  private isConnected: boolean = false;
  /** 是否手动关闭 */
  private isManualClose: boolean = false;
  /** 是否已认证 */
  private isAuthenticated: boolean = false;
  private readonly listeners: Record<WebSocketEvent, EventCallback[]> = {
    open: [],
    close: [],
    message: [],
    error: [],
    reconnect: [],
    auth: [],
    heartbeat: [],
    binary: [],
  };
  private readonly pendingPromises: Map<number, PromiseResolver<unknown>> = new Map();
  private messageId: number = 0;
  private messageCache: Message[] = [];

  public constructor(url: string, options: WebSocketClientOptions = {}) {
    // 如果已经存在实例且启用了单例模式，则抛出错误
    if (options.singleton && WebSocketClient.instances.has(url + JSON.stringify(options))) {
      throw new Error('An instance with these parameters already exists. Use getInstance() instead.');
    }

    this.url = url;
    this.options = {
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5,
      enableReconnect: true,
      infiniteReconnect: false,
      enableMessageCache: false,
      maxCacheSize: 100,
      clientId: '',
      authToken: '',
      heartbeatData: null,
      binaryType: 'blob',
      autoConnect: false,
      singleton: false,
      ...options,
    };

    this.connectionStats = {
      totalAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      lastConnectionTime: null,
      lastDisconnectionTime: null,
      totalUptime: 0,
      connectionStartTime: null,
    };

    if (this.options.autoConnect) {
      void this.connect();
    }
  }

  // 获取单例实例
  public static getInstance(url: string, options: WebSocketClientOptions = {}): WebSocketClient {
    const key = url + JSON.stringify(options);
    if (!this.instances.has(key)) {
      this.instances.set(key, new WebSocketClient(url, { ...options, singleton: true }));
    }
    return this.instances.get(key)!;
  }

  // 销毁单例实例
  public static destroyInstance(url: string, options: WebSocketClientOptions = {}): void {
    const key = url + JSON.stringify(options);
    const instance = this.instances.get(key);
    if (instance) {
      void instance.disconnect();
      this.instances.delete(key);
    }
  }

  // 销毁所有实例
  public static destroyAllInstances(): void {
    for (const instance of this.instances.values()) {
      void instance.disconnect();
    }
    this.instances.clear();
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 重新发送缓存的消息
  private async resendCachedMessages(): Promise<void> {
    if (!this.options.enableMessageCache || this.messageCache.length === 0) {
      return;
    }

    const messages = [...this.messageCache];
    this.messageCache = []; // 清空缓存，避免重复发送

    for (const message of messages) {
      try {
        await this.send(message);
        // 每条消息发送后等待100ms
        await this.delay(100);
      } catch (error) {
        // 如果发送失败，重新缓存消息
        this.cacheMessage(message);
        throw error;
      }
    }
  }

  public connect(): Promise<void> {
    // 如果已经连接，则直接返回
    if (this.isConnected) return Promise.resolve();

    // 如果存在重连定时器，则清除
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    return new Promise((resolve, reject) => {
      try {
        this.connectionStats.totalAttempts++;
        this.connectionStats.lastConnectionTime = new Date();

        this.ws = new WebSocket(this.url);
        this.ws.binaryType = this.options.binaryType;

        this.ws.onopen = (): void => {
          this.isConnected = true;
          this.connectionStats.successfulConnections++;
          this.connectionStats.connectionStartTime = new Date();
          this.reconnectAttempts = 0;

          if (this.options.authToken) {
            this.authenticate()
              .then(async () => {
                this.startHeartbeat();
                this.emit('open', this.connectionStats);
                // 认证成功后重新发送缓存的消息
                await this.resendCachedMessages();
                resolve();
              })
              .catch((error) => {
                this.handleError(error as Error, 'AUTH_ERROR');
                reject(error);
              });
          } else {
            this.isAuthenticated = true;
            this.startHeartbeat();
            this.emit('open', this.connectionStats);
            void this.resendCachedMessages();
            resolve();
          }
        };

        this.ws.onerror = (): void => {
          this.connectionStats.failedConnections++;
          const error = new Error('WebSocket error occurred');
          this.handleError(error, 'WEBSOCKET_ERROR');
          reject(error);
        };

        this.bindEvents();
      } catch (error) {
        this.handleError(error as Error, 'CONNECTION_ERROR');
        reject(error);
      }
    });
  }

  // 断开连接
  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.isManualClose = true;
      this.stopHeartbeat();

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.ws) {
        this.ws.onclose = (): void => {
          this.isConnected = false;
          this.isAuthenticated = false;
          this.connectionStats.lastDisconnectionTime = new Date();
          if (this.connectionStats.connectionStartTime) {
            this.connectionStats.totalUptime +=
              this.connectionStats.lastDisconnectionTime.getTime() - this.connectionStats.connectionStartTime.getTime();
          }

          this.emit('close', {
            code: 1000,
            reason: 'Manual disconnect',
            wasClean: true,
            stats: this.connectionStats,
          });
          resolve();
        };

        this.ws.close();
      } else {
        resolve();
      }
    });
  }

  // 绑定事件
  private bindEvents(): void {
    if (!this.ws) return;

    this.ws.onclose = (event: CloseEvent): void => {
      this.isConnected = false;
      this.isAuthenticated = false;
      this.connectionStats.lastDisconnectionTime = new Date();
      if (this.connectionStats.connectionStartTime) {
        this.connectionStats.totalUptime +=
          this.connectionStats.lastDisconnectionTime.getTime() - this.connectionStats.connectionStartTime.getTime();
      }

      this.stopHeartbeat();
      this.emit('close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        stats: this.connectionStats,
      });

      // 如果未手动关闭，则进行重连
      if (!this.isManualClose) this.handleReconnect();
    };

    this.ws.onmessage = (event: MessageEvent): void => {
      let data: Message;
      try {
        if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
          this.emit('binary', event.data);
          return;
        }

        data = JSON.parse(event.data as string) as Message;

        if (data.type === 'auth_response') {
          const authResponse: AuthResponse = {
            success: 'success' in data ? (data.success as boolean) : false,
            error: 'error' in data ? (data.error as string) : undefined,
          };
          this.handleAuthResponse(authResponse);
          return;
        }

        this.emit('message', data);

        if (data.id && this.pendingPromises.has(data.id)) {
          const { resolve, reject } = this.pendingPromises.get(data.id)!;
          if ('error' in data) {
            reject(new Error(data.error as string));
          } else {
            resolve(data);
          }
          this.pendingPromises.delete(data.id);
        }
      } catch (error) {
        this.handleError(error as Error, 'MESSAGE_ERROR');
      }
    };
  }

  // 认证
  private authenticate(): Promise<void> {
    if (!this.isConnected) {
      this.handleError(new Error('Not connected'), 'AUTH_ERROR');
      return Promise.reject(new Error('Not connected'));
    }

    const authMessage: Message = {
      type: 'auth',
      token: this.options.authToken,
      clientId: this.options.clientId,
    };

    return this.send(authMessage, { waitForResponse: true }) as Promise<void>;
  }

  // 处理认证响应
  private handleAuthResponse(data: AuthResponse): void {
    if (data.success) {
      this.isAuthenticated = true;
      this.startHeartbeat();
      this.emit('auth', { success: true });
      this.emit('open', this.connectionStats);
    } else {
      this.handleError(new Error(data.error || 'Authentication failed'), 'AUTH_ERROR');
      this.ws?.close();
    }
  }

  // 处理重连
  private handleReconnect(): void {
    if (!this.options.enableReconnect) return;

    if (this.options.infiniteReconnect || this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;

      this.reconnectTimer = window.setTimeout(() => {
        // 发送重连事件，包含更多信息
        this.emit('reconnect', {
          attempt: this.reconnectAttempts,
          maxAttempts: this.options.maxReconnectAttempts,
          infinite: this.options.infiniteReconnect,
          stats: this.connectionStats,
          lastError: this.connectionStats.lastError,
          nextAttemptTime: new Date(Date.now() + this.options.reconnectInterval),
        });
        this.connect();
      }, this.options.reconnectInterval);
    } else {
      // 达到最大重连次数，发送错误事件
      this.emit('error', {
        type: 'CONNECTION_ERROR',
        error: new Error('Max reconnection attempts reached'),
        timestamp: new Date(),
        connectionStats: this.connectionStats,
      });
    }
  }

  // 开始心跳
  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isConnected && this.isAuthenticated) {
        const heartbeatData: Message = (this.options.heartbeatData as Message) || {
          type: 'heartbeat',
          clientId: this.options.clientId,
          timestamp: Date.now(),
        };

        this.send(heartbeatData, { waitForResponse: false })
          .then(() => this.emit('heartbeat', heartbeatData))
          .catch((error) => this.handleError(error as Error, 'HEARTBEAT_ERROR'));
      }
    }, this.options.heartbeatInterval);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 处理错误
  private handleError(error: Error, type: WebSocketErrorType): void {
    const errorInfo: ErrorInfo = {
      type,
      error,
      timestamp: new Date(),
      connectionStats: this.connectionStats,
    };

    // 记录最后一次错误
    this.connectionStats.lastError = errorInfo;

    this.emit('error', errorInfo);

    switch (type) {
      case 'AUTH_ERROR':
        this.ws?.close();
        break;
      case 'MESSAGE_ERROR':
        console.error('Message processing error:', error);
        break;
    }
  }

  // 发送消息
  public send(data: Message, options: SendOptions = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        if (this.options.enableMessageCache) {
          this.cacheMessage(data);
        }
        reject(new Error('WebSocket is not connected'));
        return;
      }

      if (this.options.authToken && !this.isAuthenticated) {
        reject(new Error('Not authenticated'));
        return;
      }

      const messageId = ++this.messageId;
      const message: Message = {
        id: messageId,
        ...data,
      };

      try {
        const messageToSend = options.binary ? data : JSON.stringify(message);
        this.ws?.send(messageToSend as string);
        if (options.waitForResponse !== false) {
          const timeout = options.timeout || 30000;
          const timeoutId = window.setTimeout(() => {
            this.pendingPromises.delete(messageId);
            reject(new Error('Request timeout'));
          }, timeout);

          this.pendingPromises.set(messageId, {
            resolve: (response: unknown) => {
              clearTimeout(timeoutId);
              resolve(response);
            },
            reject: (error: unknown) => {
              clearTimeout(timeoutId);
              reject(error);
            },
          });
        } else {
          resolve(undefined);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // 发送二进制数据
  public sendBinary(data: Blob | ArrayBuffer, options: SendOptions = {}): Promise<unknown> {
    return this.send(data as unknown as Message, { ...options, binary: true });
  }

  // 获取连接统计信息
  public getConnectionStats(): ConnectionStats {
    return { ...this.connectionStats };
  }

  // 监听事件
  public on(event: WebSocketEvent, callback: EventCallback): this {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  // 取消监听事件
  public off(event: WebSocketEvent, callback: EventCallback): this {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
    return this;
  }

  // 触发事件
  private emit(event: WebSocketEvent, ...args: unknown[]): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }

  // 缓存消息
  private cacheMessage(message: Message): void {
    if (this.messageCache.length >= this.options.maxCacheSize) {
      this.messageCache.shift();
    }
    this.messageCache.push(message);
  }

  // 获取缓存的消息
  public getCachedMessages(): Message[] {
    return [...this.messageCache];
  }

  // 清空消息缓存
  public clearMessageCache(): void {
    this.messageCache = [];
  }
}
