'use client';

import { motion } from 'framer-motion';
import {
  Film,
  Heart,
  Home,
  MonitorPlay,
  Radio,
  Search,
  Sparkles,
  Tv,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef } from 'react';

import './tv.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';

import PageContainer from '@/components/PageContainer';

import TVVirtualRemote from './TVVirtualRemote';

const navItems = [
  { label: '搜索', href: '/tv/search', icon: Search },
  { label: '主页', href: '/tv', icon: Home },
  { label: '电影', href: '/tv/movie', icon: Film },
  { label: '剧集', href: '/tv/series', icon: Tv },
  { label: '动漫', href: '/tv/anime', icon: Sparkles },
  { label: '综艺', href: '/tv/variety', icon: MonitorPlay },
  { label: '直播', href: '/tv/live', icon: Radio },
  { label: '私人影库', href: '/tv/private', icon: Heart },
  { label: '我的', href: '/tv/me', icon: User },
];

export default function TVLayout({
  children,
  showNav = true,
}: {
  children: ReactNode;
  showNav?: boolean;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotionSetting();
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!showNav) return;
    let frame = 0;
    const revealSelection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const container = nav.current;
        const selected = container?.querySelector<HTMLElement>(
          '[aria-current="page"]'
        );
        if (!container || !selected) return;
        const bounds = container.getBoundingClientRect();
        const item = selected.getBoundingClientRect();
        const outside =
          item.left < bounds.left + 4 || item.right > bounds.right - 4;
        const immediate = isReducedMotionSetting();
        if (!outside && !immediate) return;
        container.scrollTo({
          left: outside
            ? container.scrollLeft +
              item.left -
              bounds.left -
              (bounds.width - item.width) / 2
            : container.scrollLeft,
          behavior: immediate ? 'auto' : 'smooth',
        });
      });
    };
    revealSelection();
    window.addEventListener('resize', revealSelection);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', revealSelection);
    };
  }, [pathname, reduced, showNav]);

  useEffect(() => {
    if (!showNav || pathname !== '/tv') return;

    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) return;

      document
        .querySelector<HTMLElement>('[data-tv-home-nav="true"]')
        ?.focus({ preventScroll: true });
    });
  }, [pathname, showNav]);

  return (
    <main className='tm-tv-shell'>
      <div className='tm-tv-background' aria-hidden='true' />
      {showNav && (
        <header className='tm-tv-header tm-glass'>
          <nav ref={nav} className='tm-tv-nav' aria-label='电视导航'>
            {navItems.map((item) => {
              const active =
                item.href === '/tv'
                  ? pathname === '/tv'
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tv-home-nav={item.href === '/tv' ? 'true' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className='tm-tv-nav-link tv-focusable tm-press'
                >
                  {active && (
                    <motion.span
                      className='tm-tv-nav-selection'
                      layoutId={reduced ? undefined : 'tv-navigation-selection'}
                      initial={false}
                      transition={{
                        duration: reduced ? 0.12 : 0.32,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      aria-hidden='true'
                    />
                  )}
                  <Icon className='h-5 w-5' aria-hidden='true' />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>
      )}
      <PageContainer
        className={`tm-tv-content relative z-10 pb-16 ${
          showNav ? 'pt-32' : 'pt-16'
        }`}
      >
        {children}
      </PageContainer>
      <TVVirtualRemote />
    </main>
  );
}
