'use client';

import { RotateCw } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  isCoarsePointer,
  isHandheld,
  isInstalledWebApp,
  onDeviceTierChange,
} from '@/lib/device-tier';
import { refreshPage } from '@/lib/page-refresh';
import { getPlatform } from '@/lib/platform';
import { readSetting, writeSetting } from '@/lib/settings';
import { haptic } from '@/lib/shell-bridge';

import { notify } from '@/components/feedback/AppDialogs';

// 自制下拉刷新只在 App（安卓壳、安装到主屏幕的网页应用）里启用：这两处没有浏览器自带的下拉刷新，
// 而页面又禁了整页回弹。普通手机浏览器保留浏览器自己的下拉刷新，不重复做一套。
// 只在这些“浏览型”页面启用；播放、房间等有长连接的页面不启用，免得整页刷新打断播放。
const REFRESH_PATHS = ['/', '/douban', '/search', '/my'];
const TRIGGER = 64;
const IOS_HINT_KEY = 'tongmu:ios-install-hint-seen';

// 手机外壳（底栏 + 手机顶栏）只在手机两档出现，见 lib/device-tier.ts
function isPhoneTouch() {
  return isCoarsePointer() && isHandheld();
}

/** 手机端手势与提示：下拉刷新、前进/后退转场方向、iPhone 安装到主屏幕引导。 */
export default function MobileGestures() {
  const pathname = usePathname();
  const indicator = useRef<HTMLDivElement>(null);
  const [iosHint, setIosHint] = useState(false);
  const [phoneTouch, setPhoneTouch] = useState(false);

  useEffect(() => {
    if (getPlatform() !== 'app') return;
    const update = () => setPhoneTouch(isPhoneTouch());
    update();
    return onDeviceTierChange(update);
  }, []);

  // —— 转场方向：返回键/手势返回用“后退”，点链接用“前进” ——
  useEffect(() => {
    const root = document.documentElement;
    const onPop = () => {
      root.dataset.tmNav = 'back';
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // 底栏切换标签：像原生 App 一样直接换页，不做整页滑入（新页面渲染时动画只剩几帧，看着卡）
      if (target?.closest?.('.tm-mobile-nav')) {
        root.dataset.tmNav = 'tab';
      } else if (target?.closest?.('a[href]')) {
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
    if (!enabled || getPlatform() !== 'app' || !phoneTouch) return;
    const el = indicator.current;
    if (!el) return;
    let startY = 0;
    let startX = 0;
    let pulling = false;
    let distance = 0;
    let refreshing = false;
    let disposed = false;

    const reset = (settle = false) => {
      pulling = false;
      distance = 0;
      el.style.transition = settle
        ? 'transform 200ms ease-out, opacity 200ms'
        : '';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -48px)';
    };
    const videoPlaying = () =>
      Array.from(document.querySelectorAll('video')).some((v) => !v.paused);

    const onStart = (event: TouchEvent) => {
      if (!isPhoneTouch()) return;
      if (refreshing) return;
      reset();
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      if (document.documentElement.dataset.tmKeyboard === 'open') return;
      if (
        document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]'
        )
      )
        return;
      if (
        (event.target as Element | null)?.closest?.(
          'input, textarea, select, [contenteditable="true"], .tm-mobile-nav, [role="menu"], [role="listbox"]'
        )
      )
        return;
      if (videoPlaying()) return;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
      pulling = true;
      el.style.transition = 'none';
    };
    const onMove = (event: TouchEvent) => {
      if (!pulling) return;
      if (!isPhoneTouch() || event.touches.length !== 1) {
        reset(true);
        return;
      }
      const dy = event.touches[0].clientY - startY;
      const dx = event.touches[0].clientX - startX;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        reset(true);
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
      if (!isPhoneTouch()) {
        reset(true);
        return;
      }
      if (distance >= TRIGGER) {
        pulling = false;
        refreshing = true;
        haptic(12);
        el.style.transition = 'transform 160ms ease-out';
        el.style.transform = `translate(-50%, ${TRIGGER - 48}px)`;
        void refreshPage(pathname || '')
          .then((result) => {
            if (disposed) return;
            if (result === 'failed' || result === 'timeout')
              notify('暂时无法刷新，请稍后再试。', 'error');
            else if (result === 'unavailable')
              notify('当前页面暂无可刷新的内容。');
          })
          .catch(() => {
            if (!disposed) notify('暂时无法刷新，请稍后再试。', 'error');
          })
          .finally(() => {
            if (disposed) return;
            refreshing = false;
            reset(true);
          });
        return;
      }
      reset(true);
    };
    const onCancel = () => {
      if (!refreshing) reset(true);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onCancel);
    return () => {
      disposed = true;
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      reset();
    };
  }, [enabled, pathname, phoneTouch]);

  // —— iPhone：浏览器里打开时，引导“添加到主屏幕”以获得全屏体验 ——
  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const standalone = isInstalledWebApp();
    if (!isIos || standalone) return;
    if (readSetting(IOS_HINT_KEY)) return;
    const timer = window.setTimeout(() => setIosHint(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissHint = () => {
    writeSetting(IOS_HINT_KEY, '1');
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
          <button
            type='button'
            className='tm-btn tm-install-hint-btn'
            onClick={dismissHint}
          >
            知道了
          </button>
        </div>
      )}
    </>
  );
}
