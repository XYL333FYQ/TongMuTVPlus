'use client';

import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownLeft,
  Home,
  Keyboard,
  Menu,
  Monitor,
  Power,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './tv-surfaces.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';
import type {
  TVRemoteDevice,
  TVRemoteKey,
  TVRemoteTextMode,
} from '@/lib/tv-remote-types';

type TVRemotePanelProps = {
  isOpen: boolean;
  mounted: boolean;
  onClose: () => void;
};

type SocketResponse<T = unknown> = {
  success: boolean;
  error?: string;
} & T;

function RemoteButton({
  label,
  onPress,
  repeatable = false,
  className = '',
  children,
}: {
  label: string;
  onPress: (repeat?: boolean) => void;
  repeatable?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const delayRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearRepeat = () => {
    if (delayRef.current) window.clearTimeout(delayRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    delayRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => clearRepeat, []);

  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (!repeatable || event.detail === 0) onPress(false);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        if (!repeatable) return;
        onPress(false);
        clearRepeat();
        delayRef.current = window.setTimeout(() => {
          intervalRef.current = window.setInterval(() => onPress(true), 130);
        }, 360);
      }}
      onPointerUp={clearRepeat}
      onPointerCancel={clearRepeat}
      onPointerLeave={clearRepeat}
      className={`tm-tv-remote-button flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)] shadow-sm hover:bg-[var(--tm-line)] min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] ${className}`}
    >
      {children}
    </button>
  );
}

