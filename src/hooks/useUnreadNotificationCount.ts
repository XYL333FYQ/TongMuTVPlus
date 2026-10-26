'use client';

import { useEffect, useState } from 'react';

// 桌面和手机头像可能同时挂载，每个账号只保留一组请求和定时器。
const subscriptions = new Map<
  string,
  {
    count: number;
    listeners: Set<(count: number) => void>;
    stop: () => void;
  }
>();

export function useUnreadNotificationCount(username?: string): number {
  const [value, setValue] = useState({ username, count: 0 });
  useEffect(() => {
    if (!username) return;
    let store = subscriptions.get(username);
    if (!store) {
      const listeners = new Set<(count: number) => void>();
      let controller: AbortController | null = null;
      let stopped = false;
      let refreshAfterRequest = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      const created: {
        count: number;
        listeners: Set<(count: number) => void>;
        stop: () => void;
      } = { count: 0, listeners, stop: () => undefined };
      const refresh = async () => {
        if (stopped || document.hidden) return;
        if (controller) return;
        controller = new AbortController();
        try {
          const response = await fetch('/api/notifications', {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (response.ok) {
            const data = await response.json();
            if (!stopped) {
              created.count = Math.max(0, Number(data.unreadCount) || 0);
              listeners.forEach((listener) => listener(created.count));
            }
          }
        } catch {
          // 暂时断网时保留最后一次计数，下一轮重试。
        } finally {
          controller = null;
          if (refreshAfterRequest && !stopped) {
            refreshAfterRequest = false;
            void refresh();
          }
        }
      };
      const onUpdated = () => {
        if (controller) refreshAfterRequest = true;
        else void refresh();
      };
      const onVisibility = () => {
        if (timer) clearInterval(timer);
        timer = undefined;
        if (!document.hidden) {
          void refresh();
          timer = setInterval(() => void refresh(), 30000);
        }
      };
      created.stop = () => {
        stopped = true;
        if (timer) clearInterval(timer);
        controller?.abort();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('notificationsUpdated', onUpdated);
      };
      const onFocus = () => void refresh();
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', onFocus);
      window.addEventListener('notificationsUpdated', onUpdated);
      subscriptions.set(username, created);
      store = created;
      onVisibility();
    }
    const activeStore = store;
    const listener = (count: number) => setValue({ username, count });
    activeStore.listeners.add(listener);
    listener(activeStore.count);
    return () => {
      activeStore.listeners.delete(listener);
      if (activeStore.listeners.size === 0) {
        activeStore.stop();
        subscriptions.delete(username);
      }
    };
  }, [username]);
  return value.username === username ? value.count : 0;
}
