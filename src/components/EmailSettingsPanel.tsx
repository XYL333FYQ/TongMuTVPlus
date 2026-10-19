'use client';

import { Bell, Info, Mail, MonitorSmartphone, Send, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

interface EmailSettingsPanelProps {
  isOpen: boolean;
  mounted: boolean;
  onClose: () => void;
  userEmail: string;
  onUserEmailChange: (value: string) => void;
  emailNotifications: boolean;
  onEmailNotificationsChange: (value: boolean) => void;
  pushNotifications: boolean;
  onPushNotificationsChange: (value: boolean) => void;
  pushNotificationsSupported: boolean;
  pushNotificationsConfigured: boolean;
  pushNotificationsBusy: boolean;
  telegramEnabled?: boolean;
  telegramBound?: boolean;
  telegramUsername?: string;
  telegramBindCode?: string;
  telegramDeepLink?: string;
  telegramBindingBusy?: boolean;
  onCreateTelegramBindCode?: () => void;
  emailSettingsLoading: boolean;
  emailSettingsSaving: boolean;
  onSave: () => void;
  statusMessage?: string;
  statusType?: 'success' | 'error' | null;
}

type NotificationTab = 'email' | 'push' | 'telegram';

function Toggle({
  checked,
  disabled,
  busy,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`tm-press relative inline-flex h-11 w-12 shrink-0 items-center rounded-full bg-transparent before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 before:h-7 before:-translate-y-1/2 before:rounded-full before:transition-colors before:duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'before:bg-[var(--tm-text)]'
          : 'before:bg-[var(--tm-surface-raised)]'
      }`}
    >
      <span
        className={`relative inline-flex h-5 w-5 transform items-center justify-center rounded-full shadow-sm transition-transform duration-200 ${
          checked
            ? 'translate-x-6 bg-[var(--tm-accent-contrast)]'
            : 'translate-x-1 bg-[var(--tm-text)]'
        }`}
      >
        {busy ? (
          <span className='h-3 w-3 animate-spin rounded-full border-2 border-[var(--tm-line)] border-t-transparent' />
        ) : null}
      </span>
    </button>
  );
}

