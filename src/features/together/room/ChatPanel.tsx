'use client';

/*
 * 聊天：消息列表 + 输入框。发出的消息同时以弹幕飘过播放器（可关）。
 */

import { Loader2, MessageSquareText, Send, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ChatMessage } from '@/types/watch-room';

function time(value: number) {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export default function ChatPanel(props: {
  messages: ChatMessage[];
  self: string;
  canChat: boolean;
  canModerate: boolean;
  danmaku: boolean;
  onDanmakuChange(on: boolean): void;
  onSend(text: string): Promise<unknown>;
  onDelete(id: string): void;
  onLoadOlder(): Promise<unknown>;
  onRead(seq: number): void;
}) {
  const list = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const stick = useRef(true);
  const last = props.messages[props.messages.length - 1];

  useLayoutEffect(() => {
    const element = list.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [props.messages.length]);

  useEffect(() => {
    if (last?.seq) props.onRead(last.seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.seq]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      await props.onSend(content);
      setText('');
      stick.current = true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className='tm-t-chat'>
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
        {props.messages.length >= 50 && (
          <button
            type='button'
            className='tm-t-link tm-t-older'
            disabled={loadingOlder}
            onClick={async () => {
              setLoadingOlder(true);
              try {
                await props.onLoadOlder();
              } finally {
                setLoadingOlder(false);
              }
            }}
          >
            {loadingOlder ? (
              <Loader2 size={14} className='tm-w-spin' />
            ) : (
              '更早的消息'
            )}
          </button>
        )}
        {!props.messages.length && (
          <div className='tm-t-chat-empty'>
            <MessageSquareText size={24} aria-hidden='true' />
            <span>还没有人说话</span>
          </div>
        )}
        {props.messages.map((message, index) => {
          const mine = (message.accountId || message.userName) === props.self;
          const previous = props.messages[index - 1];
          const grouped =
            previous &&
            previous.userName === message.userName &&
            message.timestamp - previous.timestamp < 120000;
          return (
            <article
              key={message.id}
              className='tm-t-message'
              data-mine={mine ? 'true' : undefined}
              data-grouped={grouped ? 'true' : undefined}
            >
              {!grouped && (
                <header>
                  <span className='tm-t-message-name'>{message.userName}</span>
                  <time>{time(message.timestamp)}</time>
                </header>
              )}
              <div className='tm-t-bubble'>
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
      <form className='tm-t-compose' onSubmit={submit}>
        <label className='tm-t-danmaku-toggle' title='消息同时作为弹幕飘过画面'>
          <input
            type='checkbox'
            checked={props.danmaku}
            onChange={(event) => props.onDanmakuChange(event.target.checked)}
          />
          <span>弹幕</span>
        </label>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          disabled={!props.canChat}
          placeholder={props.canChat ? '说点什么…' : '房间关闭了聊天'}
          aria-label='聊天内容'
        />
        <button
          type='submit'
          className='tm-t-send'
          disabled={!props.canChat || !text.trim() || sending}
          aria-label='发送'
        >
          {sending ? (
            <Loader2 size={18} className='tm-w-spin' />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
      {error && (
        <p className='tm-t-error tm-t-compose-error' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
}
