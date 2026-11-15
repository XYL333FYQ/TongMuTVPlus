'use client';

/*
 * 房间页（参照 SyncTV 的经典布局）：
 * 顶栏（房间名、在线、邀请、设置、退出）；左边播放器 + 正在放映；右边「聊天 | 片单 | 成员」。
 * 手机上播放器在顶，标签在下。离开这个页面播放器就销毁，不做小窗。
 */

import {
  ArrowLeft,
  Check,
  Clapperboard,
  Copy,
  Link2,
  ListVideo,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import ChatPanel from './ChatPanel';
import { ActivityLaunchers, activityOf, ActivityStage } from './RoomActivities';
import FilmPicker from './FilmPicker';
import MembersPanel from './MembersPanel';
import PlaylistPanel from './PlaylistPanel';
import RoomForm, { Dialog, valuesFromRoom } from './RoomForm';
import {
  filmFromQueue,
  filmFromState,
  FilmRef,
  playChange,
  queueAdd,
} from '../commands';
import { displayRoomName, maskedRoomId } from '../lib/room-presentation';
import { useRoomPlayer } from '../player/useRoomPlayer';

import type { PlayState, RoomPermission } from '@/types/watch-room';

type Tab = 'chat' | 'playlist' | 'members';
const DANMAKU_KEY = 'tm-together-chat-danmaku';

export default function RoomView({
  onLeave,
  onBack,
}: {
  onLeave(): void;
  onBack(): void;
}) {
  const room = useWatchRoomContext();
  const current = room.currentRoom!;
  const self = getAuthInfoFromBrowserCookie()?.username || '';
  const can = useCallback(
    (permission: RoomPermission) =>
      !!current.myPermissions?.includes(permission),
    [current.myPermissions]
  );
  const isOwner = current.myRole === 'owner';
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<Tab>('chat');
  const [picker, setPicker] = useState(false);
  const [settings, setSettings] = useState(false);
  const [invite, setInvite] = useState(false);
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [danmakuChat, setDanmakuChat] = useState(true);
  const [seenMessages, setSeenMessages] = useState(room.chatMessages.length);

  useEffect(() => {
    try {
      setDanmakuChat(localStorage.getItem(DANMAKU_KEY) !== 'false');
    } catch {
      // 忽略
    }
  }, []);

  const command = useCallback(
    async (event: string, payload: Record<string, unknown> = {}) =>
      room.roomCommand(event, { ...payload, roomId: current.id }),
    [room, current.id]
  );

  const player = useRoomPlayer({
    container: stage,
    room: current,
    connected: room.isConnected,
    canPlayback: can('playback'),
    commands: { roomCommand: command },
  });

  // 别人发的聊天飘成弹幕
  const { shoot } = player;
  useEffect(
    () =>
      room.subscribeToRoomMessages(({ message }) => {
        if (danmakuChat && message.content)
          shoot(
            message.content,
            (message.accountId || message.userName) === self
          );
      }),
    [room, danmakuChat, shoot, self]
  );

  useEffect(() => {
    if (tab === 'chat') setSeenMessages(room.chatMessages.length);
  }, [tab, room.chatMessages.length]);
  const unread =
    tab === 'chat' ? 0 : Math.max(0, room.chatMessages.length - seenMessages);

  const state =
    current.currentState?.type === 'play'
      ? (current.currentState as PlayState)
      : null;
  const online = useMemo(
    () =>
      (current.roster || []).filter((member) => member.online).length ||
      current.memberCount,
    [current]
  );

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await run();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作没有完成');
    } finally {
      setBusy(false);
    }
  };

  const playFilm = (film: FilmRef, episode = 1, queueItemId?: string) =>
    command(
      'play:change',
      playChange(film, episode, queueItemId) as unknown as Record<
        string,
        unknown
      >
    );

  const inviteUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/watch-room?room=${encodeURIComponent(
          current.id
        )}`;
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError('复制失败，请手动复制');
    }
  };

  const detail = player.detail;
  const multi = (detail?.episodes?.length || 0) > 1;

  return (
    <div className='tm-t-room'>
      <header className='tm-t-bar'>
        <button
          type='button'
          className='tm-t-icon'
          onClick={onBack}
          aria-label='回到房间列表'
        >
          <ArrowLeft size={20} />
        </button>
        <div className='tm-t-bar-title'>
          <h1>{displayRoomName(current)}</h1>
          <span className='tm-t-bar-meta'>
            <span
              className='tm-t-dot'
              data-on={room.isConnected ? 'true' : undefined}
            />
            {room.isConnected ? `${online} 人在线` : '正在重新连接…'}
          </span>
        </div>
        <div className='tm-t-bar-actions'>
          <button
            type='button'
            className='tm-t-pill'
            onClick={() => setInvite(true)}
          >
            <Link2 size={16} />
            <span>邀请</span>
          </button>
          {can('editRoom') && (
            <button
              type='button'
              className='tm-t-icon'
              onClick={() => setSettings(true)}
              aria-label='房间设置'
            >
              <Settings size={20} />
            </button>
          )}
          <button
            type='button'
            className='tm-t-icon'
            onClick={onLeave}
            aria-label='退出房间'
            title='退出房间'
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className='tm-t-layout'>
        <div className='tm-t-main'>
          <div className='tm-t-stage'>
            <div
              ref={setStage}
              className='tm-t-stage-slot'
              data-hidden={state ? undefined : 'true'}
            />
            <ActivityStage room={current} />
            {!state && !activityOf(current) && (
              <div className='tm-t-stage-empty'>
                <Clapperboard size={36} aria-hidden='true' />
                <strong>还没开始放映</strong>
                <span>
                  {can('changeMedia')
                    ? '选一部片，房间里的人会同时开始看。'
                    : '等房主或管理员选片，开始后这里会自动播放。'}
                </span>
                {can('changeMedia') && (
                  <button
                    type='button'
                    className='tm-t-btn tm-t-btn-on-art'
                    onClick={() => setPicker(true)}
                  >
                    选片
                  </button>
                )}
              </div>
            )}
            {state && player.loading && !player.error && (
              <div className='tm-t-stage-status'>正在加载视频…</div>
            )}
            {state && player.error && (
              <div className='tm-t-stage-status' role='alert'>
                <strong>{player.error}</strong>
                {can('changeMedia') && (
                  <button
                    type='button'
                    className='tm-t-btn tm-t-btn-on-art'
                    onClick={() => setPicker(true)}
                  >
                    换一部
                  </button>
                )}
              </div>
            )}
          </div>

          <div className='tm-t-now'>
            <div className='tm-t-now-text'>
              <span className='tm-t-now-label'>
                {state
                  ? state.isPlaying
                    ? '正在放映'
                    : state.autoPaused
                    ? '等人缓冲'
                    : '已暂停'
                  : '空闲'}
              </span>
              <h2>
                {state ? state.videoName || detail?.title : '没有在放的影片'}
              </h2>
              {state && (
                <span className='tm-t-now-meta'>
                  {[
                    multi
                      ? detail?.episodes_titles?.[player.episodeIndex] ||
                        `第 ${player.episodeIndex + 1} 集`
                      : '',
                    detail?.source_name,
                    state.updatedBy ? `${state.updatedBy} 最后操作` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>
            {(can('changeMedia') || can('addMedia')) && (
              <button
                type='button'
                className='tm-t-btn tm-t-btn-primary'
                onClick={() => setPicker(true)}
              >
                <ListVideo size={18} />
                {can('changeMedia') ? '选片' : '加入片单'}
              </button>
            )}
          </div>
          {can('changeMedia') && <ActivityLaunchers />}
          {error && (
            <p className='tm-t-error' role='alert'>
              {error}
            </p>
          )}
        </div>

        <aside className='tm-t-side'>
          <div className='tm-t-tabs' role='tablist'>
            {(
              [
                ['chat', '聊天', MessageSquare],
                ['playlist', '片单', ListVideo],
                ['members', '成员', Users],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type='button'
                role='tab'
                aria-selected={tab === id}
                className='tm-t-tab'
                onClick={() => setTab(id)}
              >
                <Icon size={16} aria-hidden='true' />
                {label}
                {id === 'chat' && unread > 0 && (
                  <span className='tm-t-badge'>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                {id === 'members' &&
                  (current.joinRequests?.length || 0) > 0 && (
                    <span className='tm-t-badge'>
                      {current.joinRequests?.length}
                    </span>
                  )}
              </button>
            ))}
          </div>
          <div
            className='tm-t-side-body'
            style={{ '--tm-t-tab': tab } as CSSProperties}
          >
            {tab === 'chat' && (
              <ChatPanel
                messages={room.chatMessages}
                self={self}
                canChat={
                  can('chat') && current.settings?.chatEnabled !== false
                    ? true
                    : can('manageMembers')
                }
                canModerate={can('manageMembers')}
                danmaku={danmakuChat}
                onDanmakuChange={(on) => {
                  setDanmakuChat(on);
                  try {
                    localStorage.setItem(DANMAKU_KEY, String(on));
                  } catch {
                    // 忽略
                  }
                }}
                onSend={async (text) => {
                  await room.sendChatMessage(text);
                }}
                onDelete={(id) =>
                  void room
                    .deleteChatMessage(id)
                    .catch(() => setError('删除失败'))
                }
                onLoadOlder={() =>
                  room.loadChatHistory(undefined, room.chatMessages[0]?.seq)
                }
                onRead={(seq) =>
                  void room.markChatRead(seq).catch(() => undefined)
                }
              />
            )}
            {tab === 'playlist' && (
              <PlaylistPanel
                detail={state ? detail : null}
                episodeIndex={player.episodeIndex}
                playing={!!state}
                queue={current.queue || []}
                self={self}
                canChangeMedia={can('changeMedia')}
                canAdd={can('addMedia')}
                canManage={can('managePlaylist')}
                onEpisode={(index) =>
                  state &&
                  void act(() =>
                    playFilm(filmFromState(state), index + 1, state.queueItemId)
                  )
                }
                onPlayItem={(item) => {
                  const film = filmFromQueue(item);
                  if (film)
                    void act(() => playFilm(film, item.episode || 1, item.id));
                }}
                onRemove={(item) =>
                  void act(() => command('queue:remove', { id: item.id }))
                }
                onMove={(item, position) =>
                  void act(() =>
                    command('queue:move', { id: item.id, position })
                  )
                }
                onClearPlayed={() =>
                  void act(() => command('queue:clear-played'))
                }
                onAdd={() => setPicker(true)}
                onStop={() => void act(() => command('state:clear'))}
              />
            )}
            {tab === 'members' && (
              <MembersPanel
                room={current}
                self={self}
                canManage={can('manageMembers')}
                isOwner={isOwner}
                command={command}
              />
            )}
          </div>
        </aside>
      </div>

      {picker && (
        <FilmPicker
          canPlay={can('changeMedia')}
          canQueue={can('addMedia')}
          onClose={() => setPicker(false)}
          onPlay={(film) => playFilm(film).then(() => undefined)}
          onQueue={(film) =>
            command('queue:add', queueAdd(film)).then(() => setTab('playlist'))
          }
        />
      )}

      {invite && (
        <Dialog title='邀请朋友' onClose={() => setInvite(false)}>
          <div className='tm-t-form'>
            <p className='tm-t-lead'>
              把链接发给朋友，登录后打开就能进来
              {current.hasPassword ? '（还需要输入密码）' : ''}。
            </p>
            <div className='tm-t-copy'>
              <code>{inviteUrl}</code>
              <button
                type='button'
                className='tm-t-btn tm-t-btn-primary'
                onClick={() => void copy(inviteUrl, 'link')}
              >
                {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'link' ? '已复制' : '复制链接'}
              </button>
            </div>
            <div className='tm-t-copy'>
              <code>房间号 {maskedRoomId(current.id)}</code>
              <button
                type='button'
                className='tm-t-btn'
                onClick={() => void copy(current.id, 'id')}
              >
                {copied === 'id' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'id' ? '已复制' : '复制房间号'}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {settings && (
        <Dialog title='房间设置' onClose={() => setSettings(false)} wide>
          <RoomForm
            mode='edit'
            room={current}
            initial={valuesFromRoom(current)}
            busy={busy}
            error={error}
            onCancel={() => setSettings(false)}
            onCover={(image) => act(() => command('room:cover', { image }))}
            onDelete={
              isOwner
                ? () => {
                    if (
                      window.confirm(
                        '删除后房间、片单和聊天记录都会清空，确定删除吗？'
                      )
                    )
                      void act(async () => {
                        await command('room:delete');
                        setSettings(false);
                        onLeave();
                      });
                  }
                : undefined
            }
            onSubmit={(values) =>
              void act(async () => {
                await command('room:settings', {
                  name: values.name,
                  description: values.description,
                  isPublic: values.isPublic,
                  ...(values.password !== undefined
                    ? { password: values.password }
                    : {}),
                  requireApproval: values.requireApproval,
                  maxMembers: values.maxMembers,
                  chatEnabled: values.chatEnabled,
                  waitForBuffering: values.waitForBuffering,
                  autoPlay: values.autoPlay,
                  memberPermissions: values.memberPermissions,
                });
                setSettings(false);
              })
            }
          />
        </Dialog>
      )}
    </div>
  );
}
