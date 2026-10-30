'use client';

import { Github, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { BRAND_NAME, PROJECT_REPOSITORY_URL } from '@/lib/brand';

import {
  DesktopNavigation,
  pageTitleForPath,
} from '@/components/shell/TongMuNavigation';
import ViewerAccountButton from '@/components/shell/ViewerAccountButton';

import { BackButton } from './BackButton';
import DesignGridOverlay from './DesignGridOverlay';
import MobileHeader from './MobileHeader';
import PageContainer from './PageContainer';
import { ThemeToggle } from './ThemeToggle';
import { VersionCheckProvider } from './VersionCheckProvider';

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
  const [scrolled, setScrolled] = useState(false);
  const [compactTitle, setCompactTitle] = useState(false);
  const repositoryHintId = useId();
  const [repositoryHintVisible, setRepositoryHintVisible] = useState(false);
  useEffect(() => {
    const update = () => {
      // Existing pages can scroll the body rather than the window.
      const top = Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop
      );
      setScrolled(top > 8);
      setCompactTitle(top > 40);
    };
    update();
    window.addEventListener('scroll', update, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', update, true);
  }, [pathname]);
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
        {!hideNavigation && (
          <>
            <MobileHeader
              showBackButton={activePath === '/play' || activePath === '/live'}
              title={mobileTitle || pageTitleForPath(current)}
              subtitle={mobileSubtitle}
              actions={mobileActions}
              compact={compactTitle}
              scrolled={scrolled}
              tab={isTab}
              heading={!pageHasHeading}
            />
          </>
        )}
        <div className='tm-shell-body'>
          {!hideNavigation && (
            <header className='tm-top-header' data-scrolled={scrolled}>
              <div className='tm-header-glass tm-glass' aria-hidden='true' />
              <PageContainer className='tm-top-header-grid'>
                <div className='tm-header-brand'>
                  {['/play', '/live'].includes(current) && <BackButton />}
                  <Link
                    href='/'
                    className='tm-logo tm-press'
                    aria-label={`${BRAND_NAME} 首页`}
                  >
                    <span aria-hidden='true'>TM</span>
                    <strong>TongMuTV</strong>
                  </Link>
                  <span
                    className='tm-repository-trigger'
                    onMouseEnter={() => setRepositoryHintVisible(true)}
                    onMouseLeave={() => setRepositoryHintVisible(false)}
                    onFocusCapture={() => setRepositoryHintVisible(true)}
                    onBlurCapture={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setRepositoryHintVisible(false);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && repositoryHintVisible) {
                        event.preventDefault();
                        setRepositoryHintVisible(false);
                      }
                    }}
                  >
                    <a
                      href={PROJECT_REPOSITORY_URL}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='tm-shell-icon tm-press min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg'
                      aria-label={`${BRAND_NAME} GitHub 仓库（在新标签页打开）`}
                      aria-describedby={
                        repositoryHintVisible ? repositoryHintId : undefined
                      }
                      onClick={() => setRepositoryHintVisible(false)}
                    >
                      <Github size={20} aria-hidden='true' />
                    </a>
                    {repositoryHintVisible && (
                      <span
                        id={repositoryHintId}
                        role='tooltip'
                        className='tm-repository-tooltip'
                      >
                        <span>{BRAND_NAME} 项目仓库</span>
                      </span>
                    )}
                  </span>
                </div>
                <DesktopNavigation current={current} />
                <div className='tm-header-actions'>
                  <Link
                    href='/search'
                    className='tm-shell-icon tm-press'
                    aria-label='搜索'
                  >
                    <Search size={17} />
                  </Link>
                  <ThemeToggle />
                  <ViewerAccountButton />
                </div>
              </PageContainer>
            </header>
          )}
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
