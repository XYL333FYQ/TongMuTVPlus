'use client';

import {
  ArrowUpRight,
  Check,
  Copy,
  MessageCircle,
  Mic,
  MicOff,
  Send,
  Smile,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useVoiceChat } from '@/hooks/useVoiceChat';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';

const EMOJIS = ['😀', '😂', '😍', '😎', '🤔', '👍', '👏', '🎉', '❤️', '🔥'];

export default function ChatFloatingWindow() {
  const roomContext = useWatchRoomContextSafe();
  const playback = usePlaybackSessionSafe();
  const room = roomContext?.currentRoom;
  const [open, setOpen] = useState(false);
  const [chatSlot, setChatSlot] = useState<HTMLElement | null>(null);
  const [inlineVisible, setInlineVisible] = useState(false);
  const panelVisible = chatSlot ? inlineVisible : open;
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1200px)');
    const update = () => {
      const target = document.querySelector<HTMLElement>(
        '[data-tm-room-chat-slot]'
      );
      setChatSlot(target);
      setInlineVisible(
        Boolean(target && (media.matches || target.dataset.active === 'true'))
      );
      if (target?.dataset.active === 'true' && atBottom.current) {
        requestAnimationFrame(() => {
          if (bodyRef.current && atBottom.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
          }
        });
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active'],
    });
    media.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiId = useId();
  const emojiTrigger = useRef<HTMLButtonElement>(null);
  const emojiPanel = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (!emojiOpen) return;
    const first = emojiPanel.current?.querySelector<HTMLButtonElement>(
      'button:not(:disabled)'
    );
    (first || emojiTrigger.current)?.focus({ preventScroll: true });
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (emojiPanel.current?.contains(target) ||
        emojiTrigger.current?.contains(target));
    const dismiss = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        !inside(event.target)
      )
        return;
      event.preventDefault();
      setEmojiOpen(false);
      emojiTrigger.current?.focus({ preventScroll: true });
    };
    const outside = (event: Event) => {
      if (!inside(event.target)) setEmojiOpen(false);
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [emojiOpen, roomContext?.isConnected]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState('');
  const notice = roomContext?.notices[roomContext.notices.length - 1];
  const latestHostChange = useRef({ at: 0, self: false });
  useEffect(() => {
    const socket = roomContext?.socket;
    const changed = (state: { controllerSessionId: string | null }) => {
      latestHostChange.current = {
        at: Date.now(),
        self: Boolean(
          state.controllerSessionId && state.controllerSessionId === socket?.id
        ),
      };
    };
    socket?.on('room:controller-changed', changed);
    return () => {
      socket?.off('room:controller-changed', changed);
    };
  }, [roomContext?.socket]);
  const ownHostNotice =
    notice?.message === '房间主持已更新，影片继续播放' &&
    (Math.abs((notice?.timestamp || 0) - latestHostChange.current.at) < 1000
      ? latestHostChange.current.self
      : roomContext?.canControl);
  useEffect(() => {
    if (!notice) return;
    if (ownHostNotice) {
      setDismissedNotice(notice.id);
      return;
    }
    const remaining = Math.max(0, 4000 - (Date.now() - notice.timestamp));
    const timer = setTimeout(() => setDismissedNotice(notice.id), remaining);
    return () => clearTimeout(timer);
  }, [notice, ownHostNotice, room?.id]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasOlderHistory, setHasOlderHistory] = useState(true);
  const historyGeneration = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const visibleSeqs = useRef(new Set<number>());
  const lastRead = useRef(0);
  const markReadRef = useRef(roomContext?.markChatRead);
  markReadRef.current = roomContext?.markChatRead;
  const voice = useVoiceChat({
    socket: roomContext?.socket || null,
    roomId: room?.id || null,
    isMicEnabled: voiceEnabled && micEnabled,
    isSpeakerEnabled: speakerEnabled,
    members: roomContext?.members || [],
  });

  useEffect(() => {
    setVoiceEnabled(
      Boolean(
        (window.RUNTIME_CONFIG as Record<string, unknown> | undefined)
          ?.ENABLE_ROOM_VOICE
      )
    );
    const show = () => setOpen(true);
    window.addEventListener('tongmu:open-chat', show);
    return () => window.removeEventListener('tongmu:open-chat', show);
  }, []);
  useEffect(() => {
    historyGeneration.current += 1;
    setOpen(false);
    setEmojiOpen(false);
    setDraft('');
    setError('');
    setMicEnabled(false);
    lastRead.current = 0;
    atBottom.current = true;
    visibleSeqs.current.clear();
    setHasOlderHistory(true);
    setLoadingHistory(false);
    return () => {
      historyGeneration.current += 1;
    };
  }, [room?.id]);

  // Opening a window alone does not mark messages read. Only visible messages in the foreground do.
  useEffect(() => {
    const root = bodyRef.current;
    if (!panelVisible || !root || !room?.id) return;
    visibleSeqs.current.clear();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const submit = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus())
        return;
      const seq = Math.max(0, ...Array.from(visibleSeqs.current));
      if (seq <= lastRead.current) return;
      const previous = lastRead.current;
      lastRead.current = seq;
      void markReadRef.current?.(seq).catch(() => {
        lastRead.current = previous;
      });
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(submit, 350);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const seq = Number((entry.target as HTMLElement).dataset.seq);
          if (!seq) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5)
            visibleSeqs.current.add(seq);
          else visibleSeqs.current.delete(seq);
        }
        schedule();
      },
      { root, threshold: [0, 0.5, 1] }
    );
    root
      .querySelectorAll('[data-seq]')
      .forEach((element) => observer.observe(element));
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('focus', schedule);
    const retry = window.setInterval(submit, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(retry);
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('focus', schedule);
    };
  }, [panelVisible, chatSlot, room?.id, roomContext?.chatMessages]);

  useEffect(() => {
    if (panelVisible && atBottom.current && bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [panelVisible, chatSlot, roomContext?.chatMessages.length]);

  const send = async (content = draft, type: 'text' | 'emoji' = 'text') => {
    if (!content.trim() || !roomContext?.isConnected || sending) return;
    if (type === 'emoji') emojiTrigger.current?.focus({ preventScroll: true });
    setSending(true);
    setError('');
    try {
      await roomContext.roomCommand('chat:message', {
        content: content.trim(),
        type,
      });
      setDraft((current) => (current === content ? '' : current));
      setEmojiOpen(false);
      atBottom.current = true;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : '消息发送失败，内容已保留'
      );
    } finally {
      setSending(false);
    }
  };
  const copyInvite = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/watch-room?room=${encodeURIComponent(
          room.id
        )}`
      );
      setCopied(true);
    } catch {
      setError('无法复制，请在房间页复制邀请地址');
    }
  };
  const loadOlder = async () => {
    const before = roomContext?.chatMessages[0]?.seq;
    if (!before || loadingHistory || !roomContext) return;
    const generation = historyGeneration.current;
    setLoadingHistory(true);
    setError('');
    atBottom.current = false;
    const oldHeight = bodyRef.current?.scrollHeight || 0;
    const oldTop = bodyRef.current?.scrollTop || 0;
    try {
      const page = await roomContext.loadChatHistory(undefined, before);
      if (generation !== historyGeneration.current) return;
      if (page.length < 50) setHasOlderHistory(false);
      requestAnimationFrame(() => {
        if (generation === historyGeneration.current && bodyRef.current)
          bodyRef.current.scrollTop =
            oldTop + bodyRef.current.scrollHeight - oldHeight;
      });
    } catch (failure) {
      if (generation !== historyGeneration.current) return;
      setError(
        failure instanceof Error ? failure.message : '更早的消息暂时无法加载'
      );
    } finally {
      if (generation === historyGeneration.current) setLoadingHistory(false);
    }
  };
  const unread = room?.unreadCount || 0;
  const hasMini = Boolean(
    playback?.href &&
      (playback.presentation === 'mini' || playback.presentation === 'folded')
  );

  if (!room)
    return roomContext?.reconnectFailed ? (
      <button
        className='tm-room-reconnect'
        onClick={() => roomContext.manualReconnect()}
      >
        房间连接中断 · 点击重连
      </button>
    ) : null;
  const panel = (
    <section
      className={`tm-chat-panel ${chatSlot ? 'tm-chat-panel--inline' : ''}`}
      aria-label='房间聊天'
      hidden={!panelVisible}
    >
      <header>
        <div>
          <h2>{chatSlot ? '聊天' : room.name}</h2>
          <p>
            {roomContext?.isConnected
              ? `${room.memberCount} 人在线`
              : '连接中断，消息暂存'}{' '}
            ·{' '}
            {roomContext?.canControl
              ? '你正在主持'
              : room.controllerAccountId
              ? `${room.controllerAccountId} 主持`
              : '暂无主持'}
          </p>
        </div>
        {!chatSlot && (
          <Link
            href={`/watch-room?room=${encodeURIComponent(room.id)}`}
            aria-label='打开房间工作区'
          >
            <ArrowUpRight size={18} />
          </Link>
        )}
        <button
          onClick={copyInvite}
          aria-label='复制邀请链接'
          title='复制房间邀请链接'
          className='tm-chat-copy-invite'
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
          <span>{copied ? '已复制' : '复制邀请'}</span>
        </button>
        {!chatSlot && (
          <button
            onClick={() => setOpen(false)}
            aria-label='收起聊天，继续接收消息'
          >
            <X size={19} />
          </button>
        )}
      </header>
      {!roomContext?.isConnected && (
        <button
          className='tm-chat-reconnect'
          onClick={() => roomContext?.manualReconnect()}
        >
          重新连接房间
        </button>
      )}
      <div
        ref={bodyRef}
        className='tm-chat-messages'
        onScroll={() => {
          const node = bodyRef.current;
          if (node)
            atBottom.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 60;
        }}
      >
        {hasOlderHistory && Boolean(roomContext?.chatMessages.length) && (
          <button
            className='tm-chat-load-older'
            onClick={loadOlder}
            disabled={loadingHistory}
          >
            {loadingHistory ? '正在加载…' : '查看更早的消息'}
          </button>
        )}
        {!roomContext?.chatMessages.length && (
          <p className='tm-chat-empty'>暂无消息</p>
        )}
        {roomContext?.chatMessages.map((message, index, list) => {
          const prev = index > 0 ? list[index - 1] : undefined;
          const grouped =
            Boolean(prev) &&
            prev?.userName === message.userName &&
            message.timestamp - (prev?.timestamp || 0) < 120000;
          const selfMember = roomContext?.members?.find(
            (member) => member.id === roomContext?.socket?.id
          );
          const isSelf = Boolean(
            (selfMember && message.userName === selfMember.name) ||
              (message.userId && message.userId === roomContext?.socket?.id)
          );
          return (
            <article
              key={message.id}
              data-seq={message.seq}
              data-grouped={grouped ? 'true' : undefined}
              data-self={isSelf ? 'true' : undefined}
              className={
                message.type === 'emoji' ? 'tm-chat-emoji-message' : ''
              }
            >
              <div>
                <strong>{message.userName}</strong>
                <time dateTime={new Date(message.timestamp).toISOString()}>
                  {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p>{message.content}</p>
            </article>
          );
        })}
      </div>
      {unread > 0 && (
        <button
          className='tm-chat-new-messages'
          onClick={() => {
            atBottom.current = true;
            if (bodyRef.current)
              bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
          }}
        >
          {unread}条未读 · 看最新消息
        </button>
      )}
      {error && (
        <p className='tm-chat-error' role='alert'>
          {error}
        </p>
      )}
      {voiceEnabled && (
        <div className='tm-chat-voice'>
          <button
            onClick={() => setMicEnabled((value) => !value)}
            disabled={voice.isConnecting}
          >
            {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            {micEnabled ? '关闭麦克风' : '开启麦克风'}
          </button>
          <button
            onClick={() => setSpeakerEnabled((value) => !value)}
            aria-label='切换语音声音'
          >
            {speakerEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {voice.error && <span role='status'>{voice.error}</span>}
        </div>
      )}
      {emojiOpen && (
        <div
          ref={emojiPanel}
          id={emojiId}
          className='tm-chat-emojis'
          role='group'
          aria-label='表情'
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type='button'
              disabled={sending || !roomContext?.isConnected}
              onClick={() => send(emoji, 'emoji')}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <button
          ref={emojiTrigger}
          type='button'
          aria-label='选择表情'
          aria-expanded={emojiOpen}
          aria-controls={emojiOpen ? emojiId : undefined}
          onClick={() => setEmojiOpen((value) => !value)}
        >
          <Smile size={19} />
        </button>
        <input
          aria-label='消息内容'
          placeholder='说点什么…'
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type='submit'
          disabled={sending || !draft.trim() || !roomContext?.isConnected}
          aria-label='发送消息'
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  );
  return (
    <div className={`tm-chat-layer ${hasMini ? 'tm-chat-with-mini' : ''}`}>
      {notice && !ownHostNotice && notice.id !== dismissedNotice && (
        <div className='tm-room-notice' role='status'>
          <span>{notice.message}</span>
          <button
            onClick={() => setDismissedNotice(notice.id)}
            aria-label='关闭房间提示'
          >
            <X size={14} />
          </button>
        </div>
      )}
      {!chatSlot && !open && !hasMini && (
        <button
          className='tm-chat-launcher'
          onClick={() => setOpen(true)}
          aria-label={`房间聊天，${unread}条未读`}
        >
          <MessageCircle size={18} />
          <span>房间消息</span>
          {unread > 0 && (
            <b key={unread} className='tm-room-unread-enter'>
              {unread > 99 ? '99+' : unread}
            </b>
          )}
        </button>
      )}
      {chatSlot ? createPortal(panel, chatSlot) : open ? panel : null}
    </div>
  );
}
