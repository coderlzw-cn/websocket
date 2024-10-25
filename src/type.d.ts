export interface Options {
    timeout?: number;       // 连接超时时间，默认 5s
    reconnect?: boolean;    // 是否重连，默认为 true
    reconnectInterval?: number;  // 重连间隔，默认 5s
    reconnectMaxInterval?: number;  // 最大重连间隔，10s
    reconnectMaxTimes?: number;  // 最大重连次数，默认为 0 不限制链接次数
    uniqueKey?: string;        // 每条消息携带一个唯一的key,用于标识这条消息，默认值为 message_id
    cacheMessage?: boolean;   // 是否缓存发送失败的消息，待连接成功后在发送，默认为 false
    maxCacheMessage?: number    // 缓存消息的最大数量，默认值为 100
    protocols?: string | string[]
}

export type MessageCallback<R = any> = (error: Error | null, data: R) => void;

export interface sendMessageQueueItem {
    message: string,
    callback?: MessageCallback
}