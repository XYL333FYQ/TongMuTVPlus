'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  isPrimaryNavigationActive,
  primaryNavigation,
} from './TongMuNavigation';

interface MobileBottomNavProps {
  activePath?: string;
}

export default function MobileBottomNav({ activePath }: MobileBottomNavProps) {
  const pathname = usePathname();
  if (pathname === '/watch-room/screen') return null;
  const current = (activePath || pathname).split('?')[0];
  return (
    <nav className='tm-mobile-nav tm-glass md:hidden' aria-label='主导航'>
      {primaryNavigation.map((item) => {
        const active = isPrimaryNavigationActive(item.href, current);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className='tm-mobile-nav-item tm-press'
            data-active={active}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon size={22} strokeWidth={active ? 2 : 1.65} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
