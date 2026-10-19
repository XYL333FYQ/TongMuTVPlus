/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Bell, Check, Settings, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { Notification } from '@/lib/types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNotificationSettings?: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  onOpenNotificationSettings,
}) => {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载通知
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('加载通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 标记为已读
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notificationId,
        }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        // 触发事件通知 UserMenu 更新未读计数
        window.dispatchEvent(new Event('notificationsUpdated'));
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 删除通知
  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          notificationId,
        }),
      });

      if (response.ok) {
        const deletedNotification = notifications.find(
          (n) => n.id === notificationId
        );
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        // 如果删除的是未读通知，触发事件更新 UserMenu
        if (deletedNotification && !deletedNotification.read) {
          window.dispatchEvent(new Event('notificationsUpdated'));
        }
      }
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  // 清空所有通知
  const clearAll = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear_all',
        }),
      });

      if (response.ok) {
        setNotifications([]);
        // 触发事件通知 UserMenu 更新未读计数
        window.dispatchEvent(new Event('notificationsUpdated'));
      }
    } catch (error) {
      console.error('清空通知失败:', error);
    }
  };

  // 处理通知点击
  const handleNotificationClick = (notification: Notification) => {
    // 标记为已读
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // 根据通知类型跳转
    if (notification.type === 'favorite_update' && notification.metadata) {
      const { source, id, title } = notification.metadata;
      router.push(
        `/play?source=${source}&id=${id}&title=${encodeURIComponent(title)}`
      );
      onClose();
    } else if (notification.type === 'manga_update' && notification.metadata) {
      const { sourceId, mangaId, title, cover, sourceName } =
        notification.metadata;
      const params = new URLSearchParams({
        sourceId,
        mangaId,
        title: title || '',
        cover: cover || '',
        sourceName: sourceName || '',
      });
      router.push(`/manga/detail?${params.toString()}`);
      onClose();
    } else if (notification.type === 'movie_request') {
      // 获取用户角色
      const authInfo = getAuthInfoFromBrowserCookie();
      const isAdmin = authInfo?.role === 'owner' || authInfo?.role === 'admin';

      // 管理员跳转到管理面板，普通用户跳转到我的求片
      router.push(isAdmin ? '/admin' : '/movie-request');
      onClose();
    }
  };

  const handleOpenNotificationSettings = () => {
    onOpenNotificationSettings?.();
  };

  // 打开面板时加载通知
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)] backdrop-blur-sm z-[1000]'
        onClick={onClose}
      />

      {/* 通知面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg min-h-[520px] max-h-[80vh] bg-[var(--tm-surface)] rounded-xl shadow-xl z-[1001] flex flex-col overflow-hidden max-sm:min-h-[70vh]'>
        {/* 标题栏 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--tm-line)]'>
          <div className='flex items-center gap-2'>
            <Bell className='w-5 h-5 text-[color:var(--tm-muted)]' />
            <h3 className='text-lg font-bold text-[color:var(--tm-text)]'>
              通知中心
            </h3>
            {notifications.length > 0 && (
              <span className='px-2 py-0.5 text-[13px] font-medium bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] rounded-full'>
                {notifications.filter((n) => !n.read).length} 条未读
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className='text-[13px] text-[color:var(--tm-text)] hover:text-[color:var(--tm-text)] transition-colors min-h-[44px] tm-press'
              >
                清空全部
              </button>
            )}
            <button
              onClick={onClose}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-[color:var(--tm-muted)] hover:bg-[var(--tm-line)] transition-colors min-h-[44px] tm-press'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>
        </div>

        {/* 通知列表 */}
        <div className='flex flex-1 flex-col overflow-y-auto p-4'>
          {onOpenNotificationSettings && (
            <button
              type='button'
              onClick={handleOpenNotificationSettings}
              className='mb-3 flex w-full items-center gap-2 rounded-lg border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--tm-line)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] focus:ring-offset-2 focus:ring-offset-[var(--tm-text)] min-h-[44px] tm-press'
            >
              <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]'>
                <Settings className='h-4 w-4' />
              </div>
              <span className='min-w-0 flex-1 text-sm text-[color:var(--tm-muted)] text-[color:var(--tm-text)]'>
                开启邮件通知或当前设备浏览器系统通知后，重要更新可在站外提醒您
              </span>
              <span className='shrink-0 text-[13px] font-medium text-[color:var(--tm-text)]'>
                去配置
              </span>
            </button>
          )}

          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='w-8 h-8 border-4 border-[var(--tm-line)] border-t-transparent rounded-full animate-spin'></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className='flex flex-1 flex-col items-center justify-center py-12 text-[color:var(--tm-muted)]'>
              <Bell className='w-12 h-12 mb-3 opacity-30' />
              <p className='text-sm'>暂无通知</p>
            </div>
          ) : (
            <div className='space-y-2'>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative p-4 rounded-lg border transition-all cursor-pointer ${
                    notification.read
                      ? 'bg-[var(--tm-surface-raised)] border-[var(--tm-line)]'
                      : 'bg-[var(--tm-surface-raised)] border-[var(--tm-line)]'
                  } hover:shadow-md`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* 未读标识 */}
                  {!notification.read && (
                    <div className='absolute top-4 right-4 w-2 h-2 bg-[var(--tm-text)] rounded-full'></div>
                  )}

                  {/* 通知内容 */}
                  <div className='pr-8'>
                    <div className='flex items-start justify-between mb-1'>
                      <h4 className='text-sm font-medium text-[color:var(--tm-text)]'>
                        {notification.title}
                      </h4>
                    </div>
                    <p className='text-sm text-[color:var(--tm-muted)] mb-2'>
                      {notification.message}
                    </p>
                    <p className='text-[13px] text-[color:var(--tm-muted)]'>
                      {new Date(notification.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className='absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className='p-1.5 rounded-full bg-[var(--tm-surface-raised)] hover:bg-[var(--tm-line)] transition-colors min-h-[44px] tm-press'
                        title='标记为已读'
                      >
                        <Check className='w-3.5 h-3.5 text-[color:var(--tm-text)]' />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className='p-1.5 rounded-full bg-[var(--tm-surface-raised)] hover:bg-[var(--tm-line)] transition-colors min-h-[44px] tm-press'
                      title='删除'
                    >
                      <Trash2 className='w-3.5 h-3.5 text-[color:var(--tm-text)]' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
