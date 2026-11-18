'use client';

/*
 * 离开房间页后的房间小窗。外观、按钮位置、拖动和自己看的小窗完全一样
 * （共用 src/components/mini-player）：左上回房间、右上聊天 / 关闭、
 * 中间播放暂停（走房间同步，没有权限时不显示）、右下本机声音、左下片名。
 * 关闭只停本机画面，人还在房间里（右下角留一个回房间的胶囊）。
 * 点画面本身不做任何事：在房间里点一下画面等于暂停全房间，太容易误触。
 */

import { useEffect, useRef, useState } from 'react';

import MiniPlayerControls from '@/components/mini-player/MiniPlayerControls';
import { useMiniPlayerDrag } from '@/components/mini-player/useMiniPlayerDrag';

import type { WatchPlayer } from '../player/core/WatchPlayer';

function useVideoState(player: WatchPlayer | null) {
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (!player) return;
    const sync = () => {
      setPaused(player.video?.paused ?? true);
      setMuted(player.video?.muted ?? false);
    };
    sync();
    const off = [
      player.on('video:play', sync),
      player.on('video:pause', sync),
      player.on('video:volumechange', sync),
      player.on('video:playing', sync),
      player.on('video:emptied', sync),
    ];
    return () => off.forEach((dispose) => dispose());
  }, [player]);
  return { paused, muted };
}

export default function RoomMini(props: {
  roomName: string;
  title: string;
  status: string;
  player: WatchPlayer | null;
  canPlayback: boolean;
  /** 房间正在放映（浏览器拦下自动播放时，没有权限的成员也能点一下跟上） */
  roomPlaying?: boolean;
  /** 另一个播放器（或另一个标签页）正在出声，这里先静音 */
  soundBlocked?: boolean;
  onClaimSound?(): void;
  unread: number;
  slot(element: HTMLDivElement | null): void;
  onChat(): void;
  onClose(): void;
}) {
  const { paused, muted } = useVideoState(props.player);
  const dragRef = useRef<HTMLDivElement>(null);
  const drag = useMiniPlayerDrag(dragRef, true);
  return (
    <div
      ref={dragRef}
      className='tm-mini-drag'
      data-dragging={drag.dragging ? 'true' : undefined}
      style={drag.style}
    >
      <section
        className='tm-mini'
        data-tm-mini-part=''
        aria-label={`房间小窗：${props.roomName}，${props.status}`}
      >
        <div ref={props.slot} className='tm-mini-slot' />
        <MiniPlayerControls
          video={props.player?.video}
          title={props.title}
          expand={{ label: '回到房间', href: '/watch-room' }}
          close={{ label: '关闭小窗（仍在房间里）', onClick: props.onClose }}
          extra={{
            kind: 'chat',
            label: `房间聊天${props.unread ? `，${props.unread} 条未读` : ''}`,
            onClick: props.onChat,
            badge: props.unread,
          }}
          play={
            props.canPlayback
              ? {
                  paused,
                  disabled: !props.player,
                  playLabel: '全房间继续播放',
                  pauseLabel: '全房间暂停',
                  onToggle: () =>
                    paused ? void props.player?.play() : props.player?.pause(),
                }
              : props.roomPlaying && paused
              ? {
                  // 只是本机没在放（例如浏览器拦下了自动播放）：点了跟上房间进度
                  paused: true,
                  disabled: !props.player,
                  playLabel: '跟上房间播放',
                  pauseLabel: '跟上房间播放',
                  onToggle: () => void props.player?.play(),
                }
              : undefined
          }
          sound={{
            muted: muted || !!props.soundBlocked,
            muteLabel: '本机静音',
            unmuteLabel: props.soundBlocked
              ? '在这里听（别处正在出声）'
              : '打开本机声音',
            onToggle: () => {
              if (props.soundBlocked) return props.onClaimSound?.();
              const video = props.player?.video;
              if (video) video.muted = !video.muted;
            },
          }}
        />
      </section>
    </div>
  );
}
