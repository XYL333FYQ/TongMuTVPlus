'use client';
import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePlaybackPort } from '@/features/playback/PlaybackPortProvider';
import {
  roomPlaybackSelection,
  type RoomMediaDescriptor,
  waitForSelectedPlayer,
} from './playback-selection';
import { TogetherApi } from './synctv/api';
import type {
  TogetherRoomSession,
  TogetherRoomSnapshot,
} from './synctv/session';
import type { synctv } from './synctv/protocol/client';

interface Identity {
  identityId: string;
  upstreamUserId: string;
  displayName: string;
}
interface ContextValue {
  enabled: boolean;
  identity: Identity | null;
  snapshot: TogetherRoomSnapshot | null;
  roomId: string | null;
  joining: boolean;
  error: string | null;
  open(roomId: string, join?: boolean): Promise<void>;
  follow(value: boolean): Promise<void>;
  leave(): Promise<void>;
  send(message: synctv.client.IClientMessage): void;
  observe(request: synctv.client.IObserveResource): (() => void) | undefined;
  api: TogetherApi;
}
const TogetherContext = createContext<ContextValue | null>(null);
export const useTogetherSession = () => useContext(TogetherContext);
const preferenceKey = (identityId: string) =>
  'tongmu:together:' + identityId + ':room';
function savedRoom(identityId: string) {
  try {
    const room = localStorage.getItem(preferenceKey(identityId));
    return room && /^room_[A-Za-z0-9]{1,59}$/.test(room) ? room : null;
  } catch {
    return null;
  }
}
function rememberRoom(identityId: string, roomId: string | null) {
  try {
    if (roomId) localStorage.setItem(preferenceKey(identityId), roomId);
    else localStorage.removeItem(preferenceKey(identityId));
  } catch {
    /* Storage restrictions do not prevent watching. */
  }
}

