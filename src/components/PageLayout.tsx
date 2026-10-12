'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BRAND_NAME } from '@/lib/brand';

import { BackButton } from './BackButton';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import PageContainer from './PageContainer';
import { DesktopNavigation, pageTitleForPath } from './TongMuNavigation';
import { VersionCheckProvider } from './VersionCheckProvider';
import ViewerAccountButton from './ViewerAccountButton';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
  hideNavigation?: boolean;
  embedded?: boolean;
  mobileTitle?: string;
  mobileActions?: React.ReactNode;
}

export default function PageLayout({
  children,
  activePath,
  hideNavigation = false,
  embedded = false,
  mobileTitle,
  mobileActions,
}: PageLayoutProps) {
  const [backgroundImage, setBackgroundImage] = useState('');
  const pathname = usePathname();
  const current = (activePath || pathname).split('?')[0];
  const [scrolled, setScrolled] = useState(false);
  const [compactTitle, setCompactTitle] = useState(false);
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
  return (
    <VersionCheckProvider>
      <div
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
              actions={mobileActions}
              compact={compactTitle}
              scrolled={scrolled}
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
                    <strong>{BRAND_NAME}</strong>
                  </Link>
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
              <div className='tm-page-transition' key={pathname}>
                {children}
              </div>
            ) : (
              children
            )}
          </main>
        </div>
        {!hideNavigation && <MobileBottomNav activePath={activePath} />}
      </div>
    </VersionCheckProvider>
  );
}
