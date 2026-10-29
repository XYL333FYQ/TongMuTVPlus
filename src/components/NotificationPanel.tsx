/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Bell, Check, Settings, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ModalLayer from '@/components/feedback/ModalLayer';
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
    if (notification.type === 'system' && notification.metadata?.feedbackId) {
      const authInfo = getAuthInfoFromBrowserCookie();
      const isAdmin = authInfo?.role === 'owner' || authInfo?.role === 'admin';
      router.push(
        isAdmin
          ? `/admin?section=feedbackInbox&feedbackId=${encodeURIComponent(
              notification.metadata.feedbackId
            )}&notice=${Date.now()}`
          : '/feedback'
      );
      onClose();
    } else if (
      notification.type === 'favorite_update' &&
      notification.metadata
    ) {
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
      const requestId = notification.metadata?.requestId;
      router.push(
        isAdmin
          ? `/admin?section=movieRequests${
              requestId ? `&requestId=${encodeURIComponent(requestId)}` : ''
            }&notice=${Date.now()}`
          : '/movie-request'
      );
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
    <ModalLayer label='通知中心' onClose={onClose}>
      {/* 通知面板：原生模态层负责遮罩、焦点约束与 Esc */}
      <div className='tm-modal w-full max-w-lg min-h-[520px] max-h-[80dvh] bg-surface rounded-xl shadow-xl flex flex-col overflow-hidden max-sm:min-h-[70dvh]'>
        {/* 标题栏 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-line'>
          <div className='flex items-center gap-2'>
            <Bell className='w-5 h-5 text-muted' />
            <h3 className='text-lg font-bold text-fg'>通知中心</h3>
            {notifications.length > 0 && (
              <span className='px-2 py-0.5 text-[13px] font-medium bg-raised text-fg rounded-full'>
                {notifications.filter((n) => !n.read).length} 条未读
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className='text-[13px] text-fg hover:text-fg transition-colors min-h-[44px] tm-press'
              >
                清空全部
              </button>
            )}
            <button
              onClick={onClose}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
              aria-label='关闭通知中心'
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
              className='mb-3 flex w-full items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2.5 text-left transition-colors hover:bg-line focus:outline-none focus:ring-2 focus:ring-fg focus:ring-offset-2 focus:ring-offset-fg min-h-[44px] tm-press'
            >
              <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-fg'>
                <Settings className='h-4 w-4' />
              </div>
              <span className='min-w-0 flex-1 text-sm text-fg'>
                开启邮件通知或当前设备浏览器系统通知后，重要更新可在站外提醒您
              </span>
              <span className='shrink-0 text-[13px] font-medium text-fg'>
                去配置
              </span>
            </button>
          )}

          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='w-8 h-8 border-4 border-line border-t-transparent rounded-full animate-spin'></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className='flex flex-1 flex-col items-center justify-center py-12 text-muted'>
              <Bell className='w-12 h-12 mb-3 opacity-30' />
              <p className='text-sm'>暂无通知</p>
            </div>
          ) : (
            <div className='space-y-2'>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative p-4 rounded-lg border transition-all cursor-pointer ${
                    notification.read ? 'border-line' : 'bg-raised border-line'
                  } hover:shadow-md`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* 未读标识 */}
                  {!notification.read && (
                    <div className='absolute top-4 right-4 w-2 h-2 bg-fg rounded-full'></div>
                  )}

                  {/* 通知内容 */}
                  <div className='pr-8'>
                    <div className='flex items-start justify-between mb-1'>
                      <h4 className='text-sm font-medium text-fg'>
                        {notification.title}
                      </h4>
                    </div>
                    <p className='text-sm text-muted mb-2'>
                      {notification.message}
                    </p>
                    <p className='text-[13px] text-muted'>
                      {new Date(notification.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  {/* 操作按钮：常驻可见（触屏没有悬停），点按区 44×44 */}
                  <div className='-mb-2 -mr-2 mt-1 flex items-center justify-end gap-1'>
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className='flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted transition-colors hover:bg-line hover:text-fg tm-press'
                        title='标记为已读'
                        aria-label='标记为已读'
                      >
                        <Check className='h-4 w-4' />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className='flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted transition-colors hover:bg-line hover:text-fg tm-press'
                      title='删除'
                      aria-label='删除通知'
                    >
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalLayer>
  );
};
