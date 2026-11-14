'use client';

/*
 * 一起看大厅：我的房间 / 公开房间的卡片网格，顶部“创建房间”“输入房间号加入”。
 */

import { Film, Lock, Plus, RefreshCw, Users } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { roomCoverSource } from '../lib/room-cover';
import { displayRoomName } from '../lib/room-presentation';

import type { Room } from '@/types/watch-room';

type Directory = 'mine' | 'public';

export function RoomCard({ room, onOpen }: { room: Room; onOpen(): void }) {
  const cover = roomCoverSource(room);
  const playing = room.nowPlaying;
  return (
    <button type='button' className='tm-t-card' onClick={onOpen}>
      <span className='tm-t-card-art'>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt='' loading='lazy' referrerPolicy='no-referrer' />
        ) : (
          <span className='tm-t-card-glyph' aria-hidden='true'>
            {displayRoomName(room).slice(0, 1)}
          </span>
        )}
        {playing && (
          <span className='tm-t-card-now'>
            <span
              className='tm-t-dot'
              data-on={playing.isPlaying ? 'true' : undefined}
            />
            {playing.isPlaying ? '正在放映' : '已暂停'}
          </span>
        )}
      </span>
      <span className='tm-t-card-body'>
        <span className='tm-t-card-title'>
          {displayRoomName(room)}
          {room.hasPassword && <Lock size={14} aria-label='需要密码' />}
        </span>
        <span className='tm-t-card-meta'>
          <span className='tm-t-card-film'>
            {playing
              ? `${playing.title}${
                  playing.episode > 1 ? ` · 第 ${playing.episode} 集` : ''
                }`
              : '还没开始放映'}
          </span>
          <span className='tm-t-card-count'>
            <Users size={14} aria-hidden='true' />
            {room.memberCount}
          </span>
        </span>
      </span>
    </button>
  );
}

export default function Lobby(props: {
  loggedIn: boolean;
  connected: boolean;
  error: string;
  busy: boolean;
  onCreate(): void;
  onJoin(id: string): void;
}) {
  const [directory, setDirectory] = useState<Directory>(
    props.loggedIn ? 'mine' : 'public'
  );
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [code, setCode] = useState('');
  const request = useRef(0);

  useEffect(
    () => setDirectory(props.loggedIn ? 'mine' : 'public'),
    [props.loggedIn]
  );

  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms?mode=${directory}`, {
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? '登录后查看自己的房间'
            : '房间服务暂时不可用'
        );
      const data = (await response.json()) as { rooms?: Room[] };
      if (id !== request.current) return;
      setRooms(data.rooms || []);
      setFailure('');
    } catch (reason) {
      if (id !== request.current) return;
      setFailure(
        reason instanceof TypeError
          ? '网络不太好，恢复后会自动刷新'
          : reason instanceof Error
          ? reason.message
          : '读取房间失败'
      );
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [directory]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      window.clearInterval(timer);
      request.current++;
    };
  }, [refresh]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = code.trim();
    if (id) props.onJoin(id);
  };

  return (
    <div className='tm-page-container tm-t-lobby'>
      <header className='tm-t-lobby-head'>
        <div>
          <h1 className='tm-t-h1'>一起看</h1>
          <p className='tm-t-lead'>
            和朋友在各自的设备上同步看同一部片，边看边聊。
          </p>
        </div>
        <div className='tm-t-lobby-actions'>
          <form className='tm-t-join' onSubmit={submit}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder='输入房间号'
              aria-label='房间号'
              inputMode='text'
              autoComplete='off'
            />
            <button
              type='submit'
              className='tm-t-btn'
              disabled={!code.trim() || props.busy}
            >
              加入
            </button>
          </form>
          <button
            type='button'
            className='tm-t-btn tm-t-btn-primary'
            onClick={props.onCreate}
            disabled={props.busy}
          >
            <Plus size={18} />
            创建房间
          </button>
        </div>
      </header>

      {props.error && (
        <p className='tm-t-error' role='alert'>
          {props.error}
        </p>
      )}
      {!props.connected && <p className='tm-t-hint'>正在连接房间服务…</p>}

      <div className='tm-t-segment' role='tablist' aria-label='房间范围'>
        {props.loggedIn && (
          <button
            type='button'
            role='tab'
            aria-selected={directory === 'mine'}
            onClick={() => setDirectory('mine')}
          >
            我的房间
          </button>
        )}
        <button
          type='button'
          role='tab'
          aria-selected={directory === 'public'}
          onClick={() => setDirectory('public')}
        >
          公开房间
        </button>
        <button
          type='button'
          className='tm-t-icon'
          onClick={() => void refresh()}
          aria-label='刷新'
        >
          <RefreshCw size={16} className={loading ? 'tm-t-spin' : undefined} />
        </button>
      </div>

      {failure ? (
        <p className='tm-t-empty'>{failure}</p>
      ) : !loading && !rooms.length ? (
        <div className='tm-t-empty-card'>
          <Film size={28} aria-hidden='true' />
          <strong>
            {directory === 'mine' ? '你还没有房间' : '现在没有公开房间'}
          </strong>
          <span>创建一个房间，把房间号发给朋友就能一起看。</span>
          <button
            type='button'
            className='tm-t-btn tm-t-btn-primary'
            onClick={props.onCreate}
          >
            <Plus size={18} />
            创建房间
          </button>
        </div>
      ) : (
        <div className='tm-t-grid'>
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onOpen={() => props.onJoin(room.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
