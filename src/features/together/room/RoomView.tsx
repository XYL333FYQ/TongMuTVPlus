'use client';

/*
 * 房间页（直播式）：
 * 手机和平板竖屏：顶部房间栏（返回、房间名、在线、麦克风、“更多”）→ 画面 → 正在放映一行
 *   （片单、成员、房间活动、选片）→ 今晚看什么一排片名 → 剩下整块是聊天，输入框在最底下。
 *   片单、成员、活动、完整推荐都从底部拉起面板，画面一直在上面。
 * 电脑和平板横屏：左边大画面 + 正在放映 + 选集条 + 今晚看什么；右边一整列聊天。
 *   片单、成员从右侧滑出。
 */

import {
  ArrowLeft,
  Check,
  Clapperboard,
  Copy,
  Ellipsis,
  Hash,
  Headphones,
  Link2,
  ListVideo,
  Lock,
  LogOut,
  MessageSquare,
  MessageSquareText,
  Mic,
  MicOff,
  MonitorUp,
  Plus,
  Settings,
  Users,
  VolumeOff,
} from 'lucide-react';
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { processImageUrl } from '@/lib/utils';

import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import DanmakuSheet from './DanmakuSheet';
import FilmPicker from './FilmPicker';
import MembersPanel from './MembersPanel';
import PlaylistPanel from './PlaylistPanel';
import Recommendations from './Recommendations';
import {
  ActivityLaunchers,
  activityOf,
  ActivityPanel,
  ActivityStage,
} from './RoomActivities';
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

