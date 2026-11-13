'use client';

import { ChevronRight, Lock, RefreshCw, Users } from 'lucide-react';

import { roomCoverSource } from './room-cover';
import { displayRoomName } from './room-presentation';

import type { Room } from '@/types/watch-room';

export type RoomSummary = Pick<
  Room,
  | 'id'
  | 'name'
  | 'description'
  | 'isPublic'
  | 'hasPassword'
  | 'ownerAccountId'
  | 'memberCount'
  | 'lifecycle'
  | 'updatedAt'
  | 'nowPlaying'
  | 'coverUrl'
>;
export type RoomDirectoryTab = 'mine' | 'public' | 'archived';

/** 房间目录：我的 / 公开 / 已归档，卡片显示封面和正在放映的内容。 */
export default function RoomDirectory({
  username,
  directory,
  setDirectory,
  setError,
  rooms,
  loading,
  busy,
  refresh,
  join,
  restore,
  openCreate,
}: {
  username: string;
  directory: RoomDirectoryTab;
  setDirectory: (tab: RoomDirectoryTab) => void;
  setError: (message: string) => void;
  rooms: RoomSummary[];
  loading: boolean;
  busy: boolean;
  refresh: () => void;
  join: (id: string) => void;
  restore: (id: string) => void;
  openCreate: () => void;
}) {
  return (
    <>
      <div className='tm-room-directory-toolbar'>
        <div role='tablist' aria-label='房间目录'>
          {(username
            ? (['mine', 'public', 'archived'] as const)
            : (['public'] as const)
          ).map((tab) => (
            <button
              key={tab}
              role='tab'
              aria-selected={directory === tab}
              onClick={() => {
                setDirectory(tab);
                setError('');
              }}
            >
              {tab === 'mine'
                ? '我的房间'
                : tab === 'public'
                ? '公开房间'
                : '已归档'}
            </button>
          ))}
        </div>
        <button onClick={refresh} disabled={loading} aria-label='刷新房间'>
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {!rooms.length ? (
        <div className='tm-room-directory-empty'>
          <Users size={40} strokeWidth={1} />
          <h2>
            {loading
              ? '正在加载房间'
              : directory === 'mine'
              ? '还没有房间'
              : directory === 'archived'
              ? '暂时没有归档房间'
              : '还没有公开房间'}
          </h2>
          <p>
            {directory === 'archived'
              ? '归档后七天内可以恢复'
              : '创建一个房间，把邀请发给朋友'}
          </p>
          {directory !== 'archived' && (
            <button className='tm-room-primary' onClick={openCreate}>
              创建第一个房间
            </button>
          )}
        </div>
      ) : (
        <div className='tm-room-directory'>
          {rooms.map((item) => (
            <article key={item.id} className='tm-room-card'>
              <div
                className='tm-room-card-art'
                data-has-cover={Boolean(roomCoverSource(item))}
              >
                {roomCoverSource(item) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className='tm-room-card-cover'
                    src={roomCoverSource(item) || ''}
                    alt=''
                    loading='lazy'
                    referrerPolicy='no-referrer'
                  />
                ) : (
                  <span className='tm-room-card-glyph' aria-hidden='true'>
                    {Array.from(displayRoomName(item).trim())[0] || '房'}
                  </span>
                )}
                <span
                  className='tm-badge tm-room-card-presence'
                  data-on-art='true'
                >
                  <i className='tm-dot' data-live={item.memberCount > 0} />
                  {item.memberCount > 0
                    ? `${item.memberCount} 人在线`
                    : '无人在线'}
                </span>
                <span
                  className='tm-badge tm-room-card-access'
                  data-on-art='true'
                >
                  {item.hasPassword && <Lock size={12} aria-hidden />}
                  {item.isPublic ? '公开' : '私密'}
                  {item.hasPassword && ' · 需密码'}
                </span>
              </div>
              <div className='tm-room-card-body'>
                <h2>{displayRoomName(item)}</h2>
                <p>
                  {item.nowPlaying && item.lifecycle !== 'archived'
                    ? `${item.nowPlaying.isPlaying ? '正在放映' : '暂停在'}「${
                        item.nowPlaying.title
                      }」${
                        item.nowPlaying.episode > 1
                          ? ` 第${item.nowPlaying.episode}集`
                          : ''
                      }`
                    : item.description ||
                      (item.lifecycle === 'archived'
                        ? '已归档'
                        : `房主 ${item.ownerAccountId}`)}
                </p>
              </div>
              <button
                className='tm-room-card-action'
                aria-label={`${
                  item.lifecycle === 'archived' ? '恢复房间' : '进入房间'
                }：${displayRoomName(item)}`}
                disabled={busy}
                onClick={() =>
                  item.lifecycle === 'archived'
                    ? restore(item.id)
                    : join(item.id)
                }
              >
                <span className='sr-only'>
                  {item.lifecycle === 'archived' ? '恢复房间' : '进入房间'}
                </span>
              </button>
            </article>
          ))}
          {rooms.length <= 2 && directory !== 'archived' && (
            <button className='tm-room-directory-guide' onClick={openCreate}>
              <Users size={24} aria-hidden />
              <strong>
                邀请朋友一起看 <ChevronRight size={14} aria-hidden />
              </strong>
              <span>创建房间后，复制邀请发给朋友</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
