'use client';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { SearchResult } from '@/lib/types';
import { usePlaybackSession } from './context';
import { createPlaybackPort, type PlaybackPort } from './port';

const PortContext = createContext<PlaybackPort | null>(null);
const MediaDetailContext = createContext<SearchResult | null>(null);
export const usePlaybackPort = () => useContext(PortContext);
export const usePlaybackMediaDetail = () => useContext(MediaDetailContext);
function selectionKey(href: string | null) {
  const params = new URL(href || '/play', 'https://tongmu.invalid')
    .searchParams;
  return params.get('mediaRef')
    ? JSON.stringify([
        params.get('source'),
        params.get('id'),
        params.get('mediaRef'),
      ])
    : null;
}

/** Adds no DOM and never owns, moves or recreates the player's video element. */
export function PlaybackPortProvider({ children }: { children: ReactNode }) {
  const session = usePlaybackSession();
  const [override, setOverride] = useState<{
    key: string;
    detail: SearchResult;
  } | null>(null);
  const current = useRef(session);
  current.current = session;
  const port = useRef<ReturnType<typeof createPlaybackPort> | null>(null);
  if (!port.current)
    port.current = createPlaybackPort({
      controller: () => current.current.controller,
      href: () => current.current.href,
      load: async (media, origin) => {
        const key = selectionKey(media.href);
        if (media.detail) {
          const params = new URL(media.href, 'https://tongmu.invalid')
            .searchParams;
          if (
            !key ||
            params.get('source') !== media.detail.source ||
            params.get('id') !== media.detail.id
          )
            throw new Error('播放资料与所选影片不一致');
          setOverride({ key, detail: media.detail });
        } else setOverride(null);
        current.current.requestPlayback(
          media.href,
          origin === 'remote' ? 'remote' : 'user'
        );
      },
    });
  const stable = port.current;
  useEffect(() => {
    stable.attach(session.controller);
    return () => stable.attach(null);
  }, [session.controller, stable]);
  return (
    <MediaDetailContext.Provider
      value={
        override?.key === selectionKey(session.href) ? override.detail : null
      }
    >
      <PortContext.Provider value={stable}>{children}</PortContext.Provider>
    </MediaDetailContext.Provider>
  );
}
