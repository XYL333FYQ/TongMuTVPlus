'use client';

/*
 * 离开房间页后的房间小窗：只有一块画面，按钮叠在画面上（和自己看的小窗同一个样子）。
 * 左上放大回房间、右上聊天 / 关闭、中间播放暂停（走房间命令，没有权限时不显示）、
 * 右下本机声音、左下片名。关闭只停本机画面，人还在房间里（右下角留一个回房间的入口）。
 */

import {
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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
  unread: number;
  slot(element: HTMLDivElement | null): void;
  onChat(): void;
  onClose(): void;
}) {
  const { paused, muted } = useVideoState(props.player);
  return (
    <section
      className='tm-t-mini'
      aria-label={`房间小窗：${props.roomName}，${props.status}`}
    >
      <div ref={props.slot} className='tm-t-mini-slot' />
      <Link
        href='/watch-room'
        data-mini='full'
        className='tm-t-mini-btn'
        aria-label='回到房间'
        title='回到房间'
      >
        <Maximize2 size={16} />
      </Link>
      <button
        type='button'
        data-mini='chat'
        className='tm-t-mini-btn'
        onClick={props.onChat}
        aria-label={`房间聊天${props.unread ? `，${props.unread} 条未读` : ''}`}
        title='房间聊天'
      >
        <MessageCircle size={16} />
        {props.unread > 0 && (
          <b className='tm-t-mini-badge'>
            {props.unread > 99 ? '99+' : props.unread}
          </b>
        )}
      </button>
      <button
        type='button'
        data-mini='close'
        className='tm-t-mini-btn'
        onClick={props.onClose}
        aria-label='关闭小窗（仍在房间里）'
        title='关闭小窗，仍在房间里'
      >
        <X size={16} />
      </button>
      {props.canPlayback && (
        <button
          type='button'
          data-mini='play'
          className='tm-t-mini-btn'
          onClick={() =>
            paused ? props.player?.play() : props.player?.pause()
          }
          aria-label={paused ? '全房间继续播放' : '全房间暂停'}
          title={paused ? '全房间继续播放' : '全房间暂停'}
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      )}
      <button
        type='button'
        data-mini='mute'
        className='tm-t-mini-btn'
        onClick={() => {
          const video = props.player?.video;
          if (video) video.muted = !video.muted;
        }}
        aria-label={muted ? '打开本机声音' : '本机静音'}
        title={muted ? '打开本机声音' : '本机静音'}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <Link href='/watch-room' data-mini='title' className='tm-t-mini-btn'>
        <strong>{props.title}</strong>
      </Link>
    </section>
  );
}
