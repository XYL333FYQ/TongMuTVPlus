'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useState } from 'react';

import {
  publishPageHeader,
  withdrawPageHeader,
} from '@/components/shell/headerStore';

import DesignGridOverlay from './DesignGridOverlay';
import { VersionCheckProvider } from './VersionCheckProvider';

// 服务端没有布局阶段，用 useEffect 代替，避免每次渲染都打印警告
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

// 底栏上的五个一级页：手机上底栏已经标明身处何处，顶部不再重复页名
const TAB_PATHS = ['/', '/douban', '/watch-room', '/search', '/my'];

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  hideNavigation?: boolean;
  embedded?: boolean;
  mobileTitle?: string;
  mobileSubtitle?: React.ReactNode;
  mobileActions?: React.ReactNode;
  /** 加载占位用：不播进场动画（真正的页面到达时再播） */
  instant?: boolean;
  /** 页面自己有手机上也看得见的一级标题：手机顶栏的页名就不再算标题，避免读屏读到两个 */
  pageHasHeading?: boolean;
}

export default function PageLayout({
  children,
  activePath,
  hideNavigation = false,
  embedded = false,
  mobileTitle,
  mobileSubtitle,
  mobileActions,
  instant = false,
  pageHasHeading = false,
}: PageLayoutProps) {
  const [backgroundImage, setBackgroundImage] = useState('');
  const pathname = usePathname();
  const current = (activePath || pathname).split('?')[0];
  // 顶栏常驻在根布局（PersistentHeader）；这里只把本页对顶栏的要求告诉它
  const headerId = useId();
  useIsomorphicLayoutEffect(() => {
    if (embedded || hideNavigation) return;
    publishPageHeader(headerId, {
      activePath,
      mobileTitle,
      mobileSubtitle,
      mobileActions,
      pageHasHeading,
    });
  }, [
    headerId,
    embedded,
    hideNavigation,
    activePath,
    mobileTitle,
    mobileSubtitle,
    mobileActions,
    pageHasHeading,
  ]);
  useIsomorphicLayoutEffect(
    () => () => withdrawPageHeader(headerId),
    [headerId]
  );
  useIsomorphicLayoutEffect(() => {
    if (embedded || hideNavigation) withdrawPageHeader(headerId);
  }, [embedded, hideNavigation, headerId]);
  useEffect(() => {
    if (embedded || hideNavigation || activePath === '/play') {
      setBackgroundImage('');
      return;
    }
    const urls =
      window.RUNTIME_CONFIG?.HOME_BACKGROUND_IMAGE?.split('\n')
        .map((url: string) => url.trim())
        .filter(Boolean) || [];
    setBackgroundImage(
      urls.length ? urls[Math.floor(Math.random() * urls.length)] : ''
    );
  }, [activePath, embedded, hideNavigation]);

  if (embedded) return <main className='tm-embedded-page'>{children}</main>;
  const isTab =
    !hideNavigation &&
    TAB_PATHS.includes(current) &&
    !mobileTitle &&
    !mobileSubtitle;
  return (
    <VersionCheckProvider>
      <DesignGridOverlay />
      <div
        data-page={current}
        data-tab={isTab}
        className={
          'tm-shell tm-shell-v2 ' +
          (hideNavigation ? 'tm-shell-no-navigation' : '')
        }
      >
        {backgroundImage && (
          <div
            className='tm-shell-backdrop'
            style={{ backgroundImage: 'url(' + backgroundImage + ')' }}
            aria-hidden='true'
          />
        )}
        <div className='tm-shell-body'>
          <main className='tm-main'>
            {!hideNavigation &&
            current !== '/play' &&
            current !== '/live' &&
            !current.startsWith('/music') ? (
              <div
                className={
                  instant
                    ? 'tm-page-transition tm-page-instant'
                    : 'tm-page-transition'
                }
                key={pathname}
              >
                {children}
              </div>
            ) : (
              children
            )}
          </main>
        </div>
        {/* 底栏常驻在根布局里；这个标记告诉样式：当前页面需要显示底栏 */}
        {!hideNavigation && <span hidden data-tm-nav-page='' />}
      </div>
    </VersionCheckProvider>
  );
}
