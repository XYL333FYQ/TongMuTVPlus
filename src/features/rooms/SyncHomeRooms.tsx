'use client';
import { ChevronRight, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import SectionHeader from '@/components/catalog/SectionHeader';
import { usePlaybackSessionSafe } from '@/features/playback/context';
import { useTogetherSession } from './TogetherSessionProvider';

type Summary = { id: string; name: string; memberCount?: number };
export default function SyncHomeRooms({ guest = false }: { guest?: boolean }) {
  const together = useTogetherSession();
  const playback = usePlaybackSessionSafe();
  const identityId = together?.identity?.identityId;
  const actor = useRef(identityId);
  actor.current = identityId;
  const api = together?.api;
  const [state, setState] = useState<{
    identityId?: string;
    rooms: Summary[];
    error?: string;
  }>({ rooms: [] });
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!api || !identityId || guest) return;
      const data = await api.request<{ rooms: { room: Summary }[] }>(
        '/rooms?page=1&pageSize=6',
        { signal }
      );
      if (signal.aborted || actor.current !== identityId) return;
      setState({
        identityId,
        rooms: (data.rooms || []).map((item) => item.room).filter(Boolean),
      });
    },
    [api, identityId, guest]
  );
  usePageRefresh('/', load, !guest && !!identityId);
  useEffect(() => {
    if (!identityId || guest) return;
    const abort = new AbortController();
    const refresh = () => {
      void load(abort.signal).catch(() => {
        if (!abort.signal.aborted && actor.current === identityId)
          setState((previous) => ({
            rooms: previous.identityId === identityId ? previous.rooms : [],
            identityId,
            error: '房间列表暂时无法刷新',
          }));
      });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, [load, identityId, guest]);
  if (guest) return null;
  const rooms = state.identityId === identityId ? state.rooms : [];
  const room = rooms.find((item) => item.id === together?.roomId) || rooms[0];
  if (!identityId || (!room && state.identityId === identityId && !state.error))
    return (
      <div className='tm-home-room-empty'>
        <Users size={16} aria-hidden />
        <span>和朋友一起看</span>
        <Link href='/watch-room' className='tm-home-room-create-link tm-press'>
          <Plus size={16} aria-hidden />
          创建房间
        </Link>
      </div>
    );
  const online =
    together?.roomId === room?.id
      ? together?.snapshot?.resources.online_count?.onlineCount
          ?.onlineMemberCount
      : undefined;
  return (
    <section className='tm-home-rooms' aria-label='我的房间'>
      <SectionHeader title='我的房间' linkLabel='管理房间' href='/watch-room' />
      {room ? (
        <Link
          href={'/watch-room?room=' + encodeURIComponent(room.id)}
          className='tm-home-room-summary tm-press'
        >
          <span className='tm-home-room-avatar' aria-hidden>
            {Array.from(room.name || '房间')[0]}
          </span>
          <div className='tm-home-room-details'>
            <strong>{room.name}</strong>
            <small>
              {online === undefined
                ? `${room.memberCount || 0} 位成员`
                : `${online} 人在线`}
            </small>
            {together?.roomId === room.id && together.snapshot?.following && playback?.metadata.title && (
              <span className='tm-home-room-playing'>
                正在观看 {playback.metadata.title}
              </span>
            )}
          </div>
          <span className='tm-home-room-enter' aria-hidden>
            进入
            <ChevronRight size={14} />
          </span>
        </Link>
      ) : state.error ? (
        <p className='tm-home-hint' role='status'>
          {state.error}
        </p>
      ) : (
        <div
          className='tm-home-personal-skeleton'
          role='status'
          aria-label='正在加载房间'
        >
          <span className='tm-skeleton' aria-hidden />
          <span className='tm-skeleton' aria-hidden />
        </div>
      )}
      {room && state.error && <p className='tm-home-hint' role='status'>{state.error}</p>}
    </section>
  );
}
