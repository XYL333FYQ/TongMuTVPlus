'use client';

/*
 * 房间页的几块画面：顶部房间栏、画面和正在放映、侧栏（聊天 / 片单 / 成员 / 活动）、各种面板和对话框。状态都在 useRoomViewModel。
 */

import { MessageSquare } from 'lucide-react';

import MembersPanel from './MembersPanel';
import { ActivityPanel } from './RoomActivities';
import RoomChat from './RoomChat';
import {
  type RoomViewModel,
  type SideTab,
  SIDE_TABS,
} from './useRoomViewModel';

/** 侧栏：聊天一直挂着，平板上还有片单 / 成员 / 活动标签 */
export function RoomSide({ vm }: { vm: RoomViewModel }) {
  const {
    current,
    room,
    self,
    can,
    isOwner,
    tablet,
    tab,
    setTab,
    command,
    online,
    waiting,
    requests,
    playlist,
  } = vm;
  return (
    <aside
      className='tm-room-view-chat'
      aria-label={tablet ? '房间侧栏' : '聊天'}
      data-tab={tablet ? tab : undefined}
    >
      {tablet ? (
        <SideTabs
          tab={tab}
          onTab={setTab}
          counts={{ playlist: waiting, members: online }}
          alert={{ members: requests > 0 }}
        />
      ) : (
        <div className='tm-room-view-chat-head'>
          <MessageSquare size={16} aria-hidden='true' />
          <h2>聊天</h2>
          <span className='tm-room-view-chat-count'>
            {room.chatMessages.length}
          </span>
        </div>
      )}
      {/* 聊天一直挂着（切到别的标签只是藏起来），输入到一半、滚动位置都不丢 */}
      <RoomChat />
      {tablet && tab === 'playlist' && (
        <div
          className='tm-room-view-tabpanel'
          role='tabpanel'
          id='tm-room-view-tab-playlist'
        >
          {playlist}
        </div>
      )}
      {tablet && tab === 'members' && (
        <div
          className='tm-room-view-tabpanel'
          role='tabpanel'
          id='tm-room-view-tab-members'
        >
          <MembersPanel
            room={current}
            self={self}
            canManage={can('manageMembers')}
            isOwner={isOwner}
            command={command}
          />
        </div>
      )}
      {tablet && tab === 'activities' && (
        <div
          className='tm-room-view-tabpanel'
          role='tabpanel'
          id='tm-room-view-tab-activities'
        >
          <ActivityPanel room={current} canStart={can('changeMedia')} />
        </div>
      )}
    </aside>
  );
}

const TAB_LABELS: Record<SideTab, string> = {
  chat: '聊天',
  playlist: '片单',
  members: '成员',
  activities: '活动',
};

/** 平板侧栏的四个标签（2026-11-18 平板设计稿方案 A）；左右方向键切换 */
function SideTabs({
  tab,
  onTab,
  counts,
  alert,
}: {
  tab: SideTab;
  onTab(tab: SideTab): void;
  counts: Partial<Record<SideTab, number>>;
  alert: Partial<Record<SideTab, boolean>>;
}) {
  return (
    <div
      className='tm-room-view-tabs'
      role='tablist'
      aria-label='侧栏内容'
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next =
          SIDE_TABS[
            (SIDE_TABS.indexOf(tab) + step + SIDE_TABS.length) %
              SIDE_TABS.length
          ];
        onTab(next);
        event.currentTarget
          .querySelector<HTMLButtonElement>(`[data-tab='${next}']`)
          ?.focus();
      }}
    >
      {SIDE_TABS.map((name) => (
        <button
          key={name}
          type='button'
          role='tab'
          data-tab={name}
          aria-selected={tab === name}
          tabIndex={tab === name ? 0 : -1}
          onClick={() => onTab(name)}
        >
          {TAB_LABELS[name]}
          {!!counts[name] && (
            <span
              className='tm-room-view-tab-count'
              data-alert={alert[name] || undefined}
            >
              {counts[name]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
