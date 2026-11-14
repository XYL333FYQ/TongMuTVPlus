'use client';

/*
 * 独立看会话：全站只有一个，挂在根布局。
 * 播放器节点在“播放页的画面位置”和“右下角小窗”之间搬动，视频不中断。
 * 不认识房间：一起看有自己的播放器；进房间时调用 suspend() 把这里暂停收起。
 */

import { usePathname } from 'next/navigation';
import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import {
  WatchEngineApi,
  WatchPresentation,
  WatchSession,
  WatchSessionContext,
} from './context';
import WatchEngine from './WatchEngine';
import { parseWatchHref } from '../media/useWatchMedia';
import MiniPlayer from '../mini/MiniPlayer';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** 同一部影片（同线路同 id）只换集，不重建播放器 */
function sameFilm(a: string | null, b: string) {
  if (!a) return false;
  const left = parseWatchHref(a);
  const right = parseWatchHref(b);
  return !!left.source && left.source === right.source && left.id === right.id;
}

export function normalizeWatchHref(value: string) {
  try {
    const url = new URL(value, 'https://tongmu.invalid');
    if (url.pathname !== '/play') return null;
    return `/play${url.search}`;
  } catch {
    return null;
  }
}

export default function WatchSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = useState<{ href: string | null; key: number }>({
    href: null,
    key: 0,
  });
  const [pageSlot, setPageSlot] = useState<HTMLElement | null>(null);
  const [miniSlot, setMiniSlot] = useState<HTMLElement | null>(null);
  const [parking, setParking] = useState<HTMLElement | null>(null);
  const [engine, setEngine] = useState<WatchEngineApi | null>(null);
  const [suspended, setSuspended] = useState(false);
  const mount = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const element = document.createElement('div');
    element.className = 'tm-watch-mount';
    return element;
  }, []);

  const onPage = pathname === '/play';
  const presentation: WatchPresentation = !session.href
    ? 'hidden'
    : onPage && pageSlot
    ? 'page'
    : suspended || onPage
    ? 'hidden'
    : 'mini';

  // 把播放器节点放到当前形态的位置
  useIsomorphicLayoutEffect(() => {
    if (!mount) return;
    const target =
      presentation === 'page'
        ? pageSlot
        : presentation === 'mini'
        ? miniSlot
        : parking;
    if (target && mount.parentElement !== target) target.appendChild(mount);
  }, [mount, presentation, pageSlot, miniSlot, parking]);

  useEffect(() => {
    document.documentElement.dataset.tmWatch = presentation;
    return () => {
      delete document.documentElement.dataset.tmWatch;
    };
  }, [presentation]);

  const open = useCallback(
    (raw: string) => {
      const href = normalizeWatchHref(raw);
      if (!href) return;
      setSuspended(false);
      setSession((current) => {
        if (current.href === href) return current;
        if (sameFilm(current.href, href) && engine) {
          const episode = parseWatchHref(href).episode;
          if (episode !== undefined) engine.media.changeEpisode(episode);
          return { ...current, href };
        }
        return { href, key: current.key + 1 };
      });
    },
    [engine]
  );

  const close = useCallback(() => {
    setSession((current) => ({ href: null, key: current.key + 1 }));
    setEngine(null);
  }, []);

  const suspend = useCallback(() => {
    engine?.player?.pause();
    setSuspended(true);
  }, [engine]);

  const replaceHref = useCallback((href: string) => {
    setSession((current) =>
      current.href === href ? current : { ...current, href }
    );
    if (
      window.location.pathname === '/play' &&
      `${window.location.pathname}${window.location.search}` !== href
    )
      window.history.replaceState(window.history.state, '', href);
  }, []);

  const value = useMemo<WatchSession>(
    () => ({
      href: session.href,
      presentation,
      engine,
      open,
      close,
      suspend,
      registerSlot: setPageSlot,
    }),
    [session.href, presentation, engine, open, close, suspend]
  );

  return (
    <WatchSessionContext.Provider value={value}>
      {children}
      <div ref={setParking} hidden aria-hidden='true' />
      {session.href && mount && (
        <WatchEngine
          key={session.key}
          href={session.href}
          mount={mount}
          replaceHref={replaceHref}
          onApi={setEngine}
          onPage={presentation === 'page'}
          suspended={suspended}
        />
      )}
      {presentation === 'mini' && engine && (
        <MiniPlayer engine={engine} onSlot={setMiniSlot} onClose={close} />
      )}
    </WatchSessionContext.Provider>
  );
}
