'use client';

import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import SectionHeader from '@/components/catalog/SectionHeader';

import type { Room } from '@/types/watch-room';

type Summary = Pick<Room, 'id' | 'name' | 'memberCount'>;
export default function HomeRooms({ guest = false }: { guest?: boolean }) {
  const context = useWatchRoomContextSafe();
  const [rooms, setRooms] = useState<Summary[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (guest || !context?.isEnabled) return;
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
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [guest, context?.isEnabled]);
  const current = context?.currentRoom;
  const visible = current
    ? [current, ...rooms.filter((room) => room.id !== current.id)]
    : rooms;
  return (
    <section className='tm-home-rooms' aria-label='我的房间'>
      <SectionHeader title='我的房间' href='/watch-room' />
      <div className='tm-home-compact-grid'>
        {visible.slice(0, 2).map((room) => {
          const online = room.memberCount > 0;
          const state = room.id === current?.id ? current.currentState : null;
          const playing = state?.type === 'play' ? state.videoName : '';
          return (
            <Link
              key={room.id}
              href='/watch-room'
              className='tm-home-room-card tm-press'
            >
              <div className='tm-home-room-art'>
                <Users size={28} strokeWidth={1.5} aria-hidden='true' />
                <span
                  className='tm-home-room-status tm-badge'
                  data-on-art='true'
                  data-online={online}
                >
                  <i className='tm-dot' data-live={online} />
                  {online ? `${room.memberCount} 人在线` : '无人在线'}
                </span>
              </div>
              <strong>{room.name}</strong>
              <small>{playing ? `正在播放 ${playing}` : '进入房间'}</small>
            </Link>
          );
        })}
        <Link
          href='/watch-room'
          className='tm-home-room-card tm-home-room-create tm-press'
        >
          <div className='tm-home-room-art'>
            <Plus size={24} />
          </div>
          <strong>创建房间</strong>
        </Link>
      </div>
      {(guest || error || !context?.isEnabled) && (
        <p className='tm-home-hint'>
          {guest ? '登录后创建和加入房间' : error || '房间服务未启用'}
        </p>
      )}
    </section>
  );
}
