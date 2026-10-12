/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ChevronLeft, PanelLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

import { BRAND_NAME } from '@/lib/brand';

import {
  ExploreMenu,
  isPrimaryNavigationActive,
  primaryNavigation,
} from './TongMuNavigation';

const SidebarContext = createContext({ isCollapsed: true });
export const useSidebar = () => useContext(SidebarContext);

declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
    RUNTIME_CONFIG?: {
      EnableComments?: boolean;
      RecommendationDataSource?: string;
      [key: string]: any;
    };
  }
}

interface SidebarProps {
  onToggle?: (collapsed: boolean) => void;
  activePath?: string;
}

export default function Sidebar({ onToggle, activePath }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) setIsCollapsed(saved === 'true');
    } catch {
      /* The compact navigation also works without browser storage. */
    }
  }, []);
  useEffect(() => {
    window.__sidebarCollapsed = isCollapsed;
    if (isCollapsed) document.documentElement.dataset.sidebarCollapsed = 'true';
    else delete document.documentElement.dataset.sidebarCollapsed;
  }, [isCollapsed]);
  if (pathname === '/watch-room/screen') return null;
  const current = (activePath || pathname).split('?')[0];
  const toggle = () => {
    const collapsed = !isCollapsed;
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('sidebarCollapsed', String(collapsed));
    } catch {
      /* optional preference */
    }
    onToggle?.(collapsed);
  };
  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <div
        className='hidden md:block tm-sidebar-offset'
        data-collapsed={isCollapsed}
      >
        <aside
          className='tm-sidebar'
          data-sidebar
          data-collapsed={isCollapsed}
          aria-label='网站导航'
        >
          <Link
            href='/'
            prefetch={false}
            className='tm-sidebar-brand'
            aria-label={BRAND_NAME + ' 首页'}
          >
            <span className='tm-brand-symbol' aria-hidden='true'>
              <svg viewBox='0 0 32 32' fill='none'>
                <rect
                  x='8'
                  y='7'
                  width='16'
                  height='18'
                  rx='4'
                  stroke='currentColor'
                  strokeWidth='1.5'
                />
                <path d='m13 12 8 4-8 4z' fill='currentColor' />
                <path
                  d='M4 11v10M28 11v10'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                />
              </svg>
            </span>
            {!isCollapsed && (
              <span className='tm-wordmark'>
                TongMu<span>TV</span>
                <small>Plus</small>
              </span>
            )}
          </Link>
          <nav className='tm-sidebar-links'>
            {primaryNavigation.map((item) => {
              const active = isPrimaryNavigationActive(item.href, current);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className='tm-sidebar-link'
                  data-active={active}
                  aria-current={active ? 'page' : undefined}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon size={23} strokeWidth={active ? 2 : 1.6} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className='tm-sidebar-footer'>
            <ExploreMenu compact={isCollapsed} />
            <button
              className='tm-sidebar-collapse'
              onClick={toggle}
              aria-label={isCollapsed ? '展开导航' : '收起导航'}
            >
              {isCollapsed ? (
                <PanelLeft size={19} />
              ) : (
                <ChevronLeft size={19} />
              )}
              {!isCollapsed && <span>收起导航</span>}
            </button>
          </div>
        </aside>
      </div>
    </SidebarContext.Provider>
  );
}
