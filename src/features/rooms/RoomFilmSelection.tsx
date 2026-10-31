'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import {
  normalizePlaybackHref,
  queueItemFromHref,
} from '@/features/playback/session';

import RoomFilmPicker from './RoomFilmPicker';

export default function RoomFilmSelection() {
  const params = useSearchParams();
  const watchRoom = useWatchRoomContext();
  const room = watchRoom.currentRoom;
  const target = params.get('room') || room?.id;
  const initialFilm = normalizePlaybackHref(params.get('film') || '');
  const candidateParams = new URL(
    initialFilm || '/play',
    'https://tongmu.invalid'
  ).searchParams;
  const candidate =
    initialFilm && candidateParams.get('source') && candidateParams.get('id')
      ? initialFilm
      : null;
  const initialQuery = params.get('q') || candidateParams.get('title') || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const [pickerVersion, setPickerVersion] = useState(0);
  const [showCandidate, setShowCandidate] = useState(true);
  const generation = useRef(0);
  const currentRoom = useRef(room?.id);
  currentRoom.current = room?.id;
  const attempt = useRef<{
    href: string;
    roomId: string;
    commandId: string;
  } | null>(null);
  useEffect(() => {
    generation.current += 1;
    setBusy(false);
    setError('');
    setAdded(null);
    attempt.current = null;
    return () => {
      generation.current += 1;
    };
  }, [room?.id, target]);
  const matches = Boolean(room && room.id === target);
  const roomHref = room
    ? `/watch-room?room=${encodeURIComponent(room.id)}`
    : '/watch-room';
  const add = async (href: string) => {
    if (!matches || !target || !watchRoom.isConnected || busy) return;
    const operation = ++generation.current;
    if (attempt.current?.href !== href || attempt.current.roomId !== target)
      attempt.current = {
        href,
        roomId: target,
        commandId: crypto.randomUUID(),
      };
    setBusy(true);
    setError('');
    try {
      await watchRoom.roomCommand('queue:add', {
        ...queueItemFromHref(href),
        roomId: target,
        commandId: attempt.current.commandId,
      });
      if (generation.current !== operation || currentRoom.current !== target)
        return;
      setAdded(href);
      attempt.current = null;
    } catch (failure) {
      if (generation.current === operation)
        setError(
          failure instanceof Error ? failure.message : '添加失败，请重试'
        );
    } finally {
      if (generation.current === operation) setBusy(false);
    }
  };
  return (
    <PageLayout activePath='/watch-room' pageHasHeading>
      <PageContainer className='tm-rooms'>
        <header className='tm-rooms-heading'>
          <div>
            <h1>添加待看</h1>
            <p>{room?.name || '先创建或进入房间，再为朋友选片'}</p>
          </div>
          <div className='tm-rooms-heading-actions'>
            <Link href={roomHref}>
              <ArrowLeft size={16} aria-hidden />
              返回房间
            </Link>
          </div>
        </header>
        {!matches ? (
          <section
            className='tm-room-feedback tm-room-feedback-error'
            role='alert'
          >
            <p>
              {room
                ? '目标房间已变化，请返回房间重新选片。'
                : '尚未进入房间，请先创建或加入房间。'}
            </p>
            <Link
              href={
                initialFilm
                  ? `/watch-room?${new URLSearchParams({ film: initialFilm })}`
                  : roomHref
              }
            >
              选择房间
            </Link>
          </section>
        ) : (
          <section className='tm-room-selection-card' aria-label='房间选片'>
            <p>加入待看不会切换当前影片。播放由当前主持确认。</p>
            {!watchRoom.isConnected && (
              <p role='alert'>房间连接中断，恢复后可以继续添加。</p>
            )}
            {error && (
              <p className='tm-room-feedback-error' role='alert'>
                {error}
              </p>
            )}
            {added ? (
              <div className='tm-room-selection-result'>
                <p role='status'>
                  「{queueItemFromHref(added).title}
                  」已加入待看片单，当前影片继续播放。
                </p>
                <button
                  className='tm-room-primary'
                  onClick={() => {
                    setAdded(null);
                    setShowCandidate(false);
                    setPickerVersion((value) => value + 1);
                  }}
                >
                  继续选片
                </button>
              </div>
            ) : (
              <>
                {candidate && showCandidate && (
                  <div className='tm-room-selection-candidate'>
                    <h2>{candidateParams.get('title') || '已选择的影片'}</h2>
                    <button
                      className='tm-room-primary'
                      disabled={busy || !watchRoom.isConnected}
                      aria-label={`将${
                        queueItemFromHref(candidate).title
                      }加入待看`}
                      onClick={() => void add(candidate)}
                    >
                      {busy ? '正在添加…' : '加入待看'}
                    </button>
                  </div>
                )}
                <RoomFilmPicker
                  key={`${target}:${pickerVersion}`}
                  busy={busy || !watchRoom.isConnected}
                  onAdd={add}
                  initialQuery={pickerVersion ? '' : initialQuery}
                />
              </>
            )}
          </section>
        )}
      </PageContainer>
    </PageLayout>
  );
}
