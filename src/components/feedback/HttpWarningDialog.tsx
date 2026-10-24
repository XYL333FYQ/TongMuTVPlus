'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/panels.css';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useReducedMotionSetting } from '@/lib/motion';

interface HttpWarningDialogProps {
  onClose: () => void;
}

export default function HttpWarningDialog({ onClose }: HttpWarningDialogProps) {
  const reduced = useReducedMotionSetting();
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    // 检查是否应该显示弹窗
    const checkShouldShow = () => {
      // 只在客户端执行
      if (typeof window === 'undefined') return false;

      // 检查是否已经选择不再提示
      const dontShowAgain = localStorage.getItem('httpWarningDismissed');
      if (dontShowAgain === 'true') return false;

      // 检查是否是站长
      const authInfo = getAuthInfoFromBrowserCookie();
      if (!authInfo || authInfo.role !== 'owner') return false;

      // 检查是否是 HTTP 环境（非 localhost 和 127.0.0.1）
      const { protocol, hostname } = window.location;
      const isHttp = protocol === 'http:';
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

      // 只在 HTTP 且非本地环境下显示
      return isHttp && !isLocalhost;
    };

    const shouldDisplay = checkShouldShow();
    setShouldShow(shouldDisplay);

    if (shouldDisplay) {
      // 延迟显示动画
      showTimer.current = setTimeout(() => setIsVisible(true), 100);
    }
    return () => {
      if (showTimer.current !== null) clearTimeout(showTimer.current);
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleDontShowAgain = () => {
    localStorage.setItem('httpWarningDismissed', 'true');
    handleClose();
  };

  const handleClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (showTimer.current !== null) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setIsVisible(false);
    closeTimer.current = setTimeout(
      () => {
        onCloseRef.current();
      },
      reduced ? 120 : 320
    );
  };

  // 弹窗出现后把焦点放到“我知道了”，Esc 关闭，Tab 只在弹窗内循环；关闭后焦点交还原处
  useEffect(() => {
    if (!shouldShow) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    primaryRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const buttons = Array.from(
        panelRef.current.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)'
        )
      );
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [shouldShow]);

  // 如果不需要显示，直接返回 null
  if (!shouldShow) return null;

  return createPortal(
    <div
      className={`tm-http-warning-backdrop fixed inset-0 bg-ink/50 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } `}
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className={`tm-http-warning-panel bg-surface rounded-lg shadow-xl max-w-md w-full border border-line transition-[transform,opacity] duration-300 ${
          isVisible ? 'tm-http-warning-shown' : 'tm-http-warning-hidden'
        } `}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='p-6'>
          {/* 图标和标题 */}
          <div className='flex items-start gap-4 mb-4'>
            <div className='flex-shrink-0'>
              <AlertTriangle className='w-8 h-8 text-fg' aria-hidden />
            </div>
            <div className='flex-1'>
              <h3 id={titleId} className='text-lg font-medium text-fg mb-2'>
                HTTP 环境功能限制提示
              </h3>
              <div className='text-sm text-muted space-y-2'>
                <p>
                  检测到您正在使用 HTTP
                  协议访问本站。由于浏览器安全策略限制，以下功能将无法正常使用:
                </p>
                <ul className='list-disc list-inside space-y-1 ml-2'>
                  <li>视频超分（AI 画质增强）</li>
                  <li>麦克风语音功能</li>
                  <li>其他需要安全上下文的高级功能</li>
                </ul>
                <p className='mt-3 text-fg font-medium'>
                  建议配置 HTTPS 证书以获得完整功能体验。
                </p>
              </div>
            </div>
          </div>

          {/* 按钮组 */}
          <div className='flex gap-3 mt-6'>
            <button
              type='button'
              onClick={handleDontShowAgain}
              className='flex-1 px-4 py-2 text-sm font-medium text-muted bg-raised hover:bg-line rounded-lg transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px]'
            >
              不再提示
            </button>
            <button
              ref={primaryRef}
              type='button'
              onClick={handleClose}
              className='flex-1 px-4 py-2 text-sm font-medium text-inverse bg-fg hover:opacity-90 rounded-lg transition-[opacity,transform] min-h-[44px] tm-press min-w-[44px]'
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
