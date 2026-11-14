'use client';

/*
 * 不在房间页时的房间入口：
 * - 有小窗时，聊天从小窗上的按钮打开；
 * - 没有小窗（房间没在放、或小窗被关掉）时，右下角是一个“房间”胶囊：房间名、未读、回房间。
 * 聊天面板和房间页侧栏是同一个组件（RoomChat）。
 */

import { ArrowUpRight, MessageCircle, Mic, MicOff, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import RoomChat from '../room/RoomChat';
import type { RoomVoice } from './context';

export function RoomChatSheet(props: {
  roomName: string;
  online: number;
  voice: RoomVoice;
  onClose(): void;
}) {
  const panel = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', close);
    panel.current
      ?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')
      ?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section
      ref={panel}
      className='tm-t-dock'
      role='dialog'
      aria-label={`${props.roomName} 的聊天`}
    >
      <header className='tm-t-dock-head'>
        <div>
          <strong>{props.roomName}</strong>
          <span>{props.online} 人在线</span>
        </div>
        {props.voice.available && (
          <button
            type='button'
            className='tm-t-icon'
            data-active={props.voice.mic ? 'true' : undefined}
            onClick={props.voice.toggleMic}
            disabled={props.voice.connecting}
            aria-label={props.voice.mic ? '关闭麦克风' : '开启麦克风'}
            title={props.voice.mic ? '关闭麦克风' : '开启麦克风'}
          >
            {props.voice.mic ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
        )}
        <Link
          href='/watch-room'
          className='tm-t-icon'
          aria-label='回到房间'
          title='回到房间'
          onClick={props.onClose}
        >
          <ArrowUpRight size={18} />
        </Link>
        <button
          type='button'
          className='tm-t-icon'
          onClick={props.onClose}
          aria-label='收起聊天'
        >
          <X size={18} />
        </button>
      </header>
      <RoomChat compact />
    </section>
  );
}

export function RoomPill(props: {
  roomName: string;
  status: string;
  unread: number;
  onChat(): void;
}) {
  return (
    <div className='tm-t-pill-dock'>
      <Link href='/watch-room' className='tm-t-pill-dock-room'>
        <span className='tm-t-dot' data-on='true' aria-hidden='true' />
        <span className='tm-t-pill-dock-text'>
          <strong>{props.roomName}</strong>
          <span>{props.status}</span>
        </span>
      </Link>
      <button
        type='button'
        className='tm-t-pill-dock-chat'
        onClick={props.onChat}
        aria-label={`房间聊天${props.unread ? `，${props.unread} 条未读` : ''}`}
      >
        <MessageCircle size={18} />
        {props.unread > 0 && (
          <b className='tm-t-mini-badge'>
            {props.unread > 99 ? '99+' : props.unread}
          </b>
        )}
      </button>
    </div>
  );
}
