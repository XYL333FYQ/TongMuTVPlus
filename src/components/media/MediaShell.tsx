'use client';

import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { useReducedMotionSetting } from '@/lib/motion';

import {
  LIBRARY_FOCUS,
  LIBRARY_ICON_BUTTON_GHOST,
  LIBRARY_MUTED,
  LIBRARY_PAGE,
  LIBRARY_SERIF,
  LIBRARY_TEXT,
  SPINE_TAB_ACTIVE,
  SPINE_TAB_IDLE,
} from '@/components/media/library';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

export interface MediaShellTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * 漫画与小说共用的页面外壳（顶栏 + 二级 tab + 移动端底栏）。
 *
 * 两套功能仍然各有自己的外壳实例与作用域，这里只是把重复的 200 余行收敛成一份。
 * 外壳复用全站黑白 token 和容器。阅读页与
 * 书库页共用同一套外壳，区别只剩两处——阅读页把二级 tab 换成阅读器动作按钮，
 * 内容区用各功能自己的 reader.mainClassName。
 */
export default function MediaShell({
  children,
  siteName,
  title,
  subtitle,
  backHref,
  tabs,
  reader,
}: {
  children: React.ReactNode;
  siteName: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  tabs: MediaShellTab[];
  reader?: {
    actions: React.ReactNode;
    /** 阅读页内容区的完整样式，由各功能保持原值，避免阅读页布局回归 */
    mainClassName: string;
  };
}) {
  const pathname = usePathname();
  const isReader = Boolean(reader);
  const isActive = (href: string) => pathname === href;
  const navigationId = useId();
  const reduced = useReducedMotionSetting();
  const HeaderContainer = isReader ? 'div' : PageContainer;

  return (
    <PageLayout activePath={pathname} embedded={isReader} mobileTitle={title}>
      <div
        className={cn(
          'min-h-screen',
          isReader ? 'tm-media-reader' : 'tm-media-shell',
          LIBRARY_PAGE,
          LIBRARY_TEXT
        )}
      >
        <header
          className='tm-media-page-head fixed inset-x-0 top-0 z-40 border-b border-line bg-[color:color-mix(in_srgb,var(--tm-bg)_95%,transparent)] backdrop-blur-none'
          style={{
            paddingTop: isReader ? 'var(--tm-safe-top)' : undefined,
          }}
        >
          <HeaderContainer
            className={cn(
              'tm-media-page-head-row flex min-w-0 h-14 items-center gap-3 sm:h-16',
              isReader && 'mx-auto max-w-7xl px-3 sm:px-6'
            )}
          >
            <div className='flex min-w-0 flex-1 items-center gap-2'>
              {backHref ? (
                <Link
                  href={backHref}
                  aria-label='返回'
                  className={cn(LIBRARY_ICON_BUTTON_GHOST, LIBRARY_FOCUS)}
                >
                  <ChevronLeft className='h-5 w-5' />
                </Link>
              ) : (
                <Link
                  href='/'
                  className={cn(
                    'flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-medium tm-press',
                    LIBRARY_SERIF,
                    'text-fg hover:bg-raised',
                    LIBRARY_FOCUS
                  )}
                >
                  {siteName}
                </Link>
              )}
              <div className='min-w-0'>
                <div
                  className={cn(
                    'tm-media-page-title truncate text-lg font-bold',
                    LIBRARY_SERIF
                  )}
                  title={title}
                >
                  {title}
                </div>
                {subtitle && (
                  <div className={cn('truncate text-[13px]', LIBRARY_MUTED)}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            {isReader ? (
              <div className='ml-auto flex shrink-0 items-center gap-1'>
                {reader?.actions}
              </div>
            ) : null}
          </HeaderContainer>
        </header>

        {!isReader && (
          <nav
            aria-label={`${tabs[0]?.href === '/books' ? '电子书' : '漫画'}导航`}
            className='tm-media-subnav z-30 bg-canvas'
          >
            <PageContainer>
              <div className='tm-media-nav-list'>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = isActive(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'tm-media-nav-link flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium tm-press',
                        LIBRARY_FOCUS,
                        active ? SPINE_TAB_ACTIVE : SPINE_TAB_IDLE
                      )}
                    >
                      <Icon className='h-4 w-4 shrink-0' />
                      <span>{tab.label}</span>
                      {active && (
                        <motion.span
                          aria-hidden
                          className='tm-media-nav-indicator'
                          layoutId={`${navigationId}-navigation`}
                          transition={{
                            duration: reduced ? 0 : 0.2,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </PageContainer>
          </nav>
        )}
        <main
          className={cn(
            reader
              ? cn('mx-auto max-w-7xl', reader.mainClassName)
              : 'pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(5rem+var(--tm-safe-top))] sm:pt-[calc(6rem+var(--tm-safe-top))] lg:pb-10'
          )}
        >
          {isReader ? children : <PageContainer>{children}</PageContainer>}
        </main>
      </div>
    </PageLayout>
  );
}
