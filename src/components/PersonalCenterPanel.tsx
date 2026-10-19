'use client';

import { Bell, KeyRound, Monitor, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import '@/styles/panels.css';

interface PersonalCenterPanelProps {
  isOpen: boolean;
  mounted: boolean;
  onClose: () => void;
  username: string;
  roleText: string;
  showRoleBadge: boolean;
  avatarText: string;
  roleBadgeClassName: string;
  showDeviceManagement: boolean;
  showChangePassword: boolean;
  onOpenEmailSettings: () => void;
  onOpenDeviceManagement: () => void;
  onOpenChangePassword: () => void;
}

export function PersonalCenterPanel({
  isOpen,
  mounted,
  onClose,
  username,
  roleText,
  showRoleBadge,
  avatarText,
  roleBadgeClassName,
  showDeviceManagement,
  showChangePassword,
  onOpenEmailSettings,
  onOpenDeviceManagement,
  onOpenChangePassword,
}: PersonalCenterPanelProps) {
  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <div
        className='tm-profile-backdrop fixed inset-0 bg-ink/50 z-[1000]'
        onClick={onClose}
        onTouchMove={(e) => {
          e.preventDefault();
        }}
        onWheel={(e) => {
          e.preventDefault();
        }}
        style={{ touchAction: 'none' }}
      />

      <div className='tm-profile-panel fixed top-1/2 left-1/2 z-[1001] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-surface shadow-xl'>
        <div
          className='p-6'
          data-panel-content
          onTouchMove={(e) => {
            e.stopPropagation();
          }}
          style={{ touchAction: 'auto' }}
        >
          <div className='relative mb-6 flex flex-col items-center text-center'>
            <button
              onClick={onClose}
              className='absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-muted transition-[opacity,transform] hover:bg-line min-h-[44px] tm-press min-w-[44px]'
              aria-label='关闭个人中心'
            >
              <X className='w-5 h-5' />
            </button>
            <div className='mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-raised text-3xl font-medium text-fg shadow-md'>
              {avatarText}
            </div>
            {showRoleBadge && (
              <span
                className={`tm-profile-role mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium ${roleBadgeClassName} `}
              >
                {roleText}
              </span>
            )}
            <h3 className='text-lg font-medium text-fg'>{username}</h3>
          </div>

          <div className='space-y-3'>
            <button
              onClick={onOpenEmailSettings}
              className='flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-4 text-left transition-[opacity,transform] hover:bg-line min-h-[44px] tm-press min-w-[44px]'
            >
              <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-raised text-fg'>
                <Bell className='w-6 h-6' />
              </div>
              <div>
                <div className='text-base font-medium text-fg'>通知设置</div>
                <div className='mt-1 text-sm text-muted'>
                  管理邮件通知和浏览器系统通知
                </div>
              </div>
            </button>

            {showDeviceManagement && (
              <button
                onClick={onOpenDeviceManagement}
                className='flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-4 text-left transition-[opacity,transform] hover:bg-line min-h-[44px] tm-press min-w-[44px]'
              >
                <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-raised text-fg'>
                  <Monitor className='w-6 h-6' />
                </div>
                <div>
                  <div className='text-base font-medium text-fg'>设备管理</div>
                  <div className='mt-1 text-sm text-muted'>
                    查看并管理当前账号的登录设备
                  </div>
                </div>
              </button>
            )}

            {showChangePassword && (
              <button
                onClick={onOpenChangePassword}
                className='flex w-full items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-4 text-left transition-[opacity,transform] hover:bg-line min-h-[44px] tm-press min-w-[44px]'
              >
                <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-raised text-fg'>
                  <KeyRound className='w-6 h-6' />
                </div>
                <div>
                  <div className='text-base font-medium text-fg'>修改密码</div>
                  <div className='mt-1 text-sm text-muted'>
                    修改当前账号密码
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
