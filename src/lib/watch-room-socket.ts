// Socket.IO 客户端管理
import type { Socket } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  WatchRoomConfig,
} from '@/types/watch-room';

export type WatchRoomSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

const CONNECTION_ATTEMPT_TIMEOUT = 10_000;
const MANUAL_RECONNECT_TIMEOUT = 5_000;

// 房间连接库（约 13KB）按需下载：房间管理器挂在根布局里，静态引入会让每个页面的首屏
// 都带上它，而真正连房间时才需要。第一次连接时下载一次，之后直接用。
type IoFactory = typeof import('socket.io-client').io;
let ioFactory: IoFactory | null = null;
async function loadIo(): Promise<IoFactory> {
  if (!ioFactory) ioFactory = (await import('socket.io-client')).io;
  return ioFactory;
}

class WatchRoomSocketManager {
  private socket: WatchRoomSocket | null = null;
  private config: WatchRoomConfig | null = null;
  private terminalError: Error | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutCheck: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatResponse = Date.now();
  private visibilityChangeHandler: (() => void) | null = null;
  private reconnectFailedCallback: (() => void) | null = null;
  private reconnectSuccessCallback: (() => void) | null = null;
  private reconnectWaiters = new Set<(connected: boolean) => void>();
  // 每次 disconnect() 加一；用来识别"等待下载连接库期间已被断开"的连接请求
  private disconnectEpoch = 0;

  // Deliver the socket before its first network result so the hook can bind connect/rejoin.
  // The returned object may still be connecting; only socket.connected denotes success.
  async connect(config: WatchRoomConfig): Promise<WatchRoomSocket> {
    let io = ioFactory;
    if (!io) {
      const epoch = this.disconnectEpoch;
      io = await loadIo();
      if (epoch !== this.disconnectEpoch) {
        // 下载期间房间已被断开：不再建立连接，交回一个不会联网的空套接字，
        // 与以前"先建好连接、随即被断开"时调用方拿到的已断开套接字等价。
        return io({ autoConnect: false, forceNew: true }) as WatchRoomSocket;
      }
    }
    // 以下与原来一致，全部同步执行：并发的两次 connect 在这里只会建立一个连接
    if (this.terminalError) throw this.terminalError;
    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return this.socket;
    }

    if (config.serverType === 'external' && !config.externalServerUrl) {
      throw new Error('External server URL is required');
    }

    const socketOptions = {
      autoConnect: false,
      // This manager owns its transport and can cancel it without affecting other sockets.
      forceNew: true,
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: CONNECTION_ATTEMPT_TIMEOUT,
    };
    this.config = config;
    if (config.serverType === 'internal') {
      this.socket = io({ ...socketOptions, path: '/socket.io' });
    } else {
      this.socket = io(config.externalServerUrl, {
        ...socketOptions,
        auth: {
          token: config.externalServerAuth,
          ...(config.externalAppId ? { appId: config.externalAppId } : {}),
        },
        extraHeaders: config.externalServerAuth
          ? { Authorization: `Bearer ${config.externalServerAuth}` }
          : undefined,
      });
    }

