'use client';

import { Film, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import type { Room } from '@/types/watch-room';

type Summary = Pick<Room, 'id' | 'name' | 'memberCount' | 'lifecycle'>;
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
      <div className='tm-home-section-heading'>
        <h2>我的房间</h2>
        <Link href='/watch-room' className='tm-press'>
          查看全部
        </Link>
      </div>
      <div className='tm-home-compact-grid'>
        {visible.slice(0, 2).map((room) => (
          <Link
            key={room.id}
            href='/watch-room'
            className='tm-home-room-card tm-press'
          >
            <div className='tm-home-room-art'>
              <Film size={28} aria-hidden='true' />
              <span
                className='tm-home-room-status'
                data-online={room.memberCount > 0}
              >
                <i />
                {room.memberCount > 0
                  ? `${room.memberCount} 人在线`
                  : '无人在线'}
              </span>
            </div>
            <strong>{room.name}</strong>
            <small>
              {room.id === current?.id && current.currentState?.type === 'play'
                ? `正在播放 ${current.currentState.videoName}`
                : room.lifecycle === 'sleeping'
                ? '休眠中'
                : '进入房间'}
            </small>
          </Link>
        ))}
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
          {guest ? '登录后查看自己的房间' : error || '房间服务未启用'}
        </p>
      )}
    </section>
  );
}
