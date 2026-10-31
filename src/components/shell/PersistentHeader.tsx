'use client';

// 常驻顶栏：手机顶栏 + 桌面顶栏各一份，放在根布局里，切页不重建。
// 是否显示由样式决定：页面里有 PageLayout 放的 data-tm-nav-page 标记才显示
// （与底栏同一套规则），所以服务端渲染的首屏就是对的，不会先闪一下再出现。
// 页面相关的内容（指定标题、当前栏目、是否自带一级标题）从 headerStore 读取。

import { Github, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';

import { BRAND_NAME, PROJECT_REPOSITORY_URL } from '@/lib/brand';

import { BackButton } from '@/components/BackButton';
import MobileHeader from '@/components/MobileHeader';
import PageContainer from '@/components/PageContainer';
import {
  getPageHeader,
  getServerPageHeader,
  subscribePageHeader,
} from '@/components/shell/headerStore';
import {
  DesktopNavigation,
  pageTitleForPath,
} from '@/components/shell/TongMuNavigation';
import ViewerAccountButton from '@/components/shell/ViewerAccountButton';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function PersistentHeader() {
  const pathname = usePathname() || '/';
  const page = useSyncExternalStore(
    subscribePageHeader,
    getPageHeader,
    getServerPageHeader
  );
  const current = (page?.activePath || pathname).split('?')[0];
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

  return (
    <>
      <MobileHeader
        showBackButton={current === '/play' || current === '/live'}
        title={page?.mobileTitle || pageTitleForPath(current)}
        subtitle={page?.mobileSubtitle}
        actions={page?.mobileActions}
        compact={compactTitle}
        scrolled={scrolled}
        heading={!page?.pageHasHeading}
      />
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
    </>
  );
}