    const socket = this.socket;
    this.setupEventListeners(socket);
    this.startHeartbeat();
    this.setupVisibilityListener();
    socket.connect();
    return socket;
  }

  disconnect() {
    const socket = this.socket;
    this.disconnectEpoch += 1;
    // Invalidate handlers before transport shutdown can emit any final events.
    this.socket = null;
    this.config = null;
    this.terminalError = null;
    this.stopHeartbeat();
    this.removeVisibilityListener();
    this.reconnectWaiters.forEach((finish) => finish(false));
    if (socket) {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.io.reconnection(false);
      socket.disconnect();
    }
  }

  getSocket(): WatchRoomSocket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  private stopRetrying(socket: WatchRoomSocket, error: Error) {
    if (this.socket !== socket || this.terminalError) return;
    this.terminalError = error;
    this.stopHeartbeat();
    this.removeVisibilityListener();
    socket.io.reconnection(false);
    socket.disconnect();
    this.reconnectWaiters.forEach((finish) => finish(false));
    this.reconnectFailedCallback?.();
  }

  private setupEventListeners(socket: WatchRoomSocket) {
    socket.on('connect', () => {
      if (this.socket !== socket || this.terminalError) return;
      this.lastHeartbeatResponse = Date.now();
      // Manager "reconnect" happens before namespace authentication has succeeded.
      this.reconnectSuccessCallback?.();
    });

    socket.on('connect_error', (error) => {
      if (this.socket !== socket) return;
      const code = (error as Error & { data?: { code?: string } }).data?.code;
      // Transport errors keep socket.active=true. Namespace middleware refusal makes it
      // false and requires new credentials/configuration, rather than endless retries.
      if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || !socket.active) {
        this.stopRetrying(socket, error);
      }
    });

    socket.on('room:auth-required', () => {
      this.stopRetrying(socket, new Error('登录已失效，请重新登录后连接房间'));
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.stopRetrying(
          socket,
          new Error('服务器已结束房间连接，请重新连接')
        );
      }
    });

    socket.on('heartbeat:pong', () => {
      if (this.socket === socket) this.lastHeartbeatResponse = Date.now();
    });

    socket.io.on('reconnect_failed', () => {
      if (this.socket === socket && !this.terminalError)
        this.reconnectFailedCallback?.();
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) this.socket.emit('heartbeat');
    }, 5000);
    this.heartbeatTimeoutCheck = setInterval(() => {
      if (
        this.socket?.connected &&
        Date.now() - this.lastHeartbeatResponse > 15000
      ) {
        // Engine.IO owns liveness/reconnect. A throttled page timer must not force
        // disconnect an otherwise healthy room or rotate its controller session.
        this.lastHeartbeatResponse = Date.now();
      }
    }, 3000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.heartbeatTimeoutCheck) clearInterval(this.heartbeatTimeoutCheck);
    this.heartbeatInterval = null;
    this.heartbeatTimeoutCheck = null;
  }

  private setupVisibilityListener() {
    if (typeof document === 'undefined') return;
    this.visibilityChangeHandler = () => {
      if (
        document.visibilityState === 'visible' &&
        this.socket &&
        !this.socket.connected &&
        !this.socket.active &&
        !this.terminalError
      ) {
        this.socket.connect();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  private removeVisibilityListener() {
    if (typeof document === 'undefined' || !this.visibilityChangeHandler)
      return;
    document.removeEventListener(
      'visibilitychange',
      this.visibilityChangeHandler
    );
    this.visibilityChangeHandler = null;
  }

  setReconnectFailedCallback(callback: () => void) {
    this.reconnectFailedCallback = callback;
  }

  setReconnectSuccessCallback(callback: () => void) {
    this.reconnectSuccessCallback = callback;
  }

  // A manual action waits at most five seconds. Its timeout does not cancel the
  // ongoing background retry; explicit disconnect/logout cancels both instead.
  async reconnect(): Promise<boolean> {
    if (!this.config || this.terminalError) return false;
    let socket: WatchRoomSocket;
    try {
      socket = await this.connect(this.config);
    } catch {
      return false;
    }
    if (this.socket !== socket || this.terminalError) return false;
    if (socket.connected) return true;

    return new Promise((resolve) => {
      const finish = (connected: boolean) => {
        clearTimeout(timeout);
        socket.off('connect', connectedHandler);
        socket.off('connect_error', errorHandler);
        this.reconnectWaiters.delete(finish);
        resolve(connected);
      };
      const connectedHandler = () => finish(this.socket === socket);
      const errorHandler = () => {
        if (this.socket !== socket || this.terminalError) finish(false);
      };
      const timeout = setTimeout(() => finish(false), MANUAL_RECONNECT_TIMEOUT);
      this.reconnectWaiters.add(finish);
      socket.on('connect', connectedHandler);
      socket.on('connect_error', errorHandler);
      if (this.socket !== socket || this.terminalError) finish(false);
      else if (socket.connected) finish(true);
    });
  }
}

export const watchRoomSocketManager = new WatchRoomSocketManager();
