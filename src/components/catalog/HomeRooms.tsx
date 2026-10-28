'use client';

import { ChevronRight, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import SectionHeader from '@/components/catalog/SectionHeader';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  EXTERNAL_ROOM_SERVER_NOTICE,
  isExternalRoomServer,
} from '@/features/rooms/external-room-server';
import { displayRoomName } from '@/features/rooms/room-presentation';

import type { Room } from '@/types/watch-room';

type Summary = Pick<Room, 'id' | 'name' | 'memberCount'> &
  Partial<Pick<Room, 'ownerName' | 'ownerAccountId'>>;
export default function HomeRooms({ guest = false }: { guest?: boolean }) {
  const context = useWatchRoomContextSafe();
  const [rooms, setRooms] = useState<Summary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!guest && Boolean(context?.isEnabled));
  const externalServer = isExternalRoomServer(context?.config);
  useEffect(() => {
    if (guest || !context?.isEnabled) {
      setLoading(false);
      return;
    }
    if (externalServer) {
      // 外部观影室服务没有房间目录 REST，不请求必败的接口
      setRooms([]);
      setError(EXTERNAL_ROOM_SERVER_NOTICE);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/rooms?mode=mine', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('房间列表暂时无法刷新');
        const data: { rooms: Summary[] } = await response.json();
        if (!controller.signal.aborted) {
          setRooms(data.rooms || []);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) setError('房间列表暂时无法刷新');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [guest, context?.isEnabled, externalServer]);
  const current = context?.currentRoom;
  const visible = current
    ? [current, ...rooms.filter((room) => room.id !== current.id)]
    : rooms;
  const room = visible[0];
  if (guest) return null;
  if (!room && !loading && !error && context?.isEnabled) {
    return (
      <div className='tm-home-room-empty'>
        <Users size={16} aria-hidden='true' />
        <span>和朋友一起看</span>
        <Link href='/watch-room' className='tm-home-room-create-link tm-press'>
          <Plus size={16} aria-hidden='true' />
          创建房间
        </Link>
      </div>
    );
  }
  const playing =
    room?.id === current?.id && current?.currentState?.type === 'play'
      ? current.currentState.videoName
      : '';
  return (
    <section className='tm-home-rooms' aria-label='我的房间'>
      <SectionHeader title='我的房间' linkLabel='管理房间' href='/watch-room' />
      {room ? (
        <Link
          href={`/watch-room?room=${encodeURIComponent(room.id)}`}
          className='tm-home-room-summary tm-press'
        >
          <span className='tm-home-room-avatar' aria-hidden='true'>
            {Array.from(displayRoomName(room))[0] || '房'}
          </span>
          <div className='tm-home-room-details'>
            <strong>{displayRoomName(room)}</strong>
            <small>
              <i className='tm-dot' data-live={room.memberCount > 0} />
              {room.memberCount > 0 ? `${room.memberCount} 人在线` : '无人在线'}
            </small>
            {playing && (
              <span className='tm-home-room-playing'>正在播放 {playing}</span>
            )}
          </div>
          <span className='tm-home-room-enter' aria-hidden='true'>
            进入
            <ChevronRight size={14} />
          </span>
        </Link>
      ) : loading ? (
        <div
          className='tm-home-personal-skeleton'
          role='status'
          aria-label='正在加载房间'
        >
          <span className='tm-skeleton' aria-hidden='true' />
          <span className='tm-skeleton' aria-hidden='true' />
        </div>
      ) : null}
      {(error || !context?.isEnabled) && (
        <p className='tm-home-hint' role='status'>
          {error || '房间服务未启用'}
        </p>
      )}
    </section>
  );
}
