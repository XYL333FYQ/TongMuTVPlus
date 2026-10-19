// WatchRoom 全局状态管理 Provider
'use client';

import { usePathname } from 'next/navigation';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useWatchRoom } from '@/hooks/useWatchRoom';

import Toast, { ToastProps } from '@/components/feedback/Toast';

import type { WatchRoomConfig } from '@/types/watch-room';

const WATCH_ROOM_NO_CONNECT_KEY = 'watch_room_no_connect';
const WATCH_ROOM_SCREEN_PATH = '/watch-room/screen';
const WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY = 'watch_room_no_connect_timestamp';
const WATCH_ROOM_NO_CONNECT_TTL_MS = 10 * 60 * 1000;

type WatchRoomContextType = Omit<
  ReturnType<typeof useWatchRoom>,
  'connect' | 'disconnect'
> & {
  reconnectFailed: boolean;
  isEnabled: boolean;
  config: WatchRoomConfig | null;
  manualReconnect: () => Promise<void>;
};
const WatchRoomContext = createContext<WatchRoomContextType | null>(null);

export const useWatchRoomContext = () => {
  const context = useContext(WatchRoomContext);
  if (!context) {
    throw new Error(
      'useWatchRoomContext must be used within WatchRoomProvider'
    );
  }
  return context;
};

// 安全版本，可以在非 Provider 内使用
export const useWatchRoomContextSafe = () => {
  return useContext(WatchRoomContext);
};

interface WatchRoomProviderProps {
  children: React.ReactNode;
}