export default function TVRemotePanel({
  isOpen,
  mounted,
  onClose,
}: TVRemotePanelProps) {
  const [devices, setDevices] = useState<TVRemoteDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [closing, setClosing] = useState(false);
  const reduced = useReducedMotionSetting();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const closeRequested = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedDevice =
    devices.find((device) => device.deviceId === selectedDeviceId) || null;

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tv-remote/devices', {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '无法获取电视端列表');
      }

      const nextDevices = Array.isArray(data.devices) ? data.devices : [];
      setDevices(nextDevices);
      setSelectedDeviceId((current) => {
        if (
          nextDevices.some(
            (device: TVRemoteDevice) => device.deviceId === current
          )
        ) {
          return current;
        }
        return nextDevices[0]?.deviceId || '';
      });
      setStatus(nextDevices.length ? '' : '没有在线的 Web 电视端');
    } catch (error) {
      setDevices([]);
      setSelectedDeviceId('');
      setStatus(error instanceof Error ? error.message : '无法获取电视端列表');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    void loadDevices();

    return () => {
      setDevices([]);
      setSelectedDeviceId('');
      setStatus('');
      setLoading(false);
    };
  }, [isOpen, loadDevices]);

  const sendKey = async (key: TVRemoteKey, repeat = false, digit?: string) => {
    if (!selectedDeviceId || closeRequested.current) return;
    try {
      const response = await fetch('/api/tv-remote/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          command: { key, repeat, digit },
        }),
      });
      const data: SocketResponse = await response.json().catch(() => ({
        success: false,
        error: '发送失败',
      }));
      if (!response.ok || !data.success) {
        setStatus(data.error || '发送失败');
      }
    } catch {
      setStatus('发送失败');
    }
  };

  const sendText = async (mode: TVRemoteTextMode, value = text) => {
    if (!selectedDeviceId || closeRequested.current) return;
    try {
      const response = await fetch('/api/tv-remote/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          command: { mode, text: value },
        }),
      });
      const data: SocketResponse = await response.json().catch(() => ({
        success: false,
        error: '文本发送失败',
      }));
      if (!response.ok || !data.success) {
        setStatus(data.error || '文本发送失败');
      } else if (mode === 'append' || mode === 'replace') {
        setStatus('文本已发送到电视端输入框');
      }
    } catch {
      setStatus('文本发送失败');
    }
  };

  const requestClose = useCallback(() => {
    if (closeRequested.current) return;
    closeRequested.current = true;
    setClosing(true);
    dismissTimer.current = setTimeout(
      () => {
        dismissTimer.current = null;
        closeCallback.current();
      },
      isReducedMotionSetting() ? 120 : 320
    );
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    closeRequested.current = false;
    setClosing(false);
    const nativeModal = typeof dialog.showModal === 'function';
    if (nativeModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    closeRef.current?.focus({ preventScroll: true });

    const cancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!nativeModal && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }
      if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const targets = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
        )
      ).filter(
        (node) =>
          node.getClientRects().length || process.env.NODE_ENV === 'test'
      );
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('cancel', cancel);
    dialog.addEventListener('keydown', keys);
    return () => {
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('keydown', keys);
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      const target = trigger?.isConnected
        ? trigger
        : Array.from(
            document.querySelectorAll<HTMLElement>('[aria-label="账号菜单"]')
          ).find((node) => node.getClientRects().length > 0);
      target?.focus({ preventScroll: true });
    };
  }, [isOpen, mounted, requestClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      className='tm-tv-remote-layer'
      data-closing={closing}
    >
      <motion.div
        className='tm-tv-remote-backdrop fixed inset-0 z-[1000] bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_60%,transparent)]'
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{
          duration: reduced ? 0.12 : closing ? 0.32 : 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        onClick={requestClose}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
      />
      <motion.div
        className='tm-tv-remote-dialog fixed inset-x-3 top-1/2 z-[1001] mx-auto max-h-[94vh] max-w-md -translate-y-1/2 overflow-hidden rounded-3xl border border-[var(--tm-line)] bg-[var(--tm-surface)] shadow-2xl shadow-[color-mix(in_srgb,var(--tm-room-cinema-bg)_30%,transparent)]'
        style={{ transform: 'translateY(-50%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <motion.div
          className='tm-tv-remote-content max-h-[94vh] overflow-y-auto p-5'
          initial={{ y: reduced ? 0 : 8 }}
          animate={{ y: closing && !reduced ? 8 : 0 }}
          transition={{
            duration: reduced ? 0.12 : 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
          data-panel-content
          onTouchMove={(e) => e.stopPropagation()}
          style={{ touchAction: 'auto' }}
        >
          <div className='mb-4 flex items-start justify-between gap-4'>
            <div>
              <div className='inline-flex items-center gap-2 rounded-full bg-[var(--tm-surface-raised)] px-3 py-1 text-[13px] font-medium text-[color:var(--tm-text)]'>
                <Power className='h-4 w-4' />
                TV REMOTE
              </div>
              <h3
                id={titleId}
                className='mt-3 text-2xl font-medium text-[color:var(--tm-text)]'
              >
                电视遥控器
              </h3>
            </div>
            <button
              ref={closeRef}
              type='button'
              onClick={requestClose}
              className='flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[color:var(--tm-muted)] transition-[transform,opacity] hover:bg-[var(--tm-line)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              aria-label='关闭遥控器'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          <div className='mb-4 rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-3'>
            <div className='mb-2 flex items-center justify-between gap-2'>
              <div className='flex items-center gap-2 text-sm font-medium text-[color:var(--tm-muted)] text-[color:var(--tm-text)]'>
                <Monitor className='h-4 w-4' />
                在线电视端
              </div>
              <button
                type='button'
                onClick={() => loadDevices()}
                className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[color:var(--tm-muted)] transition-[transform,opacity] hover:bg-[var(--tm-line)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                aria-label='刷新电视端列表'
              >
                {loading ? (
                  <span
                    aria-hidden
                    className='tm-skeleton block rounded-md h-4 w-4'
                  />
                ) : (
                  <RefreshCw className='h-4 w-4' />
                )}
              </button>
            </div>

            {devices.length > 0 ? (
              <div className='grid gap-2'>
                {devices.map((device) => (
                  <button
                    key={device.deviceId}
                    type='button'
                    onClick={() => setSelectedDeviceId(device.deviceId)}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-left min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] ${
                      selectedDeviceId === device.deviceId
                        ? 'border-[var(--tm-line)] bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)]'
                        : 'border-[var(--tm-line)] bg-[var(--tm-surface)] text-[color:var(--tm-muted)] hover:border-[var(--tm-text)]'
                    }`}
                  >
                    <div className='truncate text-sm font-medium'>
                      {device.deviceName}
                    </div>
                    <div className='mt-0.5 truncate text-[13px] opacity-70'>
                      {device.currentPath}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className='rounded-xl border border-dashed border-[var(--tm-line)] bg-[var(--tm-surface)] px-3 py-4 text-center text-sm font-medium text-[color:var(--tm-muted)]'>
                {loading ? '正在查找在线电视端...' : '没有在线的 Web 电视端'}
              </div>
            )}
          </div>

          <div className='grid grid-cols-3 gap-3'>
            <RemoteButton
              label='返回'
              onPress={() => sendKey('back')}
              className='h-14 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <RotateCcw className='h-6 w-6' />
            </RemoteButton>
            <RemoteButton
              label='主页'
              onPress={() => sendKey('home')}
              className='h-14 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <Home className='h-6 w-6' />
            </RemoteButton>
            <RemoteButton
              label='菜单'
              onPress={() => sendKey('menu')}
              className='h-14 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <Menu className='h-6 w-6' />
            </RemoteButton>

            <div />
            <RemoteButton
              label='上'
              onPress={(repeat) => sendKey('up', repeat)}
              repeatable
              className='h-16 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <ChevronUp className='h-9 w-9' />
            </RemoteButton>
            <div />

            <RemoteButton
              label='左'
              onPress={(repeat) => sendKey('left', repeat)}
              repeatable
              className='h-16 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <ChevronLeft className='h-9 w-9' />
            </RemoteButton>
            <RemoteButton
              label='确认'
              onPress={() => sendKey('ok')}
              className='tm-tv-remote-confirm h-16 rounded-full'
            >
              <CornerDownLeft className='h-8 w-8' />
            </RemoteButton>
            <RemoteButton
              label='右'
              onPress={(repeat) => sendKey('right', repeat)}
              repeatable
              className='h-16 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <ChevronRight className='h-9 w-9' />
            </RemoteButton>

            <div />
            <RemoteButton
              label='下'
              onPress={(repeat) => sendKey('down', repeat)}
              repeatable
              className='h-16 min-h-[44px] min-w-[44px] tm-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            >
              <ChevronDown className='h-9 w-9' />
            </RemoteButton>
            <div />
          </div>

          <div className='mt-4 grid grid-cols-5 gap-2'>
            {Array.from({ length: 10 }, (_, index) =>
              String((index + 1) % 10)
            ).map((digit) => (
              <button
                key={digit}
                type='button'
                onClick={() => sendKey('digit', false, digit)}
                className='h-11 cursor-pointer rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] text-lg font-medium text-[color:var(--tm-text)] transition-[transform,opacity] hover:border-[var(--tm-line)] hover:bg-[var(--tm-line)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              >
                {digit}
              </button>
            ))}
          </div>

          <div className='mt-4 rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-3'>
            <div className='mb-2 flex items-center gap-2 text-sm font-medium text-[color:var(--tm-muted)] text-[color:var(--tm-text)]'>
              <Keyboard className='h-4 w-4' />
              文本输入
            </div>
            <textarea
              aria-label='发送到电视的文字'
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder='输入后发送到电视端当前输入框'
              className='w-full resize-none rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface)] px-3 py-2 text-sm text-[color:var(--tm-text)] outline-none transition-[transform,opacity] focus:border-[var(--tm-line)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tm-text)_20%,transparent)]'
            />
            <div className='mt-2 grid grid-cols-4 gap-2'>
              <button
                type='button'
                onClick={() => sendText('replace')}
                className='col-span-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--tm-text)] px-3 py-2 text-sm font-medium text-[color:var(--tm-accent-contrast)] transition-[transform,opacity] hover:opacity-90 min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              >
                <Send className='h-4 w-4' />
                发送
              </button>
              <button
                type='button'
                onClick={() => sendText('backspace', '')}
                className='cursor-pointer rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--tm-muted)] transition-[transform,opacity] hover:border-[var(--tm-line)] text-[color:var(--tm-text)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              >
                退格
              </button>
              <button
                type='button'
                onClick={() => {
                  setText('');
                  sendText('clear', '');
                }}
                className='cursor-pointer rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface)] px-3 py-2 text-sm font-medium text-[color:var(--tm-muted)] transition-[transform,opacity] hover:border-[var(--tm-line)] text-[color:var(--tm-text)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
              >
                清空
              </button>
            </div>
          </div>

          {(status || selectedDevice) && (
            <p className='mt-3 rounded-2xl bg-[var(--tm-surface-raised)] px-3 py-2 text-center text-[13px] font-medium text-[color:var(--tm-muted)]'>
              {status || `正在控制：${selectedDevice?.deviceName}`}
            </p>
          )}
        </motion.div>
      </motion.div>
    </dialog>,
    document.body
  );
}
