'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Copy,
  Link2,
  Monitor,
  Plus,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

import { useReducedMotionSetting } from '@/lib/motion';

import { maskedRoomId } from './room-presentation';
import RoomActionMenu from './RoomActionMenu';

import type { Member, Room } from '@/types/watch-room';

/** 房间页顶部：名称、连接与权限状态、房间号、成员、邀请、房间操作。 */
export default function RoomHeader({
  room,
  roomTitle,
  members,
  connected,
  canControl,
  isOwner,
  hostLabel,
  panelTab,
  copiedRoomId,
  copiedInviteRoomId,
  copyRoomId,
  copyInvite,
  openSettings,
  openCreate,
  openJoin,
  onToggleMembers,
  onLeave,
}: {
  room: Room | null;
  roomTitle: string;
  members: Member[];
  connected: boolean;
  canControl: boolean;
  isOwner: boolean;
  hostLabel: string;
  panelTab: string;
  copiedRoomId: string;
  copiedInviteRoomId: string;
  copyRoomId: () => void;
  copyInvite: () => void;
  openSettings: () => void;
  openCreate: () => void;
  openJoin: () => void;
  onToggleMembers: () => void;
  onLeave: () => void;
}) {
  const reducedMotion = useReducedMotionSetting();
  return (
    <div className='tm-rooms-heading'>
      <div>
        <div className='tm-room-title-line'>
          <h1>{roomTitle}</h1>
          {room && (
            <div className='tm-room-heading-status' aria-live='polite'>
              <span className='tm-room-state-badge'>
                <span
                  aria-hidden
                  className={`tm-room-connection ${
                    connected ? '' : 'is-offline'
                  }`}
                />
                {connected ? '已连接' : '重连中'}
              </span>
              <motion.span
                key={hostLabel}
                className='tm-room-state-badge'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reducedMotion ? 0.12 : 0.2 }}
              >
                <Shield size={13} aria-hidden />
                {hostLabel}
              </motion.span>
            </div>
          )}
        </div>
        {room && (
          <p className='tm-room-identifier'>
            房间号 {maskedRoomId(room.id)} ·{' '}
            <button onClick={copyRoomId} aria-label='复制房间号'>
              {copiedRoomId === room.id ? '已复制' : '复制'}
            </button>
          </p>
        )}
        {(room?.description || !room) && (
          <p>{room?.description || '创建房间，或用邀请码加入'}</p>
        )}
      </div>
      <div className='tm-rooms-heading-actions'>
        {room ? (
          <>
            <button
              className='tm-room-avatar-cluster'
              aria-label={`成员，${room.memberCount}人`}
              aria-expanded={panelTab === 'members'}
              aria-controls='tm-room-panel-members'
              onClick={onToggleMembers}
            >
              <AnimatePresence initial={false}>
                {/* 同一账号开多个页面会有多条连接；人数按账号算，头像也按账号去重 */}
                {members
                  .filter(
                    (member, i, all) =>
                      all.findIndex((other) => other.name === member.name) === i
                  )
                  .slice(0, 4)
                  .map((member) => (
                    <motion.span
                      key={member.id}
                      className='tm-room-avatar'
                      initial={{
                        opacity: 0,
                        scale: reducedMotion ? 1 : 0.8,
                      }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.8 }}
                      transition={
                        reducedMotion
                          ? { duration: 0.12 }
                          : { type: 'spring', duration: 0.32, bounce: 0.2 }
                      }
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </motion.span>
                  ))}
              </AnimatePresence>
              <span className='tm-room-member-count'>
                {room.memberCount} 人
              </span>
              <ChevronDown size={14} aria-hidden />
            </button>
            <button className='tm-room-primary' onClick={copyInvite}>
              {copiedInviteRoomId === room.id ? (
                <Check size={16} />
              ) : (
                <Copy size={16} />
              )}
              {copiedInviteRoomId === room.id ? '已复制' : '邀请朋友'}
            </button>
            {canControl && (
              <Link
                href='/watch-room/screen'
                className='tm-room-screen-shortcut'
                aria-label='屏幕共享'
              >
                <Monitor size={16} aria-hidden />
                <span>屏幕共享</span>
              </Link>
            )}
            <RoomActionMenu
              label='房间操作'
              items={[
                ...(isOwner
                  ? [{ label: '房间设置', onSelect: openSettings }]
                  : []),
                {
                  label: '退出房间',
                  danger: true,
                  onSelect: onLeave,
                },
              ]}
            />
          </>
        ) : (
          <>
            <button className='tm-room-primary' onClick={openCreate}>
              <Plus size={17} />
              创建房间
            </button>
            <button onClick={openJoin}>
              <Link2 size={16} />
              用邀请码加入
            </button>
          </>
        )}
      </div>
    </div>
  );
}
