'use client';

/*
 * 房间页（直播式）：
 * 手机和平板竖屏：顶部房间栏（返回、房间名、在线、麦克风、“更多”）→ 画面 → 正在放映一行
 *   （片单、成员、房间活动、选片）→ 今晚看什么一排片名 → 剩下整块是聊天，输入框在最底下。
 *   片单、成员、活动、完整推荐都从底部拉起面板，画面一直在上面。
 * 电脑：左边大画面 + 正在放映 + 选集条 + 今晚看什么；右边一整列聊天。
 *   片单、成员从右侧滑出。
 * 平板（触屏，横竖都是；2026-11-18 设计稿方案 A）：不要站点顶栏，房间栏 → 画面（按屏幕高度收）
 *   + 正在放映 + 大号选集 + 今晚看什么；侧栏是“聊天 / 片单 / 成员 / 活动”四个标签。
 *   横屏左右两栏，竖屏上下排。
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

import './RoomView.css';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { isHandheld } from '@/lib/device-tier';
import { processImageUrl } from '@/lib/utils';
import { useDeviceTier, usePageLayout } from '@/hooks/useDeviceTier';
import { useImmersiveShell } from '@/hooks/useImmersiveShell';

import BusyDots from '@/components/feedback/BusyDots';
import FilmPoster from '@/components/poster/FilmPoster';
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
} from '../lib/commands';
import {
  displayRoomName,
  episodeLabel,
  maskedRoomId,
} from '../lib/room-presentation';
import { useRoomSession } from '../session/context';

import type { PlayState, Room, RoomPermission } from '@/types/watch-room';

type Panel =
  | 'playlist'
  | 'members'
  | 'activities'
  | 'recs'
  | 'danmaku'
  | 'menu';

type SideTab = 'chat' | 'playlist' | 'members' | 'activities';
const SIDE_TABS: SideTab[] = ['chat', 'playlist', 'members', 'activities'];

export default function RoomView({
  current,
  onLeave,
  onBack,
  pick,
  onPickHandled,
}: {
  /** 当前房间（RoomRoute 只在有房间时渲染这一页） */
  current: Room;
  onLeave(): void;
  onBack(): void;
  /** 从站内其他地方带来的片名：打开选片并搜它 */
  pick?: string;
  onPickHandled?(): void;
}) {
  const room = useWatchRoomContext();
  const session = useRoomSession();
  const self = getAuthInfoFromBrowserCookie()?.username || '';
  const can = useCallback(
    (permission: RoomPermission) =>
      !!current.myPermissions?.includes(permission),
    [current.myPermissions]
  );
  const isOwner = current.myRole === 'owner';
  // 三套排版（lib/device-tier.ts 的 pageLayoutFor）：手机 compact、平板 tablet、电脑 desktop
  const layout = usePageLayout();
  const handheld = isHandheld(useDeviceTier());
  // 手机和触屏平板整屏给房间；窄的电脑窗口留着站点顶栏，一屏装下；电脑上外壳照常，只去掉底部空白
  useImmersiveShell(
    layout === 'desktop'
      ? 'flush'
      : layout === 'tablet' || handheld
      ? 'bare'
      : 'fit'
  );
  const compact = layout === 'compact';
  const tablet = layout === 'tablet';
  const [panel, setPanel] = useState<Panel | null>(null);
  // 平板：片单、成员、活动是右侧栏里的标签页，和聊天并排，不再另开面板
  const [tab, setTab] = useState<SideTab>('chat');
  const openPanel = (next: Panel) => {
    if (tablet && (SIDE_TABS as string[]).includes(next)) {
      setPanel(null);
      setTab(next as SideTab);
    } else setPanel(next);
  };
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
      className='tm-room-icon'
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
      className='tm-room-icon'
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
      className='tm-room-view'
      style={
        poster
          ? ({
              '--tm-room-view-ambient': `url("${processImageUrl(poster)}")`,
            } as CSSProperties)
          : undefined
      }
      data-ambient={poster ? 'true' : undefined}
      data-layout={layout}
    >
      <div className='tm-room-view-ambient' aria-hidden='true' />

      <header className='tm-room-head tm-room-view-head'>
        <button
          type='button'
          className='tm-room-icon tm-room-head-back'
          onClick={onBack}
          aria-label='回到房间列表'
          title='回到房间列表'
        >
          <ArrowLeft size={20} />
        </button>
        <div className='tm-room-head-title'>
          <h1>{displayRoomName(current)}</h1>
          <div className='tm-room-head-meta'>
            <span className='tm-room-chip'>
              <span
                className='tm-room-dot'
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
              className='tm-room-chip tm-room-view-chip-button'
              onClick={() => void copy(current.id, 'code')}
              title='复制房间号'
            >
              {copied === 'code' ? <Check size={13} /> : <Hash size={13} />}
              {copied === 'code' ? '已复制' : maskedRoomId(current.id)}
            </button>
            {current.hasPassword && (
              <span className='tm-room-chip'>
                <Lock size={13} />
                密码房
              </span>
            )}
          </div>
        </div>

        <div className='tm-room-head-actions'>
          {onlineMembers.length > 0 && (
            <button
              type='button'
              className='tm-room-view-faces'
              onClick={() => openPanel('members')}
              aria-label={`在线成员：${onlineMembers
                .map((member) => member.accountId)
                .join('、')}`}
            >
              {onlineMembers.slice(0, compact ? 3 : 4).map((member) => (
                <span
                  key={member.accountId}
                  className='tm-room-view-face'
                  data-self={member.accountId === self ? 'true' : undefined}
                  title={member.accountId}
                >
                  {member.accountId.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {onlineMembers.length > (compact ? 3 : 4) && (
                <span className='tm-room-view-face tm-room-view-face-more'>
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
                className='tm-room-icon'
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
                <div
                  className='tm-room-view-voice'
                  role='group'
                  aria-label='语音'
                >
                  {micButton}
                  {speakerButton}
                </div>
              )}
              <button
                type='button'
                className='tm-room-icon'
                onClick={() => setPanel('danmaku')}
                aria-label='弹幕'
                title='弹幕：弹幕源和房间弹幕'
              >
                <MessageSquareText size={20} />
              </button>
              <button
                type='button'
                className='tm-room-btn tm-room-btn-primary'
                onClick={() => setInvite(true)}
              >
                <Link2 size={16} />
                <span>邀请</span>
              </button>
              {can('editRoom') && (
                <button
                  type='button'
                  className='tm-room-icon'
                  onClick={() => setSettings(true)}
                  aria-label='房间设置'
                  title='房间设置'
                >
                  <Settings size={20} />
                </button>
              )}
              <button
                type='button'
                className='tm-room-icon'
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

      <div className='tm-room-view-body'>
        <div className='tm-room-view-main'>
          <div className='tm-room-view-stage'>
            <div
              ref={session.attachStage}
              className='tm-room-view-stage-slot'
              data-hidden={state ? undefined : 'true'}
            />
            <ActivityStage room={current} />
            {!state && !activityOf(current) && (
              <div className='tm-room-stage-empty'>
                <span className='tm-room-stage-icon'>
                  <Clapperboard size={30} aria-hidden='true' />
                </span>
                <strong>还没开始放映</strong>
                {!can('changeMedia') && <span>房主选片后会自动开始</span>}
                {can('changeMedia') && (
                  <button
                    type='button'
                    className='tm-room-btn tm-room-btn-on-art'
                    onClick={() => openPicker()}
                  >
                    <ListVideo size={18} />
                    选片
                  </button>
                )}
              </div>
            )}
            {state && player.loading && !player.error && (
              <div className='tm-room-view-stage-status'>
                <BusyDots size={28} />
                正在准备画面…
              </div>
            )}
            {state && player.error && (
              <div className='tm-room-view-stage-status' role='alert'>
                <strong>{player.error}</strong>
                {can('changeMedia') && (
                  <button
                    type='button'
                    className='tm-room-btn tm-room-btn-on-art'
                    onClick={() => openPicker()}
                  >
                    换一部
                  </button>
                )}
              </div>
            )}
          </div>

          {layout === 'desktop' && (
            <div className='tm-room-view-tools'>
              <button
                type='button'
                className='tm-room-pill tm-room-view-badge'
                onClick={() => setPanel('playlist')}
              >
                <ListVideo size={16} aria-hidden='true' />
                片单
                {waiting > 0 && (
                  <span className='tm-room-view-num'>{waiting}</span>
                )}
              </button>
              <button
                type='button'
                className='tm-room-pill tm-room-view-badge'
                onClick={() => setPanel('members')}
              >
                <Users size={16} aria-hidden='true' />
                成员
                {requests > 0 && (
                  <span className='tm-room-view-num' data-alert='true'>
                    {requests}
                  </span>
                )}
              </button>
              {can('changeMedia') && <ActivityLaunchers />}
            </div>
          )}

          {/* 电脑上正在放映和选集是同一张卡；手机平板上这层不占位 */}
          <div className='tm-room-view-nowcard'>
            <section className='tm-room-view-now' aria-label='正在放映'>
              <FilmPoster
                src={poster}
                title={state?.videoName || detail?.title}
                eager
                className='tm-room-view-now-poster'
              />
              <div className='tm-room-view-now-text'>
                <span
                  className='tm-room-view-now-label'
                  data-state={
                    state ? (state.isPlaying ? 'playing' : 'paused') : 'idle'
                  }
                >
                  {statusLabel}
                </span>
                <h2>
                  {state ? state.videoName || detail?.title : '没有在放的影片'}
                  {state && total > 1 && (
                    <span className='tm-room-view-now-episode'>
                      {' '}
                      · 第 {player.episodeIndex + 1} 集
                    </span>
                  )}
                </h2>
                <span className='tm-room-view-now-meta'>
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
              <div className='tm-room-view-now-actions'>
                {compact && (
                  <>
                    <button
                      type='button'
                      className='tm-room-icon tm-room-view-badge'
                      onClick={() => setPanel('playlist')}
                      aria-label={`片单和选集${
                        waiting ? `，待看 ${waiting} 部` : ''
                      }`}
                      title='片单和选集'
                    >
                      <ListVideo size={19} />
                      {waiting > 0 && (
                        <span className='tm-room-view-num'>{waiting}</span>
                      )}
                    </button>
                    <button
                      type='button'
                      className='tm-room-icon tm-room-view-badge'
                      onClick={() => setPanel('members')}
                      aria-label={`成员${
                        requests ? `，${requests} 人申请加入` : ''
                      }`}
                      title='成员'
                    >
                      <Users size={19} />
                      {requests > 0 && (
                        <span className='tm-room-view-num' data-alert='true'>
                          {requests}
                        </span>
                      )}
                    </button>
                    {/* 所有人都能打开：看正在进行的活动；没有权限的人在面板里看到原因 */}
                    <button
                      type='button'
                      className='tm-room-icon'
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
                    className='tm-room-btn tm-room-btn-primary'
                    onClick={() => openPicker()}
                  >
                    <Plus size={16} />
                    {can('changeMedia') ? '选片' : '加入片单'}
                  </button>
                )}
              </div>
            </section>

            {state && total > 1 && (
              <nav className='tm-room-view-strip' aria-label='选集'>
                {Array.from({ length: total }, (_, index) => (
                  <button
                    key={index}
                    type='button'
                    className='tm-room-view-ep'
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
                    <span className='tm-room-view-ep-no'>
                      {episodeLabel(detail?.episodes_titles?.[index], index)}
                    </span>
                  </button>
                ))}
              </nav>
            )}
          </div>

          {canPick &&
            (layout !== 'desktop' ? (
              <Recommendations
                variant='strip'
                onChoose={(title) => openPicker(title)}
                onMore={() => setPanel('recs')}
              />
            ) : (
              <Recommendations onChoose={(title) => openPicker(title)} />
            ))}

          {error && (
            <p className='tm-room-error' role='alert'>
              {error}
            </p>
          )}
        </div>

        <aside
          className='tm-room-view-chat'
          aria-label={tablet ? '房间侧栏' : '聊天'}
          data-tab={tablet ? tab : undefined}
        >
          {tablet ? (
            <SideTabs
              tab={tab}
              onTab={setTab}
              counts={{ playlist: waiting, members: online }}
              alert={{ members: requests > 0 }}
            />
          ) : (
            <div className='tm-room-view-chat-head'>
              <MessageSquare size={16} aria-hidden='true' />
              <h2>聊天</h2>
              <span className='tm-room-view-chat-count'>
                {room.chatMessages.length}
              </span>
            </div>
          )}
          {/* 聊天一直挂着（切到别的标签只是藏起来），输入到一半、滚动位置都不丢 */}
          <RoomChat />
          {tablet && tab === 'playlist' && (
            <div
              className='tm-room-view-tabpanel'
              role='tabpanel'
              id='tm-room-view-tab-playlist'
            >
              {playlist}
            </div>
          )}
          {tablet && tab === 'members' && (
            <div
              className='tm-room-view-tabpanel'
              role='tabpanel'
              id='tm-room-view-tab-members'
            >
              <MembersPanel
                room={current}
                self={self}
                canManage={can('manageMembers')}
                isOwner={isOwner}
                command={command}
              />
            </div>
          )}
          {tablet && tab === 'activities' && (
            <div
              className='tm-room-view-tabpanel'
              role='tabpanel'
              id='tm-room-view-tab-activities'
            >
              <ActivityPanel room={current} canStart={can('changeMedia')} />
            </div>
          )}
        </aside>
      </div>

      {panel === 'playlist' && (
        <Dialog title='片单' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>{playlist}</div>
        </Dialog>
      )}
      {panel === 'members' && (
        <Dialog title='成员' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>
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
          <div className='tm-room-view-panel'>
            <ActivityPanel room={current} canStart={can('changeMedia')} />
          </div>
        </Dialog>
      )}
      {panel === 'recs' && (
        <Dialog title='今晚看什么' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel tm-room-view-pad'>
            <Recommendations onChoose={(title) => openPicker(title)} />
          </div>
        </Dialog>
      )}
      {panel === 'danmaku' && (
        <Dialog title='弹幕' onClose={() => setPanel(null)} sheet>
          <div className='tm-room-view-panel'>
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
          <div className='tm-room-view-panel tm-room-view-menu'>
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
              openPanel('playlist')
            )
          }
        />
      )}

      {invite && (
        <Dialog title='邀请朋友' onClose={() => setInvite(false)}>
          <div className='tm-room-form'>
            <p className='tm-room-lead'>
              把链接发给朋友，登录后打开就能进来
              {current.hasPassword ? '（还需要输入密码）' : ''}。
            </p>
            <div className='tm-room-view-copy'>
              <code>{inviteUrl}</code>
              <button
                type='button'
                className='tm-room-btn tm-room-btn-primary'
                onClick={() => void copy(inviteUrl, 'link')}
              >
                {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
                {copied === 'link' ? '已复制' : '复制链接'}
              </button>
            </div>
            <div className='tm-room-view-copy'>
              <code>房间号 {maskedRoomId(current.id)}</code>
              <button
                type='button'
                className='tm-room-btn'
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

const TAB_LABELS: Record<SideTab, string> = {
  chat: '聊天',
  playlist: '片单',
  members: '成员',
  activities: '活动',
};

/** 平板侧栏的四个标签（2026-11-18 平板设计稿方案 A）；左右方向键切换 */
function SideTabs({
  tab,
  onTab,
  counts,
  alert,
}: {
  tab: SideTab;
  onTab(tab: SideTab): void;
  counts: Partial<Record<SideTab, number>>;
  alert: Partial<Record<SideTab, boolean>>;
}) {
  return (
    <div
      className='tm-room-view-tabs'
      role='tablist'
      aria-label='侧栏内容'
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next =
          SIDE_TABS[
            (SIDE_TABS.indexOf(tab) + step + SIDE_TABS.length) %
              SIDE_TABS.length
          ];
        onTab(next);
        event.currentTarget
          .querySelector<HTMLButtonElement>(`[data-tab='${next}']`)
          ?.focus();
      }}
    >
      {SIDE_TABS.map((name) => (
        <button
          key={name}
          type='button'
          role='tab'
          data-tab={name}
          aria-selected={tab === name}
          tabIndex={tab === name ? 0 : -1}
          onClick={() => onTab(name)}
        >
          {TAB_LABELS[name]}
          {!!counts[name] && (
            <span
              className='tm-room-view-tab-count'
              data-alert={alert[name] || undefined}
            >
              {counts[name]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
