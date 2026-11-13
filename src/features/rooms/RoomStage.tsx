'use client';

import { motion } from 'framer-motion';
import {
  Film,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Radio,
  Search,
} from 'lucide-react';
import Link from 'next/link';

import { useReducedMotionSetting } from '@/lib/motion';

import { usePlaybackSession } from '@/features/playback/context';
import PlaybackSlot from '@/features/playback/PlaybackSlot';
import { queuePlaybackHref } from '@/features/playback/session';
import { useRoomPlayback } from '@/features/room/RoomPlaybackBridge';

import type { Room, RoomQueueItem } from '@/types/watch-room';

/**
 * 房间舞台：房间在放片时是全站播放器的停靠位置（PlaybackSlot），
 * 空闲时是开始一起看的入口；下面是影片信息和房间活动入口。
 */
export default function RoomStage({
  room,
  canControl,
  waitingQueue,
  activityHref,
  activityLabel,
  liveEnabled,
  musicEnabled,
  openPicker,
}: {
  room: Room;
  canControl: boolean;
  waitingQueue: RoomQueueItem[];
  activityHref: string | null;
  activityLabel: string;
  liveEnabled: boolean;
  musicEnabled: boolean;
  openPicker: () => void;
}) {
  const playback = usePlaybackSession();
  const roomPlayback = useRoomPlayback();
  const reducedMotion = useReducedMotionSetting();
  return (
    <>
      <section className='tm-room-stage'>
        {room.currentState?.type === 'play' ? (
          <>
            {playback.presentation === 'folded' && (
              <button
                className='tm-room-restore tm-room-primary'
                onClick={playback.restore}
              >
                恢复画面
              </button>
            )}
          </>
        ) : (
          <div className='tm-room-empty-stage'>
            <div className='tm-room-screen-glow' aria-hidden='true' />
            <Film size={32} strokeWidth={1.25} />
            <h2>
              {room.currentState
                ? '房间正在进行其他活动'
                : waitingQueue.length
                ? `下一部：${waitingQueue[0].title}`
                : '选一部影片，开始一起看'}
            </h2>
            <p>
              {waitingQueue.length && !room.currentState
                ? canControl
                  ? `片单里有 ${waitingQueue.length} 部待看，准备好就开始`
                  : `片单里有 ${waitingQueue.length} 部待看，等房主开始播放`
                : activityHref
                ? '当前活动会继续；添加待看不会切换活动。'
                : canControl
                ? '选好影片就能直接开始，所有人同步播放'
                : '把想看的加入片单，等房主开始播放'}
            </p>
            <div className='tm-room-empty-actions'>
              {activityHref ? (
                <Link className='tm-room-primary' href={activityHref}>
                  {activityLabel}
                </Link>
              ) : waitingQueue.length > 0 &&
                !room.currentState &&
                canControl ? (
                <button
                  className='tm-room-primary'
                  onClick={() => {
                    const next = waitingQueue[0];
                    if (next)
                      roomPlayback.playTogether(
                        queuePlaybackHref(next.href, next.episode || 1, next.id)
                      );
                  }}
                >
                  <Play size={15} fill='currentColor' />
                  开始播放
                </button>
              ) : (
                <button
                  className='tm-room-primary'
                  onClick={() => openPicker()}
                >
                  <Plus size={16} />
                  选择影片
                </button>
              )}
              <Link href='/douban?type=movie' className='tm-room-screen-link'>
                <Search size={15} />
                浏览片库
              </Link>
            </div>
          </div>
        )}
        {room.currentState?.type === 'play' && (
          <div className='tm-room-main-anchor'>
            <PlaybackSlot />
          </div>
        )}
      </section>
      <div className='tm-room-support'>
        {playback.metadata.error && (
          <p className='tm-room-media-status' role='status'>
            视频加载失败 · 使用「重新加载影片」重试
          </p>
        )}
        <div className='tm-room-stage-footer'>
          <div>
            <h2>
              {room.currentState?.type === 'play'
                ? room.currentState.videoName
                : '还没有在播放的影片'}
            </h2>
            <p>
              {room.currentState?.type === 'play'
                ? `第 ${room.currentState.episode || 1} 集 · ${
                    playback.metadata.loading ? '正在准备播放' : '原始画质优先'
                  }`
                : '离开页面或收起画面，房间仍会继续'}
            </p>
          </div>
        </div>
        <div className='tm-room-activities'>
          <Link href={`/watch-room/select?room=${encodeURIComponent(room.id)}`}>
            <Plus size={16} />
            添加待看
          </Link>
          {!room.currentState && playback.href && canControl && (
            <button
              className='tm-room-share-current tm-btn tm-btn-ghost'
              onClick={roomPlayback.shareCurrent}
            >
              分享当前正在看的影片
            </button>
          )}
          <button
            className='tm-room-stage-chat'
            onClick={() => window.dispatchEvent(new Event('tongmu:open-chat'))}
          >
            <MessageCircle size={17} />
            聊天
            {Boolean(room.unreadCount) && (
              <motion.b
                key={room.unreadCount}
                initial={{ scale: reducedMotion ? 1 : 0.8 }}
                animate={{ scale: 1 }}
                transition={
                  reducedMotion
                    ? { duration: 0.12 }
                    : { type: 'spring', duration: 0.32, bounce: 0.2 }
                }
              >
                {room.unreadCount}
              </motion.b>
            )}
          </button>
          {liveEnabled && (
            <Link href='/live'>
              <Radio size={15} />
              电视直播
            </Link>
          )}
          {musicEnabled && (
            <Link href='/music'>
              <Music2 size={15} />
              一起听
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