type Panel =
  | 'playlist'
  | 'members'
  | 'activities'
  | 'recs'
  | 'danmaku'
  | 'menu';

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
  // 平板横屏和电脑（wide）用电脑排版；手机、手机横屏、平板竖屏用紧凑排版。见 lib/device-tier.ts
  const compact = useDeviceTier() !== 'wide';
  const [panel, setPanel] = useState<Panel | null>(null);
  const [picker, setPicker] = useState<{ query?: string } | null>(null);
  const [settings, setSettings] = useState(false);
  const [invite, setInvite] = useState(false);
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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

  const state =
    current.currentState?.type === 'play'
      ? (current.currentState as PlayState)
      : null;
  const onlineMembers = useMemo(
    () => (current.roster || []).filter((member) => member.online),
    [current.roster]
  );
  const online = onlineMembers.length || current.memberCount;
  const waiting = (current.queue || []).filter((item) => !item.playedAt).length;
  const requests = current.joinRequests?.length || 0;

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
  const openPicker = (query?: string) => {
    setPanel(null);
    setPicker(query ? { query } : {});
  };

  // 没有“语音发言”权限时麦克风是灰的，告诉成员要房主开
  const micButton = voice.available && (
    <button
      type='button'
      className='tm-t-icon'
      data-active={voice.mic ? 'true' : undefined}
      onClick={voice.toggleMic}
      disabled={voice.connecting || !voice.canSpeak}
      aria-label={
        !voice.canSpeak
          ? '麦克风：房主还没给你开语音发言'
          : voice.mic
          ? '关闭麦克风'
          : '开启麦克风'
      }
      title={
        !voice.canSpeak
          ? '房主还没给你开语音发言'
          : voice.error || (voice.mic ? '关闭麦克风' : '开启麦克风')
      }
    >
      {voice.mic ? <Mic size={18} /> : <MicOff size={18} />}
    </button>
  );
  const speakerButton = voice.available && (
    <button
      type='button'
      className='tm-t-icon'
      data-active={voice.speaker ? undefined : 'off'}
      onClick={voice.toggleSpeaker}
      aria-label={voice.speaker ? '听不到别人说话' : '听别人说话'}
      title={voice.speaker ? '关闭语音声音' : '打开语音声音'}
    >
      {voice.speaker ? <Headphones size={18} /> : <VolumeOff size={18} />}
    </button>
  );

  const playlist = (
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
        if (film) void act(() => playFilm(film, item.episode || 1, item.id));
      }}
      onRemove={(item) =>
        void act(() => command('queue:remove', { id: item.id }))
      }
      onMove={(item, position) =>
        void act(() => command('queue:move', { id: item.id, position }))
      }
      onClearPlayed={() => void act(() => command('queue:clear-played'))}
      onAdd={() => openPicker()}
      onStop={() => void act(() => command('state:clear'))}
    />
  );

  return (
    <div
      className='tm-t-room tm-tc'
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

      <header className='tm-t-head tm-tc-head'>
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
              {room.isConnected
                ? online > 1
                  ? `${online} 人在线`
                  : '只有你在'
                : '正在重新连接…'}
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
              onClick={() => setPanel('members')}
              aria-label={`在线成员：${onlineMembers
                .map((member) => member.accountId)
                .join('、')}`}
            >
              {onlineMembers.slice(0, compact ? 3 : 4).map((member) => (
                <span
                  key={member.accountId}
                  className='tm-t-face'
                  data-self={member.accountId === self ? 'true' : undefined}
                  title={member.accountId}
                >
                  {member.accountId.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {onlineMembers.length > (compact ? 3 : 4) && (
                <span className='tm-t-face tm-t-face-more'>
                  +{onlineMembers.length - (compact ? 3 : 4)}
                </span>
              )}
            </button>
          )}
          {compact ? (
            <>
              {micButton}
              <button
                type='button'
                className='tm-t-icon'
                onClick={() => setPanel('menu')}
                aria-label='更多'
                title='更多'
              >
                <Ellipsis size={20} />
              </button>
            </>
          ) : (
            <>
              {voice.available && (
                <div className='tm-t-voice' role='group' aria-label='语音'>
                  {micButton}
                  {speakerButton}
                </div>
              )}
              <button
                type='button'
                className='tm-t-icon'
                onClick={() => setPanel('danmaku')}
                aria-label='弹幕'
                title='弹幕：弹幕源和房间弹幕'
              >
                <MessageSquareText size={20} />
              </button>
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
            </>
          )}
        </div>
      </header>

      <div className='tm-tc-body'>
        <div className='tm-tc-main'>
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
                {!can('changeMedia') && <span>房主选片后会自动开始</span>}
                {can('changeMedia') && (
                  <button
                    type='button'
                    className='tm-t-btn tm-t-btn-on-art'
                    onClick={() => openPicker()}
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
                    onClick={() => openPicker()}
                  >
                    换一部
                  </button>
                )}
              </div>
            )}
          </div>

          {!compact && (
            <div className='tm-tc-tools'>
              <button
                type='button'
                className='tm-t-pill tm-tc-count'
                onClick={() => setPanel('playlist')}
              >
                <ListVideo size={16} aria-hidden='true' />
                片单
                {waiting > 0 && <span className='tm-tc-num'>{waiting}</span>}
              </button>
              <button
                type='button'
                className='tm-t-pill tm-tc-count'
                onClick={() => setPanel('members')}
              >
                <Users size={16} aria-hidden='true' />
                成员
                {requests > 0 && (
                  <span className='tm-tc-num' data-alert='true'>
                    {requests}
                  </span>
                )}
              </button>
              {can('changeMedia') && <ActivityLaunchers />}
            </div>
          )}

          {/* 电脑上正在放映和选集是同一张卡；手机平板上这层不占位 */}
          <div className='tm-tc-nowcard'>
            <section className='tm-t-now tm-tc-now' aria-label='正在放映'>
              <span className='tm-t-now-poster'>
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={processImageUrl(poster)}
                    alt=''
                    referrerPolicy='no-referrer'
                  />
                ) : (
                  <Clapperboard size={20} aria-hidden='true' />
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
                  {state && total > 1 && (
                    <span className='tm-tc-ep'>
                      {' '}
                      · 第 {player.episodeIndex + 1} 集
                    </span>
                  )}
                </h2>
                <span className='tm-t-now-meta'>
                  {state
                    ? [
                        total > 1
                          ? detail?.episodes_titles?.[player.episodeIndex] ||
                            `第 ${player.episodeIndex + 1} 集`
                          : '',
                        detail?.source_name,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : can('changeMedia')
                    ? '选一部开始放映'
                    : '房主选片后自动开始'}
                </span>
              </div>
              <div className='tm-t-now-actions'>
                {compact && (
                  <>
                    <button
                      type='button'
                      className='tm-t-icon tm-tc-count'
                      onClick={() => setPanel('playlist')}
                      aria-label={`片单和选集${
                        waiting ? `，待看 ${waiting} 部` : ''
                      }`}
                      title='片单和选集'
                    >
                      <ListVideo size={19} />
                      {waiting > 0 && (
                        <span className='tm-tc-num'>{waiting}</span>
                      )}
                    </button>
                    <button
                      type='button'
                      className='tm-t-icon tm-tc-count'
                      onClick={() => setPanel('members')}
                      aria-label={`成员${
                        requests ? `，${requests} 人申请加入` : ''
                      }`}
                      title='成员'
                    >
                      <Users size={19} />
                      {requests > 0 && (
                        <span className='tm-tc-num' data-alert='true'>
                          {requests}
                        </span>
                      )}
                    </button>
                    {/* 所有人都能打开：看正在进行的活动；没有权限的人在面板里看到原因 */}
                    <button
                      type='button'
                      className='tm-t-icon'
                      onClick={() => setPanel('activities')}
                      aria-label='房间活动：共享屏幕、一起听、电视直播'
                      title='房间活动'
                    >
                      <MonitorUp size={19} />
                    </button>
                  </>
                )}
                {canPick && (
                  <button
                    type='button'
                    className='tm-t-btn tm-t-btn-primary'
                    onClick={() => openPicker()}
                  >
                    <Plus size={16} />
                    {can('changeMedia') ? '选片' : '加入片单'}
                  </button>
                )}
              </div>
            </section>

            {state && total > 1 && (
              <nav className='tm-t-strip tm-tc-strip' aria-label='选集'>
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
          </div>

          {canPick &&
            (compact ? (
              <Recommendations
                variant='strip'
                onChoose={(title) => openPicker(title)}
                onMore={() => setPanel('recs')}
              />
            ) : (
              <Recommendations onChoose={(title) => openPicker(title)} />
            ))}

          {error && (
            <p className='tm-t-error' role='alert'>
              {error}
            </p>
          )}
        </div>

        <aside className='tm-tc-chat' aria-label='聊天'>
          <div className='tm-tc-chat-head'>
            <MessageSquare size={16} aria-hidden='true' />
            <h2>聊天</h2>
            <span className='tm-t-count'>{room.chatMessages.length}</span>
          </div>
          <RoomChat />
        </aside>
      </div>

      {panel === 'playlist' && (
        <Dialog title='片单' onClose={() => setPanel(null)} sheet>
          <div className='tm-tc-panel'>{playlist}</div>
        </Dialog>
      )}
      {panel === 'members' && (
        <Dialog title='成员' onClose={() => setPanel(null)} sheet>
          <div className='tm-tc-panel'>
            <MembersPanel
              room={current}
              self={self}
              canManage={can('manageMembers')}
              isOwner={isOwner}
              command={command}
            />
          </div>
        </Dialog>
      )}
      {panel === 'activities' && (
        <Dialog title='房间活动' onClose={() => setPanel(null)} sheet>
          <div className='tm-tc-panel'>
            <ActivityPanel room={current} canStart={can('changeMedia')} />
          </div>
        </Dialog>
      )}
      {panel === 'recs' && (
        <Dialog title='今晚看什么' onClose={() => setPanel(null)} sheet>
          <div className='tm-tc-panel tm-tc-pad'>
            <Recommendations onChoose={(title) => openPicker(title)} />
          </div>
        </Dialog>
      )}
      {panel === 'danmaku' && (
        <Dialog title='弹幕' onClose={() => setPanel(null)} sheet>
          <div className='tm-tc-panel'>
            <DanmakuSheet
              controller={player.danmaku}
              chat={player.chat}
              title={state?.videoName || detail?.title || ''}
              episodeIndex={player.episodeIndex}
              roomDanmaku={session.danmakuChat}
              onRoomDanmaku={session.setDanmakuChat}
            />
          </div>
        </Dialog>
      )}
      {panel === 'menu' && (
        <Dialog
          title={displayRoomName(current)}
          onClose={() => setPanel(null)}
          sheet
        >
          <div className='tm-tc-panel tm-tc-menu'>
            <button
              type='button'
              onClick={() => {
                setPanel(null);
                setInvite(true);
              }}
            >
              <Link2 size={18} />
              邀请朋友
            </button>
            <button type='button' onClick={() => setPanel('danmaku')}>
              <MessageSquareText size={18} />
              弹幕（弹幕源和房间弹幕）
            </button>
            {can('editRoom') && (
              <button
                type='button'
                onClick={() => {
                  setPanel(null);
                  setSettings(true);
                }}
              >
                <Settings size={18} />
                房间设置
              </button>
            )}
            {voice.available && (
              <button type='button' onClick={voice.toggleSpeaker}>
                {voice.speaker ? (
                  <Headphones size={18} />
                ) : (
                  <VolumeOff size={18} />
                )}
                {voice.speaker ? '关闭语音声音' : '打开语音声音'}
              </button>
            )}
            <button type='button' onClick={() => void copy(current.id, 'menu')}>
              {copied === 'menu' ? <Check size={18} /> : <Copy size={18} />}
              {copied === 'menu' ? '房间号已复制' : '复制房间号'}
            </button>
            <button
              type='button'
              data-danger='true'
              onClick={() => {
                setPanel(null);
                onLeave();
              }}
            >
              <LogOut size={18} />
              退出房间
            </button>
          </div>
        </Dialog>
      )}

      {picker && (
        <FilmPicker
          initialQuery={picker.query}
          canPlay={can('changeMedia')}
          canQueue={can('addMedia')}
          onClose={() => setPicker(null)}
          onPlay={(film) => playFilm(film).then(() => undefined)}
          onQueue={(film) =>
            command('queue:add', queueAdd(film)).then(() =>
              setPanel('playlist')
            )
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