export function WatchRoomProvider({ children }: WatchRoomProviderProps) {
  const pathname = usePathname();
  const [config, setConfig] = useState<WatchRoomConfig | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [
    shouldDisableWatchRoomConnection,
    setShouldDisableWatchRoomConnection,
  ] = useState<boolean | null>(null);

  // 处理房间删除的回调
  const handleRoomDeleted = useCallback((data?: { reason?: string }) => {
    console.log('[WatchRoomProvider] Room deleted:', data);

    // 显示Toast提示
    if (data?.reason === 'owner_left') {
      setToast({
        message: '房主已解散房间',
        type: 'error',
        duration: 4000,
        onClose: () => setToast(null),
      });
    } else {
      setToast({
        message: '房间已被删除',
        type: 'info',
        duration: 3000,
        onClose: () => setToast(null),
      });
    }
  }, []);

  // 处理房间状态清除的回调（房主离开超过30秒）
  const handleStateCleared = useCallback(() => {
    console.log('[WatchRoomProvider] Room state cleared');

    setToast({
      message: '主持已结束本次播放，房间继续保留',
      type: 'info',
      duration: 4000,
      onClose: () => setToast(null),
    });
  }, []);

  const watchRoom = useWatchRoom(handleRoomDeleted, handleStateCleared);
  const { connect, disconnect } = watchRoom;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshWatchRoomConnectionState = () => {
      const noConnect =
        window.localStorage.getItem(WATCH_ROOM_NO_CONNECT_KEY) === '1';
      const lastActiveAt = Number(
        window.localStorage.getItem(WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY) || 0
      );
      const isScreenPage = pathname === WATCH_ROOM_SCREEN_PATH;
      const isExpired =
        !lastActiveAt ||
        Date.now() - lastActiveAt > WATCH_ROOM_NO_CONNECT_TTL_MS;

      if (noConnect && isExpired) {
        window.localStorage.removeItem(WATCH_ROOM_NO_CONNECT_KEY);
        window.localStorage.removeItem(WATCH_ROOM_NO_CONNECT_TIMESTAMP_KEY);
      }

      setShouldDisableWatchRoomConnection(
        !isScreenPage && noConnect && !isExpired
      );
    };

    refreshWatchRoomConnectionState();
    const interval = window.setInterval(
      refreshWatchRoomConnectionState,
      30_000
    );

    return () => window.clearInterval(interval);
  }, [pathname]);

  // 检查登录状态
  useEffect(() => {
    const checkLoginStatus = () => {
      const authInfo = getAuthInfoFromBrowserCookie();
      const loggedIn = !!(authInfo && authInfo.username);
      setIsLoggedIn(loggedIn);
    };

    // 初始检查
    checkLoginStatus();

    // 定期检查登录状态（每秒检查一次）
    const interval = setInterval(checkLoginStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  // The hook rejoins after the connection event; credentials stay on the server.
  const manualReconnect = useCallback(async () => {
    setReconnectFailed(false);
    const { watchRoomSocketManager } = await import('@/lib/watch-room-socket');
    const success = await watchRoomSocketManager.reconnect();
    setReconnectFailed(!success);
  }, []);
  // 加载配置
  useEffect(() => {
    if (shouldDisableWatchRoomConnection === null) {
      return;
    }

    if (shouldDisableWatchRoomConnection) {
      disconnect();
      setConfig({
        enabled: false,
        serverType: 'internal',
      });
      setIsEnabled(false);
      return;
    }

    if (!isLoggedIn) disconnect();

    let disposed = false;
    const loadConfig = async () => {
      try {
        // 使用公共 API 获取观影室配置（不需要管理员权限）
        const response = await fetch('/api/server-config');
        if (response.ok) {
          const data = await response.json();
          if (disposed) return;
          // API 返回格式: { SiteName, StorageType, Version, WatchRoom }
          const watchRoomConfig: WatchRoomConfig = {
            enabled: data.WatchRoom?.enabled ?? false, // 默认不启用
            serverType: data.WatchRoom?.serverType ?? 'internal',
            externalServerUrl: data.WatchRoom?.externalServerUrl,
          };

          // 如果使用外部服务器，需要获取认证信息（需要登录）
          if (
            watchRoomConfig.serverType === 'external' &&
            watchRoomConfig.enabled
          ) {
            // 检查用户是否已登录
            if (!isLoggedIn) {
              console.log(
                '[WatchRoom] User not logged in, skipping auth info request'
              );
              // 用户未登录，不调用认证接口
            } else {
              try {
                const authResponse = await fetch('/api/watch-room-auth');
                if (authResponse.ok) {
                  const authData = await authResponse.json();
                  watchRoomConfig.externalServerAuth =
                    authData.externalServerAuth;
                  // 多应用隔离 ID（未配置时不携带，兼容旧版外部服务器）
                  watchRoomConfig.externalAppId =
                    authData.externalAppId || undefined;
                } else {
                  console.error(
                    '[WatchRoom] Failed to load auth info:',
                    authResponse.status
                  );
                  // 如果无法获取认证信息，禁用观影室
                  watchRoomConfig.enabled = false;
                }
              } catch (error) {
                console.error('[WatchRoom] Error loading auth info:', error);
                // 如果无法获取认证信息，禁用观影室
                watchRoomConfig.enabled = false;
              }
            }
          }

          if (disposed) return;
          setConfig(watchRoomConfig);
          setIsEnabled(watchRoomConfig.enabled);

          // 只在启用了观影室时才连接
          if (watchRoomConfig.enabled && isLoggedIn) {
            // 设置重连回调
            const { watchRoomSocketManager } = await import(
              '@/lib/watch-room-socket'
            );
            if (disposed) return;
            watchRoomSocketManager.setReconnectFailedCallback(() => {
              console.log(
                '[WatchRoomProvider] Reconnect failed callback triggered'
              );
              setReconnectFailed(true);
            });

            watchRoomSocketManager.setReconnectSuccessCallback(() => {
              console.log(
                '[WatchRoomProvider] Reconnect success callback triggered'
              );
              setReconnectFailed(false);
            });

            await connect(watchRoomConfig);
          } else {
            disconnect();
          }
        } else {
          console.error('[WatchRoom] Failed to load config:', response.status);
          // 加载配置失败时，不连接，保持禁用状态
          const defaultConfig: WatchRoomConfig = {
            enabled: false,
            serverType: 'internal',
          };
          setConfig(defaultConfig);
          setIsEnabled(false);
        }
      } catch (error) {
        if (disposed) return;
        console.error('[WatchRoom] Error loading config:', error);
        // 加载配置失败时，不连接，保持禁用状态
        const defaultConfig: WatchRoomConfig = {
          enabled: false,
          serverType: 'internal',
        };
        setConfig(defaultConfig);
        setIsEnabled(false);
      }
    };

    loadConfig();
    return () => {
      disposed = true;
    };
  }, [connect, disconnect, isLoggedIn, shouldDisableWatchRoomConnection]);

  // 仅在 Provider 卸载时断开，避免路由切换时误断开房间连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const contextValue: WatchRoomContextType = {
    ...watchRoom,
    reconnectFailed,
    isEnabled,
    config,
    manualReconnect,
  };
  return (
    <WatchRoomContext.Provider value={contextValue}>
      {children}
      {toast && <Toast {...toast} />}
    </WatchRoomContext.Provider>
  );
}
