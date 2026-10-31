'use client';

import { RotateCw } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getPlatform } from '@/lib/platform';
import { haptic } from '@/lib/shell-bridge';

// 自制下拉刷新只在 App（安卓壳、安装到主屏幕的网页应用）里启用：这两处没有浏览器自带的下拉刷新，
// 而页面又禁了整页回弹。普通手机浏览器保留浏览器自己的下拉刷新，不重复做一套。
// 只在这些“浏览型”页面启用；播放、房间等有长连接的页面不启用，免得整页刷新打断播放。
const REFRESH_PATHS = ['/', '/douban', '/search', '/my'];
const TRIGGER = 64;
const IOS_HINT_KEY = 'tongmu:ios-install-hint-seen';

function isPhoneTouch() {
  return (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 767px)').matches
  );
}

/** 手机端手势与提示：下拉刷新、前进/后退转场方向、iPhone 安装到主屏幕引导。 */
export default function MobileGestures() {
  const pathname = usePathname();
  const indicator = useRef<HTMLDivElement>(null);
  const [iosHint, setIosHint] = useState(false);

  // —— 转场方向：返回键/手势返回用“后退”，点链接用“前进” ——
  useEffect(() => {
    const root = document.documentElement;
    const onPop = () => {
      root.dataset.tmNav = 'back';
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.('a[href]')) {
        root.dataset.tmNav = 'forward';
      }
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  // —— 下拉刷新 ——
  const enabled = REFRESH_PATHS.includes(pathname || '');
  useEffect(() => {
    if (!enabled || getPlatform() !== 'app' || !isPhoneTouch()) return;
    const el = indicator.current;
    if (!el) return;
    let startY = 0;
    let pulling = false;
    let distance = 0;

    const reset = () => {
      pulling = false;
      distance = 0;
      el.style.transition = '';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -48px)';
    };
    const videoPlaying = () =>
      Array.from(document.querySelectorAll('video')).some((v) => !v.paused);

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (videoPlaying()) return;
      startY = event.touches[0].clientY;
      pulling = true;
      el.style.transition = 'none';
    };
    const onMove = (event: TouchEvent) => {
      if (!pulling) return;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        reset();
        return;
      }
      distance = dy * 0.5;
      const shown = Math.min(distance, TRIGGER + 16);
      el.style.opacity = String(Math.min(1, distance / TRIGGER));
      el.style.transform = `translate(-50%, ${shown - 48}px) rotate(${
        distance * 4
      }deg)`;
    };
    const onEnd = () => {
      if (!pulling) return;
      if (distance >= TRIGGER) {
        haptic(12);
        el.style.transition = 'transform 160ms ease-out';
        el.style.transform = `translate(-50%, ${TRIGGER - 48}px)`;
        window.location.reload();
        return;
      }
      el.style.transition = 'transform 200ms ease-out, opacity 200ms';
      reset();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  // —— iPhone：浏览器里打开时，引导“添加到主屏幕”以获得全屏体验 ——
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (!isIos || standalone) return;
    try {
      if (localStorage.getItem(IOS_HINT_KEY)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => setIosHint(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissHint = () => {
    try {
      localStorage.setItem(IOS_HINT_KEY, '1');
    } catch {
      // 存储不可用时本次关闭即可
    }
    setIosHint(false);
  };

  return (
    <>
      {enabled && (
        <div ref={indicator} className='tm-ptr' aria-hidden='true'>
          <RotateCw size={20} />
        </div>
      )}
      {iosHint && (
        <div className='tm-install-hint tm-glass' role='status'>
          <p>全屏使用更像 App：点浏览器底部的“分享”，选“添加到主屏幕”。</p>
          <button type='button' className='tm-btn' onClick={dismissHint}>
            知道了
          </button>
        </div>
      )}
    </>
  );
}
