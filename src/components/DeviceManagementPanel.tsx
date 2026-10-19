'use client';

import { LucideIcon, Monitor, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface DeviceItem {
  tokenId: string;
  deviceInfo: string;
  isCurrent: boolean;
  createdAt: string;
  lastUsed: string;
}

interface DeviceManagementPanelProps {
  isOpen: boolean;
  mounted: boolean;
  onClose: () => void;
  devices: DeviceItem[];
  devicesLoading: boolean;
  revoking: string | null;
  onRevokeDevice: (tokenId: string) => void;
  onRevokeAllDevices: () => void;
  getDeviceIcon: (deviceInfo: string) => LucideIcon;
}

export function DeviceManagementPanel({
  isOpen,
  mounted,
  onClose,
  devices,
  devicesLoading,
  revoking,
  onRevokeDevice,
  onRevokeAllDevices,
  getDeviceIcon,
}: DeviceManagementPanelProps) {
  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <div
        className='fixed inset-0 bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)] backdrop-blur-sm z-[1000]'
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
      />

      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--tm-surface)] rounded-xl shadow-xl z-[1001] overflow-hidden'>
        <div
          className='h-full max-h-[80vh] flex flex-col'
          data-panel-content
          onTouchMove={(e) => e.stopPropagation()}
          style={{ touchAction: 'auto' }}
        >
          <div className='flex items-center justify-between p-6 border-b border-[var(--tm-line)]'>
            <h3 className='text-xl font-bold text-[color:var(--tm-text)]'>
              设备管理
            </h3>
            <button
              onClick={onClose}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-[color:var(--tm-muted)] hover:bg-[var(--tm-line)] transition-colors min-h-[44px] tm-press'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          <div className='flex-1 overflow-y-auto p-6'>
            {devicesLoading ? (
              <div className='space-y-3'>
                {[1, 2, 3].map((i) => (
                  <div key={i} className='tm-skeleton'>
                    <div className='h-20 bg-[var(--tm-surface-raised)] rounded-lg'></div>
                  </div>
                ))}
                <div className='text-center text-sm text-[color:var(--tm-muted)] mt-4'>
                  加载中...
                </div>
              </div>
            ) : devices.length === 0 ? (
              <div className='text-center py-8'>
                <Monitor className='w-12 h-12 mx-auto text-[color:var(--tm-muted)] mb-3' />
                <p className='text-sm text-[color:var(--tm-muted)]'>
                  暂无登录设备
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {devices
                  .slice()
                  .sort((a, b) => {
                    if (a.isCurrent && !b.isCurrent) return -1;
                    if (!a.isCurrent && b.isCurrent) return 1;
                    return 0;
                  })
                  .map((device) => {
                    const DeviceIcon = getDeviceIcon(device.deviceInfo);
                    return (
                      <div
                        key={device.tokenId}
                        className={`p-4 bg-[var(--tm-surface-raised)] bg-[var(--tm-surface-raised)] rounded-lg border ${
                          device.isCurrent
                            ? 'border-[var(--tm-line)]'
                            : 'border-[var(--tm-line)]'
                        }`}
                      >
                        <div className='flex items-start justify-between'>
                          <div className='flex-1'>
                            <div className='flex items-center gap-2 mb-2'>
                              <DeviceIcon className='w-4 h-4 text-[color:var(--tm-muted)]' />
                              <span className='text-sm font-medium text-[color:var(--tm-text)]'>
                                {device.deviceInfo}
                              </span>
                              {device.isCurrent && (
                                <span className='px-2 py-0.5 text-[13px] font-medium bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] rounded-full'>
                                  当前设备
                                </span>
                              )}
                            </div>
                            <div className='space-y-1 text-[13px] text-[color:var(--tm-muted)]'>
                              <div>
                                登录时间:{' '}
                                {new Date(device.createdAt).toLocaleString(
                                  'zh-CN'
                                )}
                              </div>
                              <div>
                                最后活跃:{' '}
                                {new Date(device.lastUsed).toLocaleString(
                                  'zh-CN'
                                )}
                              </div>
                            </div>
                          </div>
                          {!device.isCurrent && (
                            <button
                              onClick={() => onRevokeDevice(device.tokenId)}
                              disabled={revoking === device.tokenId}
                              className='ml-3 px-3 py-1.5 text-[13px] font-medium text-[color:var(--tm-text)] hover:text-[color:var(--tm-text)] border border-[var(--tm-line)] hover:border-[var(--tm-line)] hover:bg-[var(--tm-line)] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] tm-press'
                            >
                              {revoking === device.tokenId
                                ? '撤销中...'
                                : '撤销'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className='p-6 border-t border-[var(--tm-line)] space-y-3'>
            <button
              onClick={onRevokeAllDevices}
              disabled={devices.length === 0}
              className='w-full px-4 py-2.5 bg-[var(--tm-text)] hover:opacity-90 disabled:bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed min-h-[44px] tm-press'
            >
              登出所有设备
            </button>
            <p className='text-[13px] text-[color:var(--tm-muted)] text-center'>
              登出所有设备后需要重新登录
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
