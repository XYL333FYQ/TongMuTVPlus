'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { clearClientMemory, clientMemoryScope } from '@/lib/client-memory';
import {
  prepareTabNavigation,
  rememberTabVisit,
  tabNavigationPending,
  takeTabRestore,
} from '@/lib/tab-memory';

/** Restore primary tabs only after their content can reach the saved position. */
export default function ClientTabMemory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = pathname + (search ? `?${search}` : '');
  useEffect(() => {
    if (!clientMemoryScope()) return;
    if (pathname === '/login' || pathname === '/register') {
      clearClientMemory();
      takeTabRestore('');
      return;
    }
    const scope = clientMemoryScope();
    const target = takeTabRestore(href);
    let restoring = Boolean(target);
    let leaving = false;
    let frame = 0;
    let fallback = 0;
    let timeout = 0;
    let observer: ResizeObserver | undefined;
    const save = () => {
      if (
        restoring ||
        leaving ||
        tabNavigationPending() ||
        clientMemoryScope() !== scope
      )
        return;
      if (document.body.style.position === 'fixed') return;
      rememberTabVisit(href, window.scrollY);
    };
    const stopRestore = () => {
      restoring = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.clearInterval(fallback);
      window.clearTimeout(timeout);
    };
    const attempt = () => {
      if (!restoring || !target) return;
      if (clientMemoryScope() !== scope) {
        stopRestore();
        return;
      }
      const available =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        ) - window.innerHeight;
      if (available + 1 < target.top) return;
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo({ top: target.top, left: 0, behavior: 'auto' });
      root.style.scrollBehavior = previous;
      if (Math.abs(window.scrollY - target.top) <= 2) {
        stopRestore();
        save();
      }
    };
    const userScroll = () => {
      stopRestore();
      save();
    };
    const key = (event: KeyboardEvent) => {
      if (
        [
          'PageDown',
          'PageUp',
          'Home',
          'End',
          'ArrowDown',
          'ArrowUp',
          ' ',
        ].includes(event.key)
      )
        userScroll();
    };
    const click = (event: MouseEvent) => {
      if (
        event.button ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null;
      if (
        !link ||
        link.target === '_blank' ||
        link.origin !== location.origin ||
        link.hasAttribute('download')
      )
        return;
      save();
      if (link.hasAttribute('data-tm-tab-link'))
        prepareTabNavigation(link.pathname + link.search);
      leaving = true;
      // A click intercepted by another control must not freeze future scrolling.
      queueMicrotask(() => {
        leaving = false;
      });
    };
    if (target) {
      frame = requestAnimationFrame(attempt);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(attempt);
        });
        observer.observe(document.body);
      } else fallback = window.setInterval(attempt, 200);
      timeout = window.setTimeout(() => {
        stopRestore();
        save();
      }, 8000);
    } else save();
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('wheel', userScroll, { passive: true });
    window.addEventListener('touchstart', userScroll, { passive: true });
    window.addEventListener('keydown', key);
    document.addEventListener('click', click, true);
    return () => {
      stopRestore();
      window.removeEventListener('scroll', save);
      window.removeEventListener('wheel', userScroll);
      window.removeEventListener('touchstart', userScroll);
      window.removeEventListener('keydown', key);
      document.removeEventListener('click', click, true);
    };
  }, [href, pathname]);
  return null;
}
