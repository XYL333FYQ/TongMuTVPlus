'use client';

/*
 * 房间聊天：消息列表 + 表情 + 输入框。房间页侧栏和其他页面的房间聊天浮窗都用它，
 * 由 RoomChat 接到房间连接上（同一套界面，只有一份代码）。
 */

import {
  MessageSquareOff,
  MessageSquareText,
  Send,
  Smile,
  Trash2,
} from 'lucide-react';
import {
  FormEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import './ChatPanel.css';

import BusyDots from '@/components/feedback/BusyDots';
import EmptyState from '@/components/feedback/EmptyState';
import Switch from '@/components/ui/Switch';

import { EMOJIS } from './chat-emoji';

import type { ChatMessage } from '@/types/watch-room';

function time(value: number) {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  self: string;
  canChat: boolean;
  canModerate: boolean;
  connected: boolean;
  danmaku: boolean;
  onDanmakuChange(on: boolean): void;
  onSend(text: string, type: 'text' | 'emoji'): Promise<unknown>;
  onDelete(id: string): void;
  /** 读更早的消息，返回读到的条数（0 表示没有更早的了） */
  onLoadOlder(): Promise<number>;
  onRead(seq: number): void;
  /** 浮窗里更紧凑 */
  compact?: boolean;
}

export default function ChatPanel(props: ChatPanelProps) {
  const list = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // 一页 50 条：不满一页说明已经是全部
  const [hasOlder, setHasOlder] = useState(props.messages.length >= 50);
  const stick = useRef(true);
  const emojiId = useId();
  const last = props.messages[props.messages.length - 1];
  const disabled = !props.canChat || !props.connected;

  useLayoutEffect(() => {
    const element = list.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [props.messages.length]);

  useEffect(() => {
    if (last?.seq) props.onRead(last.seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.seq]);

  useEffect(() => {
    if (!emojiOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEmojiOpen(false);
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [emojiOpen]);

  const send = async (content: string, type: 'text' | 'emoji') => {
    const value = content.trim();
    if (!value || sending || disabled) return false;
    setSending(true);
    setError('');
    try {
      await props.onSend(value, type);
      stick.current = true;
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发送失败');
      return false;
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await send(text, 'text')) setText('');
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const count = await props.onLoadOlder();
      if (!count) setHasOlder(false);
    } catch {
      setError('读取更早的消息失败');
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div
      className='tm-room-chat'
      data-compact={props.compact ? 'true' : undefined}
    >
      <div
        ref={list}
        className='tm-room-chat-messages'
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            40;
        }}
      >
        {hasOlder && props.messages.length > 0 && (
          <button
            type='button'
            className='tm-room-chat-older'
            disabled={loadingOlder}
            aria-busy={loadingOlder || undefined}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? (
              <>
                加载中 <BusyDots size={14} />
              </>
            ) : (
              '更早的消息'
            )}
          </button>
        )}
        {!props.messages.length && (
          <EmptyState
            compact
            icon={<MessageSquareText size={24} />}
            title='还没有消息'
            className='tm-room-chat-empty'
          />
        )}
        {props.messages.map((message, index) => {
          const mine = (message.accountId || message.userName) === props.self;
          const previous = props.messages[index - 1];
          const grouped =
            previous &&
            previous.userName === message.userName &&
            message.timestamp - previous.timestamp < 120000;
          const emoji = message.type === 'emoji';
          return (
            <article
              key={message.id}
              className='tm-room-chat-message'
              // 触屏上点一下消息才露出删除按钮
              tabIndex={mine || props.canModerate ? -1 : undefined}
              data-mine={mine ? 'true' : undefined}
              data-grouped={grouped ? 'true' : undefined}
            >
              {!grouped && (
                <header>
                  {!mine && (
                    <span className='tm-room-avatar' aria-hidden='true'>
                      {message.userName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className='tm-room-chat-message-name'>
                    {mine ? '我' : message.userName}
                  </span>
                  <time>{time(message.timestamp)}</time>
                </header>
              )}
              <div
                className='tm-room-chat-bubble'
                data-emoji={emoji ? 'true' : undefined}
              >
                <p>{message.content}</p>
                {(mine || props.canModerate) && (
                  <button
                    type='button'
                    className='tm-room-chat-message-delete'
                    onClick={() => props.onDelete(message.id)}
                    aria-label='删除这条消息'
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {emojiOpen && (
        <div
          id={emojiId}
          className='tm-room-chat-emojis'
          role='group'
          aria-label='表情'
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type='button'
              disabled={disabled || sending}
              onClick={() => void send(emoji, 'emoji')}
              aria-label={`发送 ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form className='tm-room-chat-compose' onSubmit={submit}>
        <button
          type='button'
          className='tm-room-chat-compose-icon'
          aria-label='表情'
          aria-expanded={emojiOpen}
          aria-controls={emojiOpen ? emojiId : undefined}
          data-active={emojiOpen ? 'true' : undefined}
          disabled={disabled}
          onClick={() => setEmojiOpen((open) => !open)}
        >
          <Smile size={20} />
        </button>
        <input
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          disabled={disabled}
          placeholder={
            !props.connected
              ? '正在重新连接…'
              : props.canChat
              ? '说点什么…'
              : '房间关闭了聊天'
          }
          aria-label='聊天内容'
        />
        <button
          type='button'
          className='tm-room-chat-compose-icon'
          aria-pressed={props.danmaku}
          aria-label='消息飘成弹幕'
          title={props.danmaku ? '消息会飘成弹幕' : '消息不飘成弹幕'}
          data-active={props.danmaku ? 'true' : undefined}
          onClick={() => props.onDanmakuChange(!props.danmaku)}
        >
          {props.danmaku ? (
            <MessageSquareText size={20} />
          ) : (
            <MessageSquareOff size={20} />
          )}
        </button>
        <button
          type='submit'
          className='tm-room-chat-send'
          disabled={disabled || !text.trim() || sending}
          aria-busy={sending || undefined}
          aria-label='发送'
        >
          {sending ? <BusyDots size={18} /> : <Send size={18} />}
        </button>
      </form>
      {/* 电脑房间页的宽聊天栏用这一行开关（输入框里的弹幕图标藏起来），其他地方只显示报错 */}
      <div
        className='tm-room-chat-compose-foot'
        data-has-error={error ? 'true' : undefined}
      >
        <label className='tm-room-chat-dm-row'>
          <Switch
            checked={props.danmaku}
            onChange={(next) => props.onDanmakuChange(next)}
          />
          消息飘成弹幕
        </label>
        {error ? (
          <span className='tm-room-chat-compose-error' role='alert'>
            {error}
          </span>
        ) : (
          <span className='tm-room-chat-dm-row-hint'>
            全屏时在控制条里也能发
          </span>
        )}
      </div>
    </div>
  );
}
