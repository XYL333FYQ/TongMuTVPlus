'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import { normalizeActivityReturnHref } from './room-live';

export default function RoomActivityActions({
  title,
  selectionKey,
  active,
  hasSelection,
  onShare,
  returnHref,
  soundBlocked = false,
  onSound,
}: {
  title: string;
  selectionKey: string;
  active: boolean;
  hasSelection: boolean;
  onShare: () => Promise<void>;
  returnHref?: string;
  soundBlocked?: boolean;
  onSound?: () => Promise<void> | void;
}) {
  const watchRoom = useWatchRoomContextSafe();
  const roomId = watchRoom?.currentRoom?.id;
  const scope = JSON.stringify([roomId, selectionKey]);
  const current = useRef(scope);
  current.current = scope;
  const mounted = useRef(true);
  const lock = useRef(false);
  const generation = useRef(0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    generation.current += 1;
    lock.current = false;
    setPending(false);
    setFeedback('');
    setFailed(false);
  }, [scope]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

  const run = async (action: () => Promise<unknown> | void, success = '') => {
    if (lock.current) return;
    lock.current = true;
    const operation = ++generation.current;
    const isCurrent = () =>
      mounted.current &&
      current.current === scope &&
      generation.current === operation;
    setPending(true);
    setFeedback('');
    setFailed(false);
    try {
      await action();
      if (isCurrent()) setFeedback(success);
    } catch (error) {
      if (isCurrent()) {
        setFailed(true);
        setFeedback(
          error instanceof Error ? error.message : '操作未成功，请重试'
        );
      }
    } finally {
      if (isCurrent()) {
        lock.current = false;
        setPending(false);
      }
    }
  };

  if (!watchRoom) return null;
  const safeReturn = normalizeActivityReturnHref(returnHref || null);
  const creationHref = safeReturn
    ? `/watch-room?activityReturn=${encodeURIComponent(safeReturn)}`
    : '/watch-room';
  return (
    <div
      className='tm-activity-actions'
      aria-label={`${title || '当前内容'}的房间操作`}
    >
      {roomId ? (
        <>
          <button
            type='button'
            disabled={
              pending ||
              !hasSelection ||
              !watchRoom.isConnected ||
              !watchRoom.canControl
            }
            onClick={() => void run(onShare, '已在房间共享')}
          >
            {pending ? '正在确认…' : '在房间播放'}
          </button>
          <p>
            {active
              ? '正在一起看，切换内容将同步至房间'
              : '在这里看不会改变房间，点“在房间播放”才会让大家一起看'}
          </p>
          {!watchRoom.canControl && <p>房主没有开放成员切换房间活动</p>}
        </>
      ) : (
        <Link href={creationHref}>创建或加入房间</Link>
      )}
      {soundBlocked && onSound && hasSelection && (
        <button
          type='button'
          disabled={pending}
          onClick={() => void run(onSound)}
        >
          在此页播放声音
        </button>
      )}
      <p role='status' className={failed ? 'tm-activity-error' : undefined}>
        {feedback}
      </p>
    </div>
  );
}