export function EmailSettingsPanel({
  isOpen,
  mounted,
  onClose,
  userEmail,
  onUserEmailChange,
  emailNotifications,
  onEmailNotificationsChange,
  pushNotifications,
  onPushNotificationsChange,
  pushNotificationsSupported,
  pushNotificationsConfigured,
  pushNotificationsBusy,
  telegramEnabled,
  telegramBound,
  telegramUsername,
  telegramBindCode,
  telegramDeepLink,
  telegramBindingBusy,
  onCreateTelegramBindCode,
  emailSettingsLoading,
  emailSettingsSaving,
  onSave,
  statusMessage,
  statusType,
}: EmailSettingsPanelProps) {
  const [notificationTab, setNotificationTab] =
    useState<NotificationTab>('email');

  if (!isOpen || !mounted) return null;

  const pushDisabled =
    emailSettingsSaving ||
    pushNotificationsBusy ||
    (!pushNotifications &&
      (!pushNotificationsConfigured || !pushNotificationsSupported));

  const telegramNotifyEnabled = Boolean(telegramEnabled);

  const tabs = [
    { key: 'email' as const, label: '邮件通知', icon: Mail },
    { key: 'push' as const, label: '浏览器通知', icon: MonitorSmartphone },
    { key: 'telegram' as const, label: 'Telegram', icon: Send },
  ];

  return createPortal(
    <>
      <div
        className='fixed inset-0 z-[1000] bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)] backdrop-blur-sm'
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
      />

      <div className='fixed left-1/2 top-1/2 z-[1001] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-[var(--tm-surface)] shadow-xl'>
        <div
          className='max-h-[85vh] overflow-y-auto p-6'
          data-panel-content
          onTouchMove={(e) => e.stopPropagation()}
          style={{ touchAction: 'auto' }}
        >
          <div className='mb-6 flex items-start justify-between gap-4'>
            <div>
              <div className='mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]'>
                <Bell className='h-5 w-5' />
              </div>
              <h3 className='text-xl font-bold text-[color:var(--tm-text)]'>
                通知设置
              </h3>
              <p className='mt-1 text-sm text-[color:var(--tm-muted)]'>
                管理邮件通知、浏览器系统通知和 Telegram Bot 通知。
              </p>
            </div>
            <button
              onClick={onClose}
              className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--tm-muted)] transition-colors hover:bg-[var(--tm-line)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] tm-press'
              aria-label='关闭通知设置'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          {/* 三区域切换式导航 — 与电视访问一致 */}
          <div className='mb-5 grid grid-cols-3 rounded-2xl bg-[var(--tm-surface-raised)] p-1'>
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = notificationTab === item.key;
              return (
                <button
                  key={item.key}
                  type='button'
                  onClick={() => setNotificationTab(item.key)}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--tm-text)_70%,transparent)] ${
                    active
                      ? 'bg-[var(--tm-surface)] text-[color:var(--tm-text)] shadow-sm min-h-[44px] tm-press'
                      : 'text-[color:var(--tm-muted)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press'
                  }`}
                >
                  <Icon className='h-4 w-4' />
                  <span className='hidden sm:inline'>{item.label}</span>
                  <span className='sm:hidden'>
                    {item.key === 'email'
                      ? '邮件'
                      : item.key === 'push'
                      ? '浏览器'
                      : 'Telegram'}
                  </span>
                </button>
              );
            })}
          </div>

          {emailSettingsLoading ? (
            <div className='space-y-4' aria-live='polite'>
              <div className='tm-skeleton rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
                <div className='mb-3 h-5 w-28 rounded bg-[var(--tm-surface-raised)]' />
                <div className='h-10 rounded bg-[var(--tm-surface-raised)]' />
              </div>
              <div className='tm-skeleton rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
                <div className='mb-3 h-5 w-32 rounded bg-[var(--tm-surface-raised)]' />
                <div className='h-16 rounded bg-[var(--tm-surface-raised)]' />
              </div>
              <p className='text-center text-sm text-[color:var(--tm-muted)]'>
                加载中...
              </p>
            </div>
          ) : (
            <>
              {/* 邮件通知 */}
              {notificationTab === 'email' && (
                <section className='rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
                  <div className='mb-4 flex items-start gap-3'>
                    <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]'>
                      <Mail className='h-5 w-5' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <h4 className='text-base font-medium text-[color:var(--tm-text)]'>
                        邮件通知
                      </h4>
                      <p className='mt-1 text-sm text-[color:var(--tm-muted)]'>
                        用于接收收藏影视更新等异步提醒，可独立于系统通知关闭。
                      </p>
                    </div>
                  </div>

                  <label className='mb-2 block text-sm font-medium text-[color:var(--tm-muted)]'>
                    邮箱地址
                  </label>
                  <input
                    type='email'
                    value={userEmail}
                    onChange={(e) => onUserEmailChange(e.target.value)}
                    placeholder='输入您的邮箱地址'
                    disabled={emailSettingsSaving}
                    className='mb-4 w-full rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface)] px-3 py-2.5 text-sm text-[color:var(--tm-text)] transition-colors placeholder:text-[color:var(--tm-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] disabled:cursor-not-allowed disabled:opacity-50'
                  />

                  <div className='flex items-center justify-between gap-4 rounded-xl bg-[var(--tm-surface)] p-3'>
                    <div>
                      <h5 className='text-sm font-medium text-[color:var(--tm-text)]'>
                        收藏更新邮件
                      </h5>
                      <p className='mt-1 text-[13px] text-[color:var(--tm-muted)]'>
                        当收藏的影片有更新时发送邮件通知。
                      </p>
                    </div>
                    <Toggle
                      checked={emailNotifications}
                      disabled={emailSettingsSaving}
                      label='切换收藏更新邮件通知'
                      onChange={() =>
                        onEmailNotificationsChange(!emailNotifications)
                      }
                    />
                  </div>
                </section>
              )}

              {/* 浏览器系统通知 */}
              {notificationTab === 'push' && (
                <section className='rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
                  <div className='mb-4 flex items-start gap-3'>
                    <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]'>
                      <MonitorSmartphone className='h-5 w-5' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <h4 className='text-base font-medium text-[color:var(--tm-text)]'>
                        当前设备浏览器系统通知
                      </h4>
                      <p className='mt-1 text-sm text-[color:var(--tm-muted)]'>
                        当前设备收到站内通知时，通过浏览器推送到系统通知中心。
                      </p>
                    </div>
                    <Toggle
                      checked={pushNotifications}
                      disabled={pushDisabled}
                      busy={pushNotificationsBusy}
                      label='切换当前设备浏览器系统通知'
                      onChange={() =>
                        onPushNotificationsChange(!pushNotifications)
                      }
                    />
                  </div>

                  <div className='space-y-2 rounded-xl bg-[var(--tm-surface)] p-3'>
                    <div className='flex items-center justify-between gap-3 text-sm'>
                      <span className='text-[color:var(--tm-muted)]'>
                        当前设备
                      </span>
                      <span
                        className={`font-medium ${
                          pushNotificationsSupported
                            ? 'text-[color:var(--tm-text)]'
                            : 'text-[color:var(--tm-text)]'
                        }`}
                      >
                        {pushNotificationsSupported ? '可用' : '需支持或授权'}
                      </span>
                    </div>
                    {!pushNotificationsConfigured && (
                      <p
                        className='text-[13px] text-[color:var(--tm-text)]'
                        role='alert'
                      >
                        系统正在初始化 Web Push 密钥，请稍后重试。
                      </p>
                    )}
                    {pushNotificationsConfigured &&
                      !pushNotificationsSupported && (
                        <p
                          className='text-[13px] text-[color:var(--tm-text)]'
                          role='alert'
                        >
                          当前浏览器、系统权限或登录模式暂不支持系统通知。
                        </p>
                      )}
                  </div>
                </section>
              )}

              {/* Telegram 通知 */}
              {notificationTab === 'telegram' && (
                <>
                  {telegramNotifyEnabled ? (
                    <section className='rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
                      <div className='mb-4 flex items-start gap-3'>
                        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]'>
                          <Send className='h-5 w-5' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h4 className='text-base font-medium text-[color:var(--tm-text)]'>
                            Telegram Bot 通知
                          </h4>
                          <p className='mt-1 text-sm text-[color:var(--tm-muted)]'>
                            绑定 Telegram 后可接收站内通知，也可在登录页使用
                            Telegram 确认登录。
                          </p>
                        </div>
                      </div>
                      <div className='space-y-3 rounded-xl bg-[var(--tm-surface)] p-3'>
                        <div className='flex items-center justify-between gap-3 text-sm'>
                          <span className='text-[color:var(--tm-muted)]'>
                            绑定状态
                          </span>
                          <span
                            className={`font-medium ${
                              telegramBound
                                ? 'text-[color:var(--tm-text)]'
                                : 'text-[color:var(--tm-text)]'
                            }`}
                          >
                            {telegramBound
                              ? `已绑定${
                                  telegramUsername
                                    ? ` @${telegramUsername}`
                                    : ''
                                }`
                              : '未绑定'}
                          </span>
                        </div>
                        {!telegramBound && (
                          <>
                            {telegramBindCode && (
                              <div className='rounded-lg bg-[var(--tm-surface-raised)] p-3 text-sm text-[color:var(--tm-text)]'>
                                绑定码：
                                <span className='font-mono text-base font-bold'>
                                  {telegramBindCode}
                                </span>
                                <p className='mt-1 text-[13px]'>
                                  在 Bot 中发送 /bind {telegramBindCode}
                                  ，或点击下方按钮打开 Telegram。
                                </p>
                              </div>
                            )}
                            <div className='flex gap-2'>
                              <button
                                type='button'
                                onClick={onCreateTelegramBindCode}
                                disabled={telegramBindingBusy}
                                className='flex-1 rounded-lg bg-[var(--tm-text)] px-3 py-2 text-sm font-medium text-[color:var(--tm-accent-contrast)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--tm-text)] min-h-[44px] tm-press'
                              >
                                {telegramBindingBusy
                                  ? '生成中...'
                                  : '生成绑定码'}
                              </button>
                              {telegramDeepLink && (
                                <button
                                  type='button'
                                  onClick={() =>
                                    window.open(
                                      telegramDeepLink,
                                      '_blank',
                                      'noopener,noreferrer'
                                    )
                                  }
                                  className='flex-1 rounded-lg border border-[var(--tm-line)] px-3 py-2 text-sm font-medium text-[color:var(--tm-text)] transition-colors hover:bg-[var(--tm-line)] min-h-[44px] tm-press'
                                >
                                  打开 Telegram
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                  ) : (
                    <section className='rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
                      <div className='mb-4 flex items-start gap-3'>
                        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tm-surface-raised)] text-[color:var(--tm-muted)]'>
                          <Send className='h-5 w-5' />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h4 className='text-base font-medium text-[color:var(--tm-text)]'>
                            Telegram Bot 通知
                          </h4>
                          <p className='mt-1 text-sm text-[color:var(--tm-muted)]'>
                            当前站点未启用 Telegram Bot 通知功能。
                          </p>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}

              <button
                onClick={onSave}
                disabled={emailSettingsSaving}
                className='mt-[10px] flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tm-text)] px-4 py-2.5 text-sm font-medium text-[color:var(--tm-accent-contrast)] transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--tm-text)] focus:ring-offset-[var(--tm-text)] min-h-[44px] tm-press'
              >
                {emailSettingsSaving ? (
                  <>
                    <span className='h-4 w-4 animate-spin rounded-full border-2 border-[var(--tm-line)] border-t-transparent' />
                    <span>保存中...</span>
                  </>
                ) : (
                  '保存通知设置'
                )}
              </button>

              {statusMessage ? (
                <p
                  role={statusType === 'error' ? 'alert' : 'status'}
                  className={`text-center text-[13px] ${
                    statusType === 'success'
                      ? 'text-[color:var(--tm-text)]'
                      : 'text-[color:var(--tm-text)]'
                  }`}
                >
                  {statusMessage}
                </p>
              ) : null}
            </>
          )}

          <div className='mt-6 flex gap-2 rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-3'>
            <Info className='mt-0.5 h-4 w-4 shrink-0 text-[color:var(--tm-text)]' />
            <p className='text-[13px] leading-5 text-[color:var(--tm-text)]'>
              邮件通知需要管理员配置邮件服务；浏览器系统通知需要当前浏览器授权。
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
