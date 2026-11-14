'use client';

/*
 * 房间聊天：消息列表 + 表情 + 输入框。房间页侧栏和其他页面的房间聊天浮窗都用它，
 * 由 RoomChat 接到房间连接上（同一套界面，只有一份代码）。
 */

import { Loader2, MessageSquareText, Send, Smile, Trash2 } from 'lucide-react';
import {
  FormEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { ChatMessage } from '@/types/watch-room';

/** 常用表情：单独发出时放大显示 */
export const EMOJIS = [
  '😀',
  '😂',
  '🤣',
  '😊',
  '😍',
  '🥰',
  '😘',
  '😎',
  '🤔',
  '😮',
  '😱',
  '😭',
  '😤',
  '😴',
  '🤯',
  '🥲',
  '👍',
  '👏',
  '🙏',
  '💪',
  '👀',
  '🎉',
  '❤️',
  '💔',
  '🔥',
  '✨',
  '💯',
  '🍿',
  '🎬',
  '🌙',
  '☕',
  '🤝',
];

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
      className='tm-t-chat'
      data-compact={props.compact ? 'true' : undefined}
    >
      <div
        ref={list}
        className='tm-t-messages'
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
            className='tm-t-older'
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? (
              <Loader2 size={14} className='tm-t-spin' />
            ) : (
              '更早的消息'
            )}
          </button>
        )}
        {!props.messages.length && (
          <div className='tm-t-chat-empty'>
            <MessageSquareText size={26} aria-hidden='true' />
            <strong>还没有人说话</strong>
            <span>打个招呼，或者发个表情</span>
          </div>
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
              className='tm-t-message'
              data-mine={mine ? 'true' : undefined}
              data-grouped={grouped ? 'true' : undefined}
            >
              {!grouped && (
                <header>
                  {!mine && (
                    <span className='tm-t-avatar' aria-hidden='true'>
                      {message.userName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className='tm-t-message-name'>
                    {mine ? '我' : message.userName}
                  </span>
                  <time>{time(message.timestamp)}</time>
                </header>
              )}
              <div
                className='tm-t-bubble'
                data-emoji={emoji ? 'true' : undefined}
              >
                <p>{message.content}</p>
                {(mine || props.canModerate) && (
                  <button
                    type='button'
                    className='tm-t-message-delete'
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
          className='tm-t-emojis'
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

      <form className='tm-t-compose' onSubmit={submit}>
        <button
          type='button'
          className='tm-t-compose-icon'
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
          type='submit'
          className='tm-t-send'
          disabled={disabled || !text.trim() || sending}
          aria-label='发送'
        >
          {sending ? (
            <Loader2 size={18} className='tm-t-spin' />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
      <div className='tm-t-compose-foot'>
        <label className='tm-t-switch'>
          <input
            type='checkbox'
            role='switch'
            checked={props.danmaku}
            onChange={(event) => props.onDanmakuChange(event.target.checked)}
          />
          <span aria-hidden='true' />
          消息飘成弹幕
        </label>
        {error && (
          <span className='tm-t-compose-error' role='alert'>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
