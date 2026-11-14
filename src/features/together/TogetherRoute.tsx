'use client';

/*
 * /watch-room：没在房间里显示大厅，在房间里显示房间页。
 * 支持邀请链接 ?room=房间号；进房间时把“自己看”的播放暂停并收起小窗。
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageLayout from '@/components/PageLayout';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import { usePlaybackSessionSafe } from '@/features/playback/context';

import { filmFromHref, playChange } from './commands';
import { isExternalRoomServer } from './lib/external-room-server';
import { defaultRoomName } from './lib/room-presentation';
import Lobby from './lobby/Lobby';
import RoomForm, {
  defaultRoomValues,
  Dialog,
  RoomFormValues,
} from './room/RoomForm';
import RoomView from './room/RoomView';

function Together() {
  const room = useWatchRoomContext();
  const router = useRouter();
  const params = useSearchParams();
  const solo = usePlaybackSessionSafe();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [password, setPassword] = useState<{
    roomId: string;
    value: string;
  } | null>(null);
  const [showLobby, setShowLobby] = useState(false);
  const attempted = useRef('');
  const inviteId = params.get('room') || '';
  const film = params.get('film') || '';
  const pick = params.get('pick') || '';
  const current = room.currentRoom;

  useEffect(
    () => setUsername(getAuthInfoFromBrowserCookie()?.username || ''),
    []
  );

  // 进房间页：关掉“自己看”的播放（进度已存进播放记录），不让两个画面同时出声
  const soloHref = solo?.href;
  const endSolo = solo?.endSession;
  useEffect(() => {
    if (current && !showLobby && soloHref) endSolo?.();
  }, [current, showLobby, soloHref, endSolo]);

  const requireLogin = useCallback(
    (roomId?: string) => {
      if (getAuthInfoFromBrowserCookie()?.username) return true;
      const target = `/watch-room${
        roomId ? `?room=${encodeURIComponent(roomId)}` : ''
      }`;
      router.push(`/login?redirect=${encodeURIComponent(target)}`);
      return false;
    },
    [router]
  );

  const join = useCallback(
    async (roomId: string, roomPassword?: string) => {
      const id = roomId.trim();
      if (!id || !requireLogin(id)) return;
      if (current?.id === id) {
        setShowLobby(false);
        return;
      }
      if (!room.isConnected) {
        setError('正在连接房间服务，请稍后再试');
        return;
      }
      setBusy(true);
      setError('');
      room.clearError();
      try {
        if (current) room.leaveRoom();
        await room.joinRoom({
          roomId: id,
          password: roomPassword,
          userName: getAuthInfoFromBrowserCookie()?.username || '',
        });
        setPassword(null);
        setShowLobby(false);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : '加入失败';
        if (/密码/.test(message)) setPassword({ roomId: id, value: '' });
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [current, room, requireLogin]
  );

  // 邀请链接
  useEffect(() => {
    if (!inviteId || !room.isConnected || attempted.current === inviteId)
      return;
    if (!getAuthInfoFromBrowserCookie()?.username)
      return void requireLogin(inviteId);
    attempted.current = inviteId;
    void join(inviteId).then(() =>
      router.replace('/watch-room', { scroll: false })
    );
  }, [inviteId, room.isConnected, join, requireLogin, router]);

  // 从播放页“和朋友一起看”过来：进房后直接放这一部
  const sentFilm = useRef('');
  useEffect(() => {
    if (!film || !current || sentFilm.current === film) return;
    if (!current.myPermissions?.includes('changeMedia')) return;
    const target = filmFromHref(film);
    if (!target) return;
    sentFilm.current = film;
    const episode =
      Number(
        new URL(film, 'https://tongmu.invalid').searchParams.get('episode')
      ) || 1;
    void room
      .roomCommand('play:change', {
        ...(playChange(target, episode) as unknown as Record<string, unknown>),
        roomId: current.id,
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : '放映失败')
      )
      .finally(() => router.replace('/watch-room', { scroll: false }));
  }, [film, current, room, router]);

  const create = async (values: RoomFormValues) => {
    setBusy(true);
    setError('');
    try {
      if (current) room.leaveRoom();
      await room.createRoom({
        name: values.name.trim() || defaultRoomName(username),
        description: values.description,
        password: values.password || undefined,
        isPublic: values.isPublic,
        roomType: 'sync',
        userName: username,
        settings: {
          memberPermissions: values.memberPermissions,
          requireApproval: values.requireApproval,
          maxMembers: values.maxMembers,
          chatEnabled: values.chatEnabled,
          autoPlay: values.autoPlay,
          waitForBuffering: values.waitForBuffering,
        },
      });
      setCreating(false);
      setShowLobby(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  if (isExternalRoomServer(room.config))
    return (
      <div className='tm-page-container tm-t-lobby'>
        <h1 className='tm-t-h1'>一起看</h1>
        <p className='tm-t-lead'>
          当前站点使用外部房间服务，请在那里创建和加入房间。
        </p>
      </div>
    );

  return (
    <>
      {current && !showLobby ? (
        <RoomView
          pick={pick}
          onPickHandled={() => router.replace('/watch-room', { scroll: false })}
          onBack={() => setShowLobby(true)}
          onLeave={() => {
            room.leaveRoom();
            setShowLobby(false);
          }}
        />
      ) : (
        <Lobby
          loggedIn={!!username}
          connected={room.isConnected}
          error={error || room.lastError || ''}
          busy={busy}
          onCreate={() => {
            if (!requireLogin()) return;
            setError('');
            setCreating(true);
          }}
          onJoin={(id) => void join(id)}
        />
      )}
      {creating && (
        <Dialog title='创建房间' onClose={() => setCreating(false)} wide>
          <RoomForm
            mode='create'
            initial={defaultRoomValues(defaultRoomName(username))}
            busy={busy}
            error={error}
            onSubmit={(values) => void create(values)}
            onCancel={() => setCreating(false)}
          />
        </Dialog>
      )}
      {password && (
        <Dialog title='这个房间需要密码' onClose={() => setPassword(null)}>
          <form
            className='tm-t-form'
            onSubmit={(event) => {
              event.preventDefault();
              void join(password.roomId, password.value);
            }}
          >
            <label className='tm-t-field'>
              <span>房间密码</span>
              <input
                autoFocus
                value={password.value}
                onChange={(event) =>
                  setPassword({ ...password, value: event.target.value })
                }
              />
            </label>
            {error && (
              <p className='tm-t-error' role='alert'>
                {error}
              </p>
            )}
            <div className='tm-t-form-actions'>
              <span className='tm-t-spacer' />
              <button
                type='submit'
                className='tm-t-btn tm-t-btn-primary'
                disabled={busy || !password.value}
              >
                进入
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

export default function TogetherRoute() {
  return (
    <PageLayout activePath='/watch-room'>
      <Suspense
        fallback={<div className='tm-public-feedback'>正在进入房间…</div>}
      >
        <Together />
      </Suspense>
    </PageLayout>
  );
}
