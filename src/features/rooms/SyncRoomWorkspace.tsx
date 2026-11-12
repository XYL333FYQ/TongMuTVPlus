'use client';
import { Film, Plus, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import { usePlaybackSession } from '@/features/playback/context';
import PlaybackSlot from '@/features/playback/PlaybackSlot';
import RoomFilmPicker from './RoomFilmPicker';
import { useTogetherSession } from './TogetherSessionProvider';
import { operationId } from './synctv/identifiers';
import type { synctv } from './synctv/protocol/client';

type RoomSummary = {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  passwordEnabled?: boolean;
};
export default function SyncRoomWorkspace() {
  const session = useTogetherSession();
  const current = useRef(session);
  current.current = session;
  const playback = usePlaybackSession();
  const router = useRouter();
  const params = useSearchParams();
  const formId = useId();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [invalid, setInvalid] = useState({ name: false, invite: false });
  const [directory, setDirectory] = useState<'mine' | 'public'>('mine');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  const attempted = useRef('');
  const roomId = session?.roomId;
  const api = session?.api;
  const identityId = session?.identity?.identityId;
  const snapshot = session?.snapshot;
  const media = snapshot?.resources.playlist_items?.playlistItems?.media || [];
  const state = snapshot?.resources.playback_state?.playbackState;
  const online =
    snapshot?.resources.online_count?.onlineCount?.onlineMemberCount || 0;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const perform = useCallback(async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await action();
    } catch {
      if (mounted.current) setError('操作未完成，请检查权限或稍后重试');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!api || !identityId) return;
      const response = await api.request<{ rooms: { room: RoomSummary }[] }>(
        directory === 'mine' ? '/rooms' : '/directory',
        { signal }
      );
      if (!signal?.aborted && mounted.current)
        setRooms(
          (response.rooms || []).map((item) => item.room).filter(Boolean)
        );
    },
    [api, identityId, directory]
  );
  useEffect(() => {
    const abort = new AbortController();
    void refresh(abort.signal).catch(() => {
      if (!abort.signal.aborted) setError('房间列表暂时无法刷新');
    });
    return () => abort.abort();
  }, [refresh]);
  useEffect(() => {
    if (!roomId || !api) {
      setRoom(null);
      return;
    }
    const abort = new AbortController();
    void api
      .request<{ room: RoomSummary }>('/rooms/' + roomId, {
        signal: abort.signal,
      })
      .then((data) => {
        if (!abort.signal.aborted) setRoom(data.room);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError('房间资料暂时无法读取');
      });
    const unsubscribe = current.current?.observe({
      observeId: 'playlist_items',
      deliveryMode: 2,
      playlistItems: { request: { page: { page: 1 }, pageSize: 100 } },
    });
    return () => {
      abort.abort();
      unsubscribe?.();
    };
  }, [api, roomId]);
  const requested = params.get('room');
  useEffect(() => {
    if (
      !requested ||
      !identityId ||
      !/^room_[A-Za-z0-9]{1,59}$/.test(requested) ||
      requested === roomId
    )
      return;
    const key = identityId + ':' + requested;
    if (attempted.current === key) return;
    attempted.current = key;
    void perform(async () => {
      await current.current?.open(requested);
    });
  }, [requested, identityId, roomId, perform]);
  const create = async () => {
    if (!api) return;
    const created = await api.request<RoomSummary>('/rooms', {
      method: 'POST',
      body: { name: name.trim(), isPublic },
    });
    if (!mounted.current) return;
    await current.current?.open(created.id, false);
    if (mounted.current) {
      setName('');
      router.replace('/watch-room?room=' + created.id);
    }
  };
  const join = async (id: string) => {
    await current.current?.open(id);
    if (mounted.current) router.replace('/watch-room?room=' + id);
  };
  const add = async (href: string) => {
    if (!api || !roomId) return;
    const parsed = new URL(href, window.location.origin);
    const selected = Number(parsed.searchParams.get('episode') || 1);
    if (!Number.isSafeInteger(selected) || selected < 1)
      throw new Error('无效的集数');
    await api.request('/rooms/' + roomId + '/media', {
      method: 'POST',
      body: {
        source: parsed.searchParams.get('source'),
        filmId: parsed.searchParams.get('id'),
        episodeIndex: selected - 1,
        kind: 'movie',
        requestId: operationId(),
      },
    });
    if (mounted.current) setFeedback('已加入片单，当前播放继续');
  };
  const play = async (item: synctv.client.IMedia) => {
    if (!session?.snapshot?.canControlPlayback || !item.id) return;
    await session.follow(true);
    session.send({
      playbackUpdate: { mediaId: item.id, clientOperationId: operationId() },
    });
  };
  return (
    <PageLayout activePath='/watch-room' mobileTitle='房间' pageHasHeading>
      <PageContainer
        className='tm-rooms tm-together'
        data-joined={Boolean(roomId)}
      >
        <header className='tm-rooms-heading'>
          <div>
            <h1>{roomId ? room?.name || '房间' : '一起看'}</h1>
            <p>
              {roomId
                ? snapshot?.following
                  ? '和朋友一起观看，播放状态由房间同步'
                  : '你正在自己看，房间和片单仍然保留'
                : '创建房间，或用邀请进入，一起选片和观看'}
            </p>
          </div>
          <div className='tm-rooms-heading-actions'>
            {roomId ? (
              <>
                <span role='status'>
                  {snapshot?.status === 'connected'
                    ? `${online} 人在线`
                    : '正在连接…'}
                </span>
                <button
                  type='button'
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await session?.leave();
                      router.replace('/watch-room');
                    })
                  }
                >
                  退出房间
                </button>
              </>
            ) : (
              <button
                type='button'
                disabled={busy || !identityId}
                onClick={() => void perform(() => refresh())}
              >
                <RefreshCw size={16} aria-hidden />
                刷新房间
              </button>
            )}
          </div>
        </header>
        {(error || session?.error) && (
          <p className='tm-room-feedback tm-room-feedback-error' role='alert'>
            {error || session?.error}
          </p>
        )}
        {feedback && (
          <p className='tm-room-feedback' role='status'>
            {feedback}
          </p>
        )}
        {!identityId ? (
          <div className='tm-room-directory-empty'>
            <Users aria-hidden />
            <h2>登录后和朋友一起看</h2>
            <Link
              className='tm-btn tm-btn-primary'
              href='/login?redirect=%2Fwatch-room'
            >
              登录
            </Link>
          </div>
        ) : roomId ? (
          <>
            <div className='tm-room-workspace'>
              <section className='tm-room-stage'>
                {playback.href ? (
                  <PlaybackSlot />
                ) : (
                  <div className='tm-room-empty-stage'>
                    <Film aria-hidden />
                    <h2>选一部想一起看的影片</h2>
                    <p>加入片单后，由有播放权限的成员开始。</p>
                  </div>
                )}
                <footer className='tm-room-stage-footer'>
                  <div>
                    <h2>{playback.metadata?.title || '还没有开始播放'}</h2>
                    <p>{state?.isPlaying ? '正在播放' : '已暂停或等待播放'}</p>
                  </div>
                  <button
                    type='button'
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await session?.follow(!snapshot?.following);
                      })
                    }
                  >
                    {snapshot?.following ? '自己看' : '回到一起看'}
                  </button>
                </footer>
              </section>
              <aside className='tm-room-side'>
                <h2>片单</h2>
                <div className='tm-room-queue'>
                  {media.length ? (
                    media.map((item) => (
                      <article key={item.id} className='tm-room-queue-item'>
                        <div className='tm-room-queue-copy'>
                          <h3>{item.name}</h3>
                        </div>
                        <button
                          className='tm-btn tm-btn-ghost'
                          type='button'
                          disabled={busy || !snapshot?.canControlPlayback}
                          onClick={() => void perform(() => play(item))}
                        >
                          {item.id === state?.playingMediaId
                            ? '正在观看'
                            : '播放影片'}
                        </button>
                      </article>
                    ))
                  ) : (
                    <p>片单还是空的，先加入想看的影片。</p>
                  )}
                </div>
              </aside>
            </div>
            <section className='tm-together-picker' aria-label='选择影片'>
              <h2>加入片单</h2>
              {playback.href && (
                <button
                  type='button'
                  className='tm-btn tm-btn-ghost'
                  disabled={busy}
                  onClick={() => void perform(() => add(playback.href!))}
                >
                  <Plus size={16} aria-hidden />
                  加入正在看的影片
                </button>
              )}
              <RoomFilmPicker
                busy={busy}
                onAdd={(href) => perform(() => add(href))}
                allowDirect={false}
              />
            </section>
          </>
        ) : (
          <>
            <div className='tm-together-forms'>
              <form
                className='tm-together-form'
                aria-label='创建房间'
                action='/api/together/rooms'
                method='post'
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(create);
                }}
              >
                <h2>创建房间</h2>
                <label htmlFor={formId + '-name'}>房间名称</label>
                <input
                  id={formId + '-name'}
                  name='name'
                  required
                  maxLength={100}
                  pattern='[^<>]+'
                  value={name}
                  aria-invalid={invalid.name}
                  onInvalid={() => setInvalid(previous => ({ ...previous, name: true }))}
                  onChange={(event) => { setName(event.target.value); if (event.target.validity.valid) setInvalid(previous => ({ ...previous, name: false })); }}
                />
                <label className='tm-room-checkbox'>
                  <input
                    type='checkbox'
                    name='isPublic'
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                  />
                  在公开目录展示
                </label>
                <button
                  className='tm-btn tm-btn-primary'
                  type='submit'
                  disabled={busy || session?.joining}
                >
                  创建房间
                </button>
              </form>
              <form
                className='tm-together-form'
                aria-label='加入房间'
                action='/watch-room'
                method='get'
                onSubmit={(event) => {
                  event.preventDefault();
                  void perform(() => join(invite.trim()));
                }}
              >
                <h2>加入房间</h2>
                <label htmlFor={formId + '-invite'}>房间号</label>
                <input
                  id={formId + '-invite'}
                  name='room'
                  required
                  pattern='room_[A-Za-z0-9]+'
                  maxLength={64}
                  autoCapitalize='none'
                  autoCorrect='off'
                  spellCheck={false}
                  value={invite}
                  aria-invalid={invalid.invite}
                  onInvalid={() => setInvalid(previous => ({ ...previous, invite: true }))}
                  onChange={(event) => { setInvite(event.target.value); if (event.target.validity.valid) setInvalid(previous => ({ ...previous, invite: false })); }}
                />
                <button
                  className='tm-btn tm-btn-primary'
                  type='submit'
                  disabled={busy || session?.joining}
                >
                  进入房间
                </button>
              </form>
            </div>
            <section aria-labelledby={formId + '-directory'}>
              <div className='tm-room-directory-toolbar'>
                <h2 id={formId + '-directory'}>房间目录</h2>
                <div>
                  <button
                    type='button'
                    aria-pressed={directory === 'mine'}
                    onClick={() => setDirectory('mine')}
                  >
                    我的房间
                  </button>
                  <button
                    type='button'
                    aria-pressed={directory === 'public'}
                    onClick={() => setDirectory('public')}
                  >
                    公开房间
                  </button>
                </div>
              </div>
              <div className='tm-room-directory'>
                {rooms.map((item) => (
                  <article key={item.id} className='tm-room-card'>
                    <div className='tm-room-card-art'>
                      <span className='tm-room-card-glyph'>
                        <Film aria-hidden />
                      </span>
                    </div>
                    <div className='tm-room-card-body'>
                      <h3>{item.name}</h3>
                      <p>
                        {item.memberCount || 0} 人 ·{' '}
                        {item.description || '一起选片和观看'}
                      </p>
                    </div>
                    <button
                      type='button'
                      className='tm-room-card-action'
                      disabled={busy}
                      onClick={() => void perform(() => join(item.id))}
                    >
                      进入房间
                    </button>
                  </article>
                ))}
              </div>
              {!rooms.length && (
                <p className='tm-room-directory-empty'>
                  这里还没有房间，可以创建一个或使用邀请进入。
                </p>
              )}
            </section>
          </>
        )}
      </PageContainer>
    </PageLayout>
  );
}
