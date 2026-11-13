'use client';

import { motion } from 'framer-motion';
import { Film, Play, Plus, SkipBack, SkipForward, Square } from 'lucide-react';

import { useReducedMotionSetting } from '@/lib/motion';

import { queuePlaybackHref } from '@/features/playback/session';
import { useRoomPlayback } from '@/features/room/RoomPlaybackBridge';

import RoomActionMenu from './RoomActionMenu';
import RoomMembers from './RoomMembers';

import type { Room } from '@/types/watch-room';

export type RoomPanelTab = 'queue' | 'chat' | 'members';

/**
 * 房间侧栏：片单 / 聊天 / 成员三个标签（参照 SyncTV）。
 * 能做什么由服务器下发的权限决定；聊天内容由全站聊天窗口挂进来。
 */
export default function RoomSidePanel({
  room,
  username,
  busy,
  panelTab,
  onTabChange,
  mutate,
  openPicker,
}: {
  room: Room;
  username: string;
  busy: boolean;
  panelTab: RoomPanelTab;
  onTabChange: (tab: RoomPanelTab) => void;
  mutate: (event: string, payload: Record<string, unknown>) => unknown;
  openPicker: () => void;
}) {
  const roomPlayback = useRoomPlayback();
  const reducedMotion = useReducedMotionSetting();
  const permissions = room.myPermissions || [];
  const canChangeMedia = permissions.includes('changeMedia');
  const canManagePlaylist = permissions.includes('managePlaylist');
  const canAdd = permissions.includes('addMedia');
  const queue = room.queue || [];
  const state = room.currentState;
  const currentIndex =
    state?.type === 'play' && state.queueItemId
      ? queue.findIndex((item) => item.id === state.queueItemId)
      : -1;
  const playItem = (index: number) => {
    const item = queue[index];
    if (item)
      roomPlayback.playTogether(
        queuePlaybackHref(item.href, item.episode || 1, item.id)
      );
  };
  // 下一个：当前项之后的第一项；没在放片单里的影片时，从第一部没看过的开始
  const nextIndex =
    currentIndex >= 0
      ? currentIndex + 1 < queue.length
        ? currentIndex + 1
        : -1
      : queue.findIndex((item) => !item.playedAt);
  const previousIndex = currentIndex > 0 ? currentIndex - 1 : -1;
  const played = queue.filter((item) => item.playedAt).length;
  return (
    <aside className='tm-room-side'>
      <div className='tm-room-panel-tabs' role='tablist' aria-label='房间面板'>
        {(['queue', 'chat', 'members'] as const).map((tab) => (
          <button
            key={tab}
            id={`tm-room-tab-${tab}`}
            role='tab'
            aria-selected={panelTab === tab}
            aria-controls={`tm-room-panel-${tab}`}
            tabIndex={panelTab === tab ? 0 : -1}
            onClick={() => onTabChange(tab)}
            onKeyDown={(event) => {
              if (
                !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                  event.key
                ) ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return;
              event.preventDefault();
              const tabs = Array.from(
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]'
                ) || []
              );
              const index = tabs.indexOf(event.currentTarget);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                  ? tabs.length - 1
                  : (index +
                      (event.key === 'ArrowLeft' ? -1 : 1) +
                      tabs.length) %
                    tabs.length;
              tabs[next]?.click();
              tabs[next]?.focus();
            }}
          >
            {panelTab === tab && (
              <motion.span
                className='tm-room-tab-active'
                layoutId='tm-room-panel-active'
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
              />
            )}
            <span>
              {tab === 'queue'
                ? `片单 ${room.queue?.length || 0}`
                : tab === 'chat'
                ? '聊天'
                : `成员 ${room.roster?.length || room.memberCount}`}
              {tab === 'chat' &&
                Boolean(room.unreadCount) &&
                panelTab !== 'chat' && (
                  <b className='tm-room-tab-badge' aria-hidden='true'>
                    {room.unreadCount}
                  </b>
                )}
            </span>
          </button>
        ))}
      </div>
      <section
        className='tm-room-queue'
        id='tm-room-panel-queue'
        role='tabpanel'
        aria-labelledby='tm-room-tab-queue'
        tabIndex={0}
        data-active={panelTab === 'queue'}
        aria-label='片单'
      >
        {(canChangeMedia || canManagePlaylist) &&
          (queue.length > 0 || state) && (
            <div className='tm-room-queue-controls' aria-label='放映控制'>
              {canChangeMedia && (
                <>
                  <button
                    type='button'
                    disabled={previousIndex < 0}
                    onClick={() => playItem(previousIndex)}
                    aria-label='上一部'
                    title='上一部'
                  >
                    <SkipBack size={15} />
                  </button>
                  <button
                    type='button'
                    disabled={nextIndex < 0}
                    onClick={() => playItem(nextIndex)}
                    aria-label='下一部'
                    title='下一部'
                  >
                    <SkipForward size={15} />
                  </button>
                  {state && (
                    <button
                      type='button'
                      disabled={busy}
                      onClick={() => void mutate('state:clear', {})}
                      aria-label='停止放映'
                      title='停止放映'
                    >
                      <Square size={14} />
                    </button>
                  )}
                </>
              )}
              {canManagePlaylist && queue.length > 0 && (
                <RoomActionMenu
                  label='片单整理'
                  items={[
                    {
                      label: `清除已播放（${played}）`,
                      disabled: busy || played === 0,
                      onSelect: () => void mutate('queue:clear-played', {}),
                    },
                    {
                      label: '清空片单',
                      danger: true,
                      disabled: busy,
                      onSelect: () => void mutate('queue:clear', {}),
                    },
                  ]}
                />
              )}
            </div>
          )}
        {!queue.length && (
          <div className='tm-room-queue-empty'>
            <p>片单为空</p>
            <span>
              {canChangeMedia
                ? '选好的影片会排在这里，点播放就一起开始'
                : '选好的影片会排在这里，等有权限的人开始播放'}
            </span>
          </div>
        )}
        <ol>
          {room.queue?.map((item, index) => (
            <motion.li
              key={item.id}
              layout={reducedMotion ? false : 'position'}
              transition={{ duration: reducedMotion ? 0 : 0.32 }}
              data-current={index === currentIndex}
              aria-current={index === currentIndex ? 'true' : undefined}
            >
              <span className='tm-room-queue-number'>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className='tm-room-queue-thumbnail' aria-hidden='true'>
                <Film size={18} />
              </span>
              <div className='tm-room-queue-copy'>
                <h3>{item.title}</h3>
                <p>
                  {index === currentIndex
                    ? '正在放映 · '
                    : item.playedAt
                    ? '已播放 · '
                    : ''}
                  {item.addedBy} 添加 · 第{item.episode || 1}集
                </p>
              </div>
              <div className='tm-room-queue-actions'>
                {canChangeMedia && index !== currentIndex && (
                  <button
                    onClick={() =>
                      roomPlayback.playTogether(
                        queuePlaybackHref(item.href, item.episode || 1, item.id)
                      )
                    }
                    aria-label={`播放${item.title}`}
                  >
                    <Play size={15} />
                  </button>
                )}
                <RoomActionMenu
                  label={`${item.title}的片单操作`}
                  items={[
                    ...(canManagePlaylist
                      ? [
                          {
                            label: '上移',
                            disabled: busy || index === 0,
                            onSelect: () =>
                              void mutate('queue:move', {
                                id: item.id,
                                position: index - 1,
                              }),
                          },
                          {
                            label: '下移',
                            disabled:
                              busy || index === (room.queue?.length || 0) - 1,
                            onSelect: () =>
                              void mutate('queue:move', {
                                id: item.id,
                                position: index + 1,
                              }),
                          },
                        ]
                      : []),
                    ...((item.addedBy === username && !item.playedAt) ||
                    canManagePlaylist
                      ? [
                          {
                            label: '移除',
                            disabled: busy,
                            onSelect: () =>
                              void mutate('queue:remove', {
                                id: item.id,
                              }),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </motion.li>
          ))}
        </ol>
        {queue.length > 0 && canAdd && (
          <button className='tm-room-add-film' onClick={() => openPicker()}>
            <Plus size={16} />
            添加影片
          </button>
        )}
      </section>
      <RoomMembers
        room={room}
        selfAccountId={username}
        busy={busy}
        active={panelTab === 'members'}
        mutate={mutate}
      />
      <div
        id='tm-room-panel-chat'
        className='tm-room-chat-slot'
        role={panelTab === 'chat' ? 'tabpanel' : 'region'}
        aria-labelledby={panelTab === 'chat' ? 'tm-room-tab-chat' : undefined}
        aria-label={panelTab === 'chat' ? undefined : '发送消息'}
        tabIndex={panelTab === 'chat' ? 0 : undefined}
        data-tm-room-chat-slot
        data-active={panelTab === 'chat'}
      />
    </aside>
  );
}
