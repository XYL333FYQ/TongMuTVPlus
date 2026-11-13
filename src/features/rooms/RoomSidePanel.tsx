'use client';

import { motion } from 'framer-motion';
import { Film, Play, Plus, Shield } from 'lucide-react';

import { useReducedMotionSetting } from '@/lib/motion';

import { queuePlaybackHref } from '@/features/playback/session';
import { useRoomPlayback } from '@/features/room/RoomPlaybackBridge';

import RoomActionMenu from './RoomActionMenu';

import type { Member, Room } from '@/types/watch-room';

export type RoomPanelTab = 'queue' | 'chat' | 'members';

/** 房间侧栏：片单 / 聊天 / 成员三个标签。聊天内容由全站聊天窗口挂进来。 */
export default function RoomSidePanel({
  room,
  members,
  selfId,
  username,
  canControl,
  isOwner,
  isRoomAdmin,
  busy,
  panelTab,
  onTabChange,
  mutate,
  openPicker,
}: {
  room: Room;
  members: Member[];
  selfId?: string;
  username: string;
  canControl: boolean;
  isOwner: boolean;
  isRoomAdmin: boolean;
  busy: boolean;
  panelTab: RoomPanelTab;
  onTabChange: (tab: RoomPanelTab) => void;
  mutate: (event: string, payload: Record<string, unknown>) => unknown;
  openPicker: () => void;
}) {
  const roomPlayback = useRoomPlayback();
  const reducedMotion = useReducedMotionSetting();
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
                : `成员 ${room.memberCount}`}
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
        {!room.queue?.length && (
          <div className='tm-room-queue-empty'>
            <p>片单为空</p>
            <span>
              {canControl
                ? '选好的影片会排在这里，点播放就一起开始'
                : '选好的影片会排在这里，等房主开始播放'}
            </span>
          </div>
        )}
        <ol>
          {room.queue?.map((item, index) => (
            <motion.li
              key={item.id}
              layout={reducedMotion ? false : 'position'}
              transition={{ duration: reducedMotion ? 0 : 0.32 }}
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
                  {item.playedAt ? '已播放 · ' : ''}
                  {item.addedBy} 添加 · 第{item.episode || 1}集
                </p>
              </div>
              <div className='tm-room-queue-actions'>
                {canControl && (
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
                    ...(isRoomAdmin
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
                    isRoomAdmin
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
        {Boolean(room.queue?.length) && (
          <button className='tm-room-add-film' onClick={() => openPicker()}>
            <Plus size={16} />
            添加影片
          </button>
        )}
      </section>
      <section
        className='tm-room-members'
        id='tm-room-panel-members'
        role='tabpanel'
        aria-labelledby='tm-room-tab-members'
        tabIndex={0}
        data-active={panelTab === 'members'}
        data-expanded={panelTab === 'members'}
        aria-label='成员'
      >
        <header>
          <h2>成员</h2>
          <span>{room.memberCount}人</span>
        </header>
        {members.map((member) => (
          <div key={member.id} className='tm-room-member'>
            <span className='tm-room-avatar'>
              {member.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h3>
                {member.name}
                {member.id === selfId && '（你）'}
              </h3>
              <p>
                {[
                  member.isOwner ? '房主' : member.canHost ? '管理员' : '成员',
                  member.following === false
                    ? '个人观看中'
                    : member.canControl
                    ? '可控制播放'
                    : '一起观看',
                ].join(' · ')}
              </p>
            </div>
            {(member.isOwner || member.canHost) && (
              <Shield size={15} aria-label='房主或管理员' />
            )}
            {isOwner && !member.isOwner && member.accountId && (
              <button
                disabled={busy}
                onClick={() =>
                  mutate('room:authorize-host', {
                    accountId: member.accountId,
                    canHost: !member.canHost,
                  })
                }
              >
                {member.canHost ? '取消管理员' : '设为管理员'}
              </button>
            )}
          </div>
        ))}
      </section>
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
