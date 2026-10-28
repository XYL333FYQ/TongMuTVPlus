'use client';

import { Eye, EyeOff, MessageSquare, Send, X } from 'lucide-react';
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from './context';
import { roomActivityKey } from './room-activity';
import { playbackHrefFromState, playbackIdentity } from './session';

import type { ChatMessage } from '@/types/watch-room';

type DisplayMessage = ChatMessage & { lane: number };

/** Only the canonical confirmed stream enters this surface; history is not an input. */
export function RoomLiveMessages({
  target,
  active,
  activityKey,
}: {
  target: HTMLElement | null;
  active: boolean;
  activityKey?: string | null;
}) {
  const watchRoom = useWatchRoomContextSafe();
  const roomId = watchRoom?.currentRoom?.id;
  const subscribe = watchRoom?.subscribeToRoomMessages;
  const [entries, setEntries] = useState<DisplayMessage[]>([]);
  const entriesRef = useRef<DisplayMessage[]>([]);
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(640);
  const fieldId = useId();
  const feedbackId = `${fieldId}-feedback`;
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const attempt = useRef<{
    roomId: string;
    content: string;
    commandId: string;
  } | null>(null);
  const generation = useRef(0);
  const previousRoom = useRef<string>();
  const seen = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef<ChatMessage[]>([]);
  const lanes = useRef(4);
  const pump = useRef<() => void>(() => undefined);
  const current = useRef({ roomId, active, target, activityKey });
  current.current = { roomId, active, target, activityKey };
  pump.current = () => {
    if (!current.current.active) return;
    const scope = generation.current;
    while (
      pending.current.length &&
      entriesRef.current.length < lanes.current
    ) {
      const message = pending.current.shift();
      if (!message) break;
      const occupied = new Set(entriesRef.current.map((item) => item.lane));
      const freeLane =
        [0, 1, 2, 3]
          .slice(0, lanes.current)
          .find((index) => !occupied.has(index)) || 0;
      entriesRef.current = [
        ...entriesRef.current,
        { ...message, lane: freeLane },
      ];
      timers.current.set(
        message.id,
        setTimeout(() => {
          timers.current.delete(message.id);
          if (generation.current !== scope) return;
          entriesRef.current = entriesRef.current.filter(
            (item) => item.id !== message.id
          );
          setEntries(entriesRef.current);
          pump.current();
        }, 7000)
      );
    }
    setEntries(entriesRef.current);
  };

  const clearDisplay = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    pending.current = [];
    entriesRef.current = [];
    setEntries([]);
  }, []);
  useEffect(() => {
    generation.current += 1;
    clearDisplay();
    setOpen(false);
    setSending(false);
    sendingRef.current = false;
    setFeedback('');
    if (previousRoom.current !== roomId) {
      previousRoom.current = roomId;
      seen.current.clear();
      attempt.current = null;
      draftRef.current = '';
      setDraft('');
    }
    const pendingTimers = timers.current;
    return () => {
      generation.current += 1;
      pendingTimers.forEach((timer) => clearTimeout(timer));
      pendingTimers.clear();
    };
  }, [roomId, active, activityKey, target, clearDisplay]);

  useEffect(() => {
    if (!target) return;
    const measure = () => {
      setWidth(
        target.clientWidth || target.getBoundingClientRect().width || 640
      );
      const count =
        target.clientHeight > 0 && target.clientHeight < 240 ? 2 : 4;
      if (lanes.current !== count) {
        lanes.current = count;
        timers.current.forEach((timer) => clearTimeout(timer));
        timers.current.clear();
        entriesRef.current = [];
        pump.current();
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(target);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [target]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!active || !target || !roomId || !subscribe) return;
    const scope = generation.current;
    return subscribe((event) => {
      if (
        generation.current !== scope ||
        !current.current.active ||
        current.current.roomId !== event.roomId ||
        current.current.target !== target ||
        current.current.activityKey !== activityKey
      )
        return;
      const message = event.message;
      if (seen.current.has(message.id)) return;
      seen.current.add(message.id);
      if (seen.current.size > 500)
        seen.current.delete(seen.current.values().next().value);
      if (!visibleRef.current || document.visibilityState === 'hidden') return;
      if (pending.current.length >= 64) pending.current.shift();
      pending.current.push(message);
      pump.current();
    });
  }, [active, target, roomId, activityKey, subscribe]);

  const closeInput = () => {
    setOpen(false);
    toggle.current?.focus();
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = draftRef.current.trim();
    if (
      !content ||
      sendingRef.current ||
      !active ||
      !roomId ||
      !watchRoom?.isConnected
    )
      return;
    const scope = generation.current;
    const targetRoom = roomId;
    const isCurrent = () =>
      scope === generation.current &&
      current.current.roomId === targetRoom &&
      current.current.active &&
      current.current.target === target &&
      current.current.activityKey === activityKey;
    if (
      attempt.current?.roomId !== targetRoom ||
      attempt.current.content !== content
    )
      attempt.current = {
        roomId: targetRoom,
        content,
        commandId: crypto.randomUUID(),
      };
    sendingRef.current = true;
    setSending(true);
    setFeedback('');
    try {
      await watchRoom.roomCommand('chat:message', {
        roomId: targetRoom,
        content,
        type: 'text',
        commandId: attempt.current.commandId,
      });
      if (!isCurrent()) return;
      if (draftRef.current.trim() === content) {
        draftRef.current = '';
        setDraft('');
      }
      attempt.current = null;
      setFailed(false);
      setFeedback('已发送到房间');
    } catch (error) {
      if (!isCurrent()) return;
      setFailed(true);
      setFeedback(
        error instanceof Error ? error.message : '发送失败，草稿已保留'
      );
    } finally {
      if (isCurrent()) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  };

  if (!active || !target || !roomId) return null;
  return createPortal(
    <div
      className='tm-room-live-surface'
      style={{ '--tm-live-width': `${width}px` } as CSSProperties}
    >
      <div className='tm-room-live-messages' aria-hidden='true'>
        {visible &&
          entries.map((message) => (
            <span
              key={message.id}
              data-tm-room-message
              className='tm-room-live-message'
              style={{ '--tm-live-lane': message.lane } as CSSProperties}
            >
              {message.userName}：{message.content.replace(/\s+/g, ' ')}
            </span>
          ))}
      </div>
      <div
        className='tm-room-live-controls'
        data-composing={open ? 'true' : 'false'}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className='tm-room-live-tools'>
          <button
            type='button'
            ref={toggle}
            aria-expanded={open}
            aria-controls={open ? `${fieldId}-form` : undefined}
            onClick={() => setOpen((value) => !value)}
          >
            <MessageSquare size={17} aria-hidden='true' />
            <span>发送房间消息</span>
          </button>
          <button
            type='button'
            aria-label={visible ? '隐藏房间消息' : '显示房间消息'}
            aria-pressed={visible}
            onClick={() => {
              visibleRef.current = !visible;
              setVisible(!visible);
              clearDisplay();
            }}
          >
            {visible ? (
              <Eye size={17} aria-hidden='true' />
            ) : (
              <EyeOff size={17} aria-hidden='true' />
            )}
          </button>
        </div>
        {open && (
          <form
            id={`${fieldId}-form`}
            className='tm-room-live-form'
            aria-label='发送房间消息'
            onSubmit={send}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                closeInput();
              }
            }}
          >
            <label htmlFor={fieldId}>房间消息内容</label>
            <div className='tm-room-live-input-row'>
              <input
                ref={input}
                id={fieldId}
                value={draft}
                onChange={(event) => {
                  draftRef.current = event.target.value;
                  setDraft(event.target.value);
                }}
                maxLength={500}
                placeholder='说点什么…'
                aria-describedby={feedback ? feedbackId : undefined}
              />
              <button
                type='submit'
                aria-label='发送'
                disabled={sending || !watchRoom?.isConnected || !draft.trim()}
              >
                <Send size={18} aria-hidden='true' />
              </button>
              <button
                type='button'
                aria-label='关闭房间消息输入'
                onClick={closeInput}
              >
                <X size={18} aria-hidden='true' />
              </button>
            </div>
            <p
              id={feedbackId}
              role='status'
              className={failed ? 'tm-room-live-error' : undefined}
            >
              {feedback ||
                (!watchRoom?.isConnected ? '房间连接中断，草稿已保留' : '')}
            </p>
          </form>
        )}
      </div>
    </div>,
    target
  );
}

export default function PlaybackRoomMessages() {
  const watchRoom = useWatchRoomContextSafe();
  const session = usePlaybackSessionSafe();
  const room = watchRoom?.currentRoom;
  const state = room?.currentState;
  const active = Boolean(
    session?.followingRoom &&
      session.href &&
      state?.type === 'play' &&
      playbackIdentity(session.href) ===
        playbackIdentity(playbackHrefFromState(state))
  );
  const target =
    session?.controller?.template?.$player ||
    session?.controller?.video.closest<HTMLElement>('.art-video-player') ||
    null;
  return (
    <RoomLiveMessages
      target={target}
      active={active}
      activityKey={room ? roomActivityKey(room) : null}
    />
  );
}
