'use client';

/*
 * 房间页的几块画面：顶部房间栏、画面和正在放映、侧栏（聊天 / 片单 / 成员 / 活动）、各种面板和对话框。状态都在 useRoomViewModel。
 */

import {
  ArrowLeft,
  Check,
  Ellipsis,
  Hash,
  Link2,
  Lock,
  LogOut,
  MessageSquareText,
  Settings,
} from 'lucide-react';

import type { RoomViewModel } from './useRoomViewModel';
import { displayRoomName, maskedRoomId } from '../lib/room-presentation';

/** 顶部房间栏：返回、房间名、在线人数、麦克风、更多 */
export function RoomHeader({ vm }: { vm: RoomViewModel }) {
  const {
    current,
    onLeave,
    onBack,
    room,
    self,
    can,
    compact,
    setPanel,
    openPanel,
    setSettings,
    setInvite,
    copied,
    voice,
    onlineMembers,
    online,
    copy,
    micButton,
    speakerButton,
  } = vm;
  return (
    <header className='tm-room-head tm-room-view-head'>
      <button
        type='button'
        className='tm-room-icon tm-room-head-back'
        onClick={onBack}
        aria-label='回到房间列表'
        title='回到房间列表'
      >
        <ArrowLeft size={20} />
      </button>
      <div className='tm-room-head-title'>
        <h1>{displayRoomName(current)}</h1>
        <div className='tm-room-head-meta'>
          <span className='tm-room-chip'>
            <span
              className='tm-room-dot'
              data-on={room.isConnected ? 'true' : undefined}
            />
            {room.isConnected
              ? online > 1
                ? `${online} 人在线`
                : '只有你在'
              : '正在重新连接…'}
          </span>
          <button
            type='button'
            className='tm-room-chip tm-room-view-chip-button'
            onClick={() => void copy(current.id, 'code')}
            title='复制房间号'
          >
            {copied === 'code' ? <Check size={13} /> : <Hash size={13} />}
            {copied === 'code' ? '已复制' : maskedRoomId(current.id)}
          </button>
          {current.hasPassword && (
            <span className='tm-room-chip'>
              <Lock size={13} />
              密码房
            </span>
          )}
        </div>
      </div>

      <div className='tm-room-head-actions'>
        {onlineMembers.length > 0 && (
          <button
            type='button'
            className='tm-room-view-faces'
            onClick={() => openPanel('members')}
            aria-label={`在线成员：${onlineMembers
              .map((member) => member.accountId)
              .join('、')}`}
          >
            {onlineMembers.slice(0, compact ? 3 : 4).map((member) => (
              <span
                key={member.accountId}
                className='tm-room-view-face'
                data-self={member.accountId === self ? 'true' : undefined}
                title={member.accountId}
              >
                {member.accountId.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {onlineMembers.length > (compact ? 3 : 4) && (
              <span className='tm-room-view-face tm-room-view-face-more'>
                +{onlineMembers.length - (compact ? 3 : 4)}
              </span>
            )}
          </button>
        )}
        {compact ? (
          <>
            {micButton}
            <button
              type='button'
              className='tm-room-icon'
              onClick={() => setPanel('menu')}
              aria-label='更多'
              title='更多'
            >
              <Ellipsis size={20} />
            </button>
          </>
        ) : (
          <>
            {voice.available && (
              <div
                className='tm-room-view-voice'
                role='group'
                aria-label='语音'
              >
                {micButton}
                {speakerButton}
              </div>
            )}
            <button
              type='button'
              className='tm-room-icon'
              onClick={() => setPanel('danmaku')}
              aria-label='弹幕'
              title='弹幕：弹幕源和房间弹幕'
            >
              <MessageSquareText size={20} />
            </button>
            <button
              type='button'
              className='tm-room-btn tm-room-btn-primary'
              onClick={() => setInvite(true)}
            >
              <Link2 size={16} />
              <span>邀请</span>
            </button>
            {can('editRoom') && (
              <button
                type='button'
                className='tm-room-icon'
                onClick={() => setSettings(true)}
                aria-label='房间设置'
                title='房间设置'
              >
                <Settings size={20} />
              </button>
            )}
            <button
              type='button'
              className='tm-room-icon'
              onClick={onLeave}
              aria-label='退出房间'
              title='退出房间'
            >
              <LogOut size={20} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
