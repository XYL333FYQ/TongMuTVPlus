'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import '@/styles/panels.css';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useReducedMotionSetting } from '@/lib/motion';
import { isOwnerRole } from '@/lib/roles';
import { readSetting, writeSetting } from '@/lib/settings';

import ModalLayer from '@/components/feedback/ModalLayer';

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
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 检查是否应该显示弹窗
    const checkShouldShow = () => {
      // 只在客户端执行
      if (typeof window === 'undefined') return false;

      // 检查是否已经选择不再提示
      const dontShowAgain = readSetting('httpWarningDismissed');
      if (dontShowAgain === 'true') return false;

      // 检查是否是站长
      const authInfo = getAuthInfoFromBrowserCookie();
      if (!authInfo || !isOwnerRole(authInfo.role)) return false;

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
    writeSetting('httpWarningDismissed', 'true');
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

  // 如果不需要显示，直接返回 null
  if (!shouldShow) return null;

  // 弹窗层负责遮罩、Esc / 返回键 / 点外面关闭、焦点和滚动锁；出现后焦点在“我知道了”
  return (
    <ModalLayer
      label='HTTP 环境功能限制提示'
      onClose={handleClose}
      className='tm-http-warning-backdrop'
      initialFocus={primaryRef}
    >
      <div
        className={`tm-http-warning-panel tm-httpw-div-1 ${
          isVisible ? 'tm-http-warning-shown' : 'tm-http-warning-hidden'
        }`}
      >
        <div className='tm-httpw-div-2'>
          {/* 图标和标题 */}
          <div className='tm-httpw-div-3'>
            <div className='tm-httpw-div-4'>
              <AlertTriangle className='tm-httpw-alerttriangle-1' aria-hidden />
            </div>
            <div className='tm-httpw-div-5'>
              <h3 className='tm-httpw-h3-1'>HTTP 环境功能限制提示</h3>
              <div className='tm-httpw-div-6'>
                <p>
                  检测到您正在使用 HTTP
                  协议访问本站。由于浏览器安全策略限制，以下功能将无法正常使用:
                </p>
                <ul className='tm-httpw-ul-1'>
                  <li>视频超分（AI 画质增强）</li>
                  <li>麦克风语音功能</li>
                  <li>其他需要安全上下文的高级功能</li>
                </ul>
                <p className='tm-httpw-p-1'>
                  建议配置 HTTPS 证书以获得完整功能体验。
                </p>
              </div>
            </div>
          </div>

          {/* 按钮组 */}
          <div className='tm-httpw-div-7'>
            <button
              type='button'
              onClick={handleDontShowAgain}
              className='tm-httpw-button-1 tm-press'
            >
              不再提示
            </button>
            <button
              ref={primaryRef}
              type='button'
              onClick={handleClose}
              className='tm-httpw-button-2 tm-press'
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
