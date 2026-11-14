'use client';

/*
 * 房间页：
 * 顶部：房间名、在线、房间号、在线成员头像、语音、邀请、设置、退出；
 * 左：放映舞台（画面由一起看会话放进来，离开本页后转去小窗）+ 正在放映卡片 + 快速选集；
 * 右：聊天 / 片单 / 成员；
 * 下方：今晚看什么（热门推荐）。
 * 手机上舞台在顶，标签在下。
 */

import {
  ArrowLeft,
  Check,
  Clapperboard,
  Copy,
  Hash,
  Headphones,
  VolumeOff,
  Link2,
  ListVideo,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
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
import { processImageUrl } from '@/lib/utils';

import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import FilmPicker from './FilmPicker';
import MembersPanel from './MembersPanel';
import PlaylistPanel from './PlaylistPanel';
import Recommendations from './Recommendations';
import { ActivityLaunchers, activityOf, ActivityStage } from './RoomActivities';
import RoomChat from './RoomChat';
import RoomForm, { Dialog, valuesFromRoom } from './RoomForm';
import {
  filmFromQueue,
  filmFromState,
  FilmRef,
  playChange,
  queueAdd,
} from '../commands';
import {
  displayRoomName,
  episodeLabel,
  maskedRoomId,
} from '../lib/room-presentation';
import { useTogetherSession } from '../session/context';

import type { PlayState, RoomPermission } from '@/types/watch-room';

type Tab = 'chat' | 'playlist' | 'members';

export default function RoomView({
  onLeave,
  onBack,
  pick,
  onPickHandled,
}: {
  onLeave(): void;
  onBack(): void;
  /** 从站内其他地方带来的片名：打开选片并搜它 */
  pick?: string;
  onPickHandled?(): void;
}) {
  const room = useWatchRoomContext();
  const session = useTogetherSession();
  const current = room.currentRoom!;
  const self = getAuthInfoFromBrowserCookie()?.username || '';
  const can = useCallback(
    (permission: RoomPermission) =>
      !!current.myPermissions?.includes(permission),
    [current.myPermissions]
  );
  const isOwner = current.myRole === 'owner';
  const [tab, setTab] = useState<Tab>('chat');
  const [picker, setPicker] = useState<{ query?: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [invite, setInvite] = useState(false);
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seenMessages, setSeenMessages] = useState(room.chatMessages.length);
  const player = session.player;
  const voice = session.voice;

  useEffect(() => {
    if (!pick) return;
    setPicker({ query: pick });
    onPickHandled?.();
  }, [pick, onPickHandled]);

  const command = useCallback(
    async (event: string, payload: Record<string, unknown> = {}) =>
      room.roomCommand(event, { ...payload, roomId: current.id }),
    [room, current.id]
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
  const onlineMembers = useMemo(
    () => (current.roster || []).filter((member) => member.online),
    [current.roster]
  );
  const online = onlineMembers.length || current.memberCount;

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

  const detail = state ? player.detail : null;
  const total = detail?.episodes?.length || 0;
  const poster = state?.poster || detail?.poster || '';
  const canPick = can('changeMedia') || can('addMedia');
  const statusLabel = state
    ? state.isPlaying
      ? '正在放映'
      : state.autoPaused
      ? '等人缓冲'
      : '已暂停'
    : '空闲';

  return (
    <div
      className='tm-t-room'
      style={
        poster
          ? ({
              '--tm-t-ambient': `url("${processImageUrl(poster)}")`,
            } as CSSProperties)
          : undefined
      }
      data-ambient={poster ? 'true' : undefined}
    >
      <div className='tm-t-ambient' aria-hidden='true' />

      <header className='tm-t-head'>
        <button
          type='button'
          className='tm-t-icon tm-t-head-back'
          onClick={onBack}
          aria-label='回到房间列表'
          title='回到房间列表'
        >
          <ArrowLeft size={20} />
        </button>
        <div className='tm-t-head-title'>
          <h1>{displayRoomName(current)}</h1>
          <div className='tm-t-head-meta'>
            <span className='tm-t-chip'>
              <span
                className='tm-t-dot'
                data-on={room.isConnected ? 'true' : undefined}
              />
              {room.isConnected ? `${online} 人在线` : '正在重新连接…'}
            </span>
            <button
              type='button'
              className='tm-t-chip tm-t-chip-button'
              onClick={() => void copy(current.id, 'code')}
              title='复制房间号'
            >
              {copied === 'code' ? <Check size={13} /> : <Hash size={13} />}
              {copied === 'code' ? '已复制' : maskedRoomId(current.id)}
            </button>
            {current.hasPassword && (
              <span className='tm-t-chip'>
                <Lock size={13} />
                密码房
              </span>
            )}
          </div>
        </div>

        <div className='tm-t-head-actions'>
          {onlineMembers.length > 0 && (
            <button
              type='button'
              className='tm-t-faces'
              onClick={() => setTab('members')}
              aria-label={`在线成员：${onlineMembers
                .map((member) => member.accountId)
                .join('、')}`}
            >
              {onlineMembers.slice(0, 4).map((member) => (
                <span
                  key={member.accountId}
                  className='tm-t-face'
                  data-self={member.accountId === self ? 'true' : undefined}
                  title={member.accountId}
                >
                  {member.accountId.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {onlineMembers.length > 4 && (
                <span className='tm-t-face tm-t-face-more'>
                  +{onlineMembers.length - 4}
                </span>
              )}
            </button>
          )}
          {voice.available && (
            <div className='tm-t-voice' role='group' aria-label='语音'>
              <button
                type='button'
                className='tm-t-icon'
                data-active={voice.mic ? 'true' : undefined}
                onClick={voice.toggleMic}
                disabled={voice.connecting}
                aria-label={voice.mic ? '关闭麦克风' : '开启麦克风'}
                title={voice.error || (voice.mic ? '关闭麦克风' : '开启麦克风')}
              >
                {voice.mic ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button
                type='button'
                className='tm-t-icon'
                data-active={voice.speaker ? undefined : 'off'}
                onClick={voice.toggleSpeaker}
                aria-label={voice.speaker ? '听不到别人说话' : '听别人说话'}
                title={voice.speaker ? '关闭语音声音' : '打开语音声音'}
              >
                {voice.speaker ? (
                  <Headphones size={18} />
                ) : (
                  <VolumeOff size={18} />
                )}
              </button>
            </div>
          )}
          <button
            type='button'
            className='tm-t-btn tm-t-btn-primary'
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
              title='房间设置'
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
              ref={session.attachStage}
              className='tm-t-stage-slot'
              data-hidden={state ? undefined : 'true'}
            />
            <ActivityStage room={current} />
            {!state && !activityOf(current) && (
              <div className='tm-t-stage-empty'>
                <span className='tm-t-stage-icon'>
                  <Clapperboard size={30} aria-hidden='true' />
                </span>
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
                    onClick={() => setPicker({})}
                  >
                    <ListVideo size={18} />
                    选片
                  </button>
                )}
              </div>
            )}
            {state && player.loading && !player.error && (
              <div className='tm-t-stage-status'>
                <span className='tm-t-loader' aria-hidden='true' />
                正在准备画面…
              </div>
            )}
            {state && player.error && (
              <div className='tm-t-stage-status' role='alert'>
                <strong>{player.error}</strong>
                {can('changeMedia') && (
                  <button
                    type='button'
                    className='tm-t-btn tm-t-btn-on-art'
                    onClick={() => setPicker({})}
                  >
                    换一部
                  </button>
                )}
              </div>
            )}
          </div>

          <section className='tm-t-now' aria-label='正在放映'>
            <span className='tm-t-now-poster'>
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={processImageUrl(poster)}
                  alt=''
                  referrerPolicy='no-referrer'
                />
              ) : (
                <Clapperboard size={22} aria-hidden='true' />
              )}
            </span>
            <div className='tm-t-now-text'>
              <span
                className='tm-t-now-label'
                data-state={
                  state ? (state.isPlaying ? 'playing' : 'paused') : 'idle'
                }
              >
                {statusLabel}
              </span>
              <h2>
                {state ? state.videoName || detail?.title : '没有在放的影片'}
              </h2>
              <span className='tm-t-now-meta'>
                {state
                  ? [
                      total > 1
                        ? detail?.episodes_titles?.[player.episodeIndex] ||
                          `第 ${player.episodeIndex + 1} 集`
                        : '',
                      detail?.source_name,
                      state.updatedBy ? `${state.updatedBy} 最后操作` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : can('changeMedia')
                  ? '从下面的推荐里挑一部，或者自己搜'
                  : '房主选片后会自动开始'}
              </span>
            </div>
            <div className='tm-t-now-actions'>
              {can('changeMedia') && <ActivityLaunchers />}
              {canPick && (
                <button
                  type='button'
                  className='tm-t-btn tm-t-btn-primary'
                  onClick={() => setPicker({})}
                >
                  <ListVideo size={18} />
                  {can('changeMedia') ? '选片' : '加入片单'}
                </button>
              )}
            </div>
          </section>

          {state && total > 1 && (
            <nav className='tm-t-strip' aria-label='选集'>
              {Array.from({ length: total }, (_, index) => (
                <button
                  key={index}
                  type='button'
                  className='tm-t-ep'
                  aria-current={
                    index === player.episodeIndex ? 'true' : undefined
                  }
                  disabled={!can('changeMedia') || busy}
                  onClick={() =>
                    void act(() =>
                      playFilm(
                        filmFromState(state),
                        index + 1,
                        state.queueItemId
                      )
                    )
                  }
                  title={
                    detail?.episodes_titles?.[index] || `第 ${index + 1} 集`
                  }
                >
                  <span className='tm-t-ep-no'>
                    {episodeLabel(detail?.episodes_titles?.[index], index)}
                  </span>
                </button>
              ))}
            </nav>
          )}

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
                {id === 'playlist' &&
                  (current.queue || []).filter((item) => !item.playedAt)
                    .length > 0 && (
                    <span className='tm-t-count'>
                      {
                        (current.queue || []).filter((item) => !item.playedAt)
                          .length
                      }
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
          <div className='tm-t-side-body'>
            {tab === 'chat' && <RoomChat />}
            {tab === 'playlist' && (
              <PlaylistPanel
                detail={detail}
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
                onAdd={() => setPicker({})}
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

      {canPick && (
        <Recommendations onChoose={(title) => setPicker({ query: title })} />
      )}

      {picker && (
        <FilmPicker
          initialQuery={picker.query}
          canPlay={can('changeMedia')}
          canQueue={can('addMedia')}
          onClose={() => setPicker(null)}
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