/** Installed once under the root PlaybackPort provider; never tied to the room page. */
export function TogetherSessionProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const pathname = usePathname();
  const port = usePlaybackPort();
  const api = useMemo(() => new TogetherApi(), []);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const [snapshot, setSnapshot] = useState<TogetherRoomSnapshot | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<TogetherRoomSession | null>(null);
  const revision = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const reportError = useCallback(() => setError('房间操作未完成，请重试'), []);
  const open = useCallback(
    async (target: string, join = true) => {
      if (!enabled || !port || !/^room_[A-Za-z0-9]{1,59}$/.test(target))
        throw new Error('房间暂不可用');
      if (
        sessionRef.current?.roomId === target &&
        snapshot?.status !== 'terminated'
      )
        return;
      const operation = ++revision.current;
      pending.current?.abort();
      const abort = new AbortController();
      pending.current = abort;
      setJoining(true);
      setError(null);
      try {
        const actor = await api.request<Identity>('/session', {
          signal: abort.signal,
        });
        if (join)
          await api.request('/rooms/' + target + '/membership', {
            method: 'PUT',
            body: {},
            signal: abort.signal,
          });
        if (abort.signal.aborted || operation !== revision.current) return;
        const { TogetherRoomSession } = await import('./synctv/session');
        if (abort.signal.aborted || operation !== revision.current) return;
        identityRef.current = actor;
        setIdentity(actor);
        sessionRef.current?.dispose();
        const session = new TogetherRoomSession(target, {
          api,
          port,
          origin: window.location.origin,
          duration: () => port.read().duration || 0,
          selectMedia: async (mediaId, signal) => {
            const descriptor = await api.request<RoomMediaDescriptor>(
              '/media/lookup?' +
                new URLSearchParams({ roomId: target, mediaId }),
              { signal }
            );
            if (signal.aborted)
              throw new DOMException('Selection cancelled', 'AbortError');
            const selection = roomPlaybackSelection(descriptor);
            await port.load(selection, 'remote');
            await waitForSelectedPlayer(port, selection.href, signal);
          },
          onChange: (value) => {
            if (sessionRef.current === session) setSnapshot(value);
          },
          onError: reportError,
        });
        sessionRef.current = session;
        setSnapshot(null);
        const personalPlayback = port.read();
        if (
          personalPlayback.ready &&
          personalPlayback.mediaHref &&
          !new URL(
            personalPlayback.mediaHref,
            window.location.origin
          ).searchParams.has('mediaRef')
        ) {
          await session.follow(false);
          if (abort.signal.aborted || operation !== revision.current) {
            session.dispose();
            return;
          }
        }
        setRoomId(target);
        rememberRoom(actor.identityId, target);
        session.start();
      } catch (failure) {
        if (!abort.signal.aborted && operation === revision.current) {
          reportError();
          throw failure;
        }
      } finally {
        if (operation === revision.current) setJoining(false);
      }
    },
    [api, enabled, port, reportError, snapshot?.status]
  );
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    void api
      .request<Identity>('/session', { signal: abort.signal })
      .then((actor) => {
        if (abort.signal.aborted) return;
        if (
          identityRef.current &&
          identityRef.current.identityId !== actor.identityId
        ) {
          revision.current++;
          pending.current?.abort();
          sessionRef.current?.dispose();
          sessionRef.current = null;
          setSnapshot(null);
          setRoomId(null);
        }
        identityRef.current = actor;
        setIdentity(actor);
        const stored = savedRoom(actor.identityId);
        if (stored && !sessionRef.current)
          void openRef.current(stored, false).catch(reportError);
      })
      .catch((failure) => {
        if (abort.signal.aborted) return;
        if ([401, 403].includes(failure?.status)) {
          revision.current++;
          pending.current?.abort();
          sessionRef.current?.dispose();
          sessionRef.current = null;
          identityRef.current = null;
          setIdentity(null);
          setSnapshot(null);
          setRoomId(null);
          setJoining(false);
        }
      });
    return () => abort.abort();
  }, [api, enabled, pathname, reportError]);
  useEffect(
    () => () => {
      revision.current++;
      pending.current?.abort();
      sessionRef.current?.dispose();
      sessionRef.current = null;
    },
    []
  );
  const personal = useCallback(async () => {
    if (!port) return;
    const state = port.read();
    if (!state.mediaHref) return;
    const url = new URL(state.mediaHref, window.location.origin);
    if (!url.searchParams.has('mediaRef')) return;
    url.searchParams.delete('mediaRef');
    const href = url.pathname + url.search;
    const abort = new AbortController();
    pending.current?.abort();
    pending.current = abort;
    await port.load({ href }, 'local');
    await waitForSelectedPlayer(port, href, abort.signal);
    port.setRate(state.playbackRate);
    port.seek(state.currentTime);
    if (state.playing) await port.play();
    else port.pause();
  }, [port]);
  const follow = useCallback(
    async (value: boolean) => {
      const session = sessionRef.current;
      if (!session) return;
      await session.follow(value);
      if (!value) await personal();
    },
    [personal]
  );
  const leave = useCallback(async () => {
    revision.current++;
    pending.current?.abort();
    const session = sessionRef.current;
    if (!session) return;
    await session.follow(false);
    await personal();
    await session.leave();
    if (sessionRef.current !== session) return;
    sessionRef.current = null;
    setSnapshot(null);
    setRoomId(null);
    setJoining(false);
    if (identityRef.current) rememberRoom(identityRef.current.identityId, null);
  }, [personal]);
  const value = useMemo<ContextValue>(
    () => ({
      enabled,
      identity,
      snapshot,
      roomId,
      joining,
      error,
      api,
      open,
      follow,
      leave,
      send: (message) => {
        if (!sessionRef.current) throw new Error('请先进入房间');
        sessionRef.current.send(message);
      },
      observe: (request) => sessionRef.current?.observe(request),
    }),
    [
      enabled,
      identity,
      snapshot,
      roomId,
      joining,
      error,
      api,
      open,
      follow,
      leave,
    ]
  );
  return (
    <TogetherContext.Provider value={value}>
      {children}
    </TogetherContext.Provider>
  );
}
