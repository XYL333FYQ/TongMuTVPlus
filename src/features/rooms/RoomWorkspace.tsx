'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  Copy,
  Film,
  Link2,
  Lock,
  LogOut,
  MessageCircle,
  Monitor,
  Music2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useReducedMotionSetting } from '@/lib/motion';
import { base58Encode } from '@/lib/utils';

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import { usePlaybackSession } from '@/features/playback/context';
import PlaybackSlot from '@/features/playback/PlaybackSlot';
import {
  queueItemFromHref,
  queuePlaybackHref,
} from '@/features/playback/session';

import RoomActionMenu from './RoomActionMenu';
import RoomPlaybackButton from './RoomPlaybackButton';
import useRoomScreening from './useRoomScreening';

import type { Room } from '@/types/watch-room';

type RoomSummary = Pick<
  Room,
  | 'id'
  | 'name'
  | 'description'
  | 'isPublic'
  | 'hasPassword'
  | 'ownerAccountId'
  | 'memberCount'
  | 'lifecycle'
  | 'updatedAt'
>;
type FilmChoice = {
  id: string;
  title: string;
  source: string;
  source_name?: string;
  year?: string;
};

export default function RoomWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const watchRoom = useWatchRoomContext();
  const playback = usePlaybackSession();
  const room = watchRoom.currentRoom;
  const reducedMotion = useReducedMotionSetting();
  const [panelTab, setPanelTab] = useState<'queue' | 'chat' | 'members'>(
    'queue'
  );
  const [membersOpen, setMembersOpen] = useState(false);
  const screening = useRoomScreening(
    playback.controller?.video || null,
    Boolean(
      room && playback.followingRoom && playback.presentation === 'docked'
    )
  );
  const controllerMember = watchRoom.members?.find(
    (member) => member.id === room?.controllerSessionId
  );
  // A controller still assigned to a departed session is awaiting server handoff.
  // No controller assignment means no host, not an invented election result.
  const handingOver = Boolean(
    watchRoom.isConnected && room?.controllerSessionId && !controllerMember
  );
  const hostLabel = handingOver
    ? '房主交接中'
    : watchRoom.canControl
    ? '你正在主持'
    : room?.controllerAccountId
    ? `${room.controllerAccountId} 正在主持`
    : '暂无主持';
  useEffect(() => {
    const showChat = () => {
      setPanelTab('chat');
      if (window.innerWidth < 1200)
        requestAnimationFrame(() => {
          document.querySelector('[data-tm-room-chat-slot]')?.scrollIntoView({
            block: 'start',
            behavior: reducedMotion ? 'auto' : 'smooth',
          });
        });
    };
    window.addEventListener('tongmu:open-chat', showChat);
    return () => window.removeEventListener('tongmu:open-chat', showChat);
  }, [reducedMotion]);
  const [username, setUsername] = useState('');
  const [isStationAdmin, setIsStationAdmin] = useState(false);
  const [autoArchive, setAutoArchive] = useState(true);
  const [directory, setDirectory] = useState<'mine' | 'public' | 'archived'>(
    'public'
  );
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [directoryError, setDirectoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<
    'create' | 'join' | 'picker' | 'settings' | null
  >(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [password, setPassword] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const attemptedInvite = useRef('');
  const directoryRequest = useRef(0);
  const inviteId = params.get('room') || '';

  useEffect(() => {
    const user = getAuthInfoFromBrowserCookie()?.username || '';
    setUsername(user);
    setDirectory(user ? 'mine' : 'public');
    const role = getAuthInfoFromBrowserCookie()?.role;
    setIsStationAdmin(role === 'owner' || role === 'admin');
    setMusicEnabled(Boolean(window.RUNTIME_CONFIG?.MUSIC_ENABLED));
    setLiveEnabled(Boolean(window.RUNTIME_CONFIG?.LIVE_ENABLED));
  }, []);

  const refresh = useCallback(async () => {
    const request = ++directoryRequest.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms?mode=${directory}`, {
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? '登录后查看自己的房间'
            : '房间服务暂时不可用'
        );
      const data = await response.json();
      if (request !== directoryRequest.current) return;
      setRooms(data.rooms || []);
      setDirectoryError('');
    } catch (failure) {
      if (request !== directoryRequest.current) return;
      setDirectoryError(
        failure instanceof TypeError
          ? '房间列表暂时无法刷新，网络恢复后会自动重试'
          : failure instanceof Error
          ? failure.message
          : '读取房间失败'
      );
    } finally {
      if (request === directoryRequest.current) setLoading(false);
    }
  }, [directory]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      directoryRequest.current += 1;
    };
  }, [refresh]);

  const requireLogin = () => {
    if (username) return true;
    router.push(
      `/login?redirect=${encodeURIComponent(
        '/watch-room' +
          (inviteId ? `?room=${encodeURIComponent(inviteId)}` : '')
      )}`
    );
    return false;
  };
  const join = async (
    id: string,
    roomPassword?: string,
    replaceCurrent = false
  ) => {
    if (!requireLogin()) return;
    if (!watchRoom.isConnected) {
      setError('正在连接房间服务，请稍后再试');
      return;
    }
    if (room && room.id !== id && !replaceCurrent) {
      setJoinId(id);
      setDialog('join');
      setError(
        '加入新房间前，需要先退出当前房间。当前房间的其他人会继续观看。'
      );
      return;
    }
    if (room && room.id !== id && replaceCurrent) watchRoom.leaveRoom();
    setBusy(true);
    setError('');
    try {
      await watchRoom.joinRoom({
        roomId: id.trim(),
        password: roomPassword,
        userName: username,
      });
      setDialog(null);
      setPassword('');
      // An invitation already has its room parameter; retain its other query values.
      if (inviteId !== id.trim())
        router.replace(`/watch-room?room=${encodeURIComponent(id.trim())}`);
    } catch (failure) {
      setJoinId(id);
      setDialog('join');
      setError(failure instanceof Error ? failure.message : '加入失败');
    } finally {
      setBusy(false);
    }
  };
  const joinRef = useRef(join);
  joinRef.current = join;
  useEffect(() => {
    if (inviteId && room?.id === inviteId) {
      attemptedInvite.current = inviteId;
      const remaining = new URLSearchParams(params.toString());
      remaining.delete('room');
      const search = remaining.toString();
      router.replace(
        `/watch-room${search ? `?${search}` : ''}${window.location.hash}`,
        {
          scroll: false,
        }
      );
      return;
    }
    if (
      !inviteId ||
      !username ||
      !watchRoom.isConnected ||
      room?.id === inviteId ||
      attemptedInvite.current === inviteId
    )
      return;
    attemptedInvite.current = inviteId;
    void joinRef.current(inviteId);
  }, [inviteId, username, watchRoom.isConnected, room?.id, params, router]);

  const mutate = async (event: string, payload: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      await watchRoom.roomCommand(event, payload);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '操作未完成');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const addFilm = async (href: string) => {
    if (await mutate('queue:add', queueItemFromHref(href))) {
      setDialog(null);
      setNotice('已加入片单，当前影片继续播放');
    }
  };
  const openCreate = () => {
    if (!requireLogin()) return;
    setName('');
    setDescription('');
    setPassword('');
    setIsPublic(false);
    setError('');
    setDialog('create');
  };
  const create = async () => {
    if (room) {
      setError('先退出当前房间，再创建新房间；已有房间会保留。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await watchRoom.createRoom({
        name,
        description,
        password: password || undefined,
        isPublic,
        roomType: 'sync',
        userName: username,
      });
      setDialog(null);
      router.replace(`/watch-room?room=${encodeURIComponent(created.id)}`);
      void refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '创建失败');
    } finally {
      setBusy(false);
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
      setNotice(
        `邀请地址：${window.location.origin}/watch-room?room=${room.id}`
      );
    }
  };
  const openSettings = () => {
    if (!room) return;
    setName(room.name);
    setDescription(room.description);
    setIsPublic(room.isPublic);
    setPassword('');
    setAutoArchive(room.settings?.autoArchive !== false);
    setDeleteConfirmation('');
    setDialog('settings');
  };
  const restore = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(id)}/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandId: crypto.randomUUID() }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error || '恢复失败');
      setNotice('房间已恢复，可以重新进入');
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '恢复失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout
      activePath='/watch-room'
      mobileTitle={room?.name}
      mobileSubtitle={
        room ? (
          <>
            {watchRoom.isConnected ? '已连接' : '重连中'} · {room.memberCount}{' '}
            人在线
          </>
        ) : undefined
      }
      mobileActions={
        room ? (
          <RoomActionMenu
            label='房间操作'
            items={[
              {
                label: copied ? '已复制邀请' : '邀请朋友',
                onSelect: () => void copyInvite(),
              },
              ...(watchRoom.isOwner
                ? [{ label: '房间设置', onSelect: openSettings }]
                : []),
              {
                label: '退出房间',
                onSelect: () => {
                  watchRoom.leaveRoom();
                  router.replace('/watch-room');
                  void refresh();
                },
              },
            ]}
          />
        ) : undefined
      }
    >
      <PageContainer
        className='tm-rooms'
        data-screening={screening}
        data-joined={Boolean(room)}
        data-playing={room?.currentState?.type === 'play'}
        data-personal={Boolean(room && !playback.followingRoom)}
      >
        {room && !watchRoom.isConnected && (
          <div className='tm-room-reconnecting' role='status'>
            重连中 · 影片继续播放
            {watchRoom.reconnectFailed && (
              <button onClick={watchRoom.manualReconnect}>重新连接</button>
            )}
          </div>
        )}
        <div className='tm-rooms-heading'>
          <div>
            {room && (
              <p className='tm-room-heading-status'>
                <span
                  className={`tm-room-connection ${
                    watchRoom.isConnected ? '' : 'is-offline'
                  }`}
                />
                {watchRoom.isConnected ? '已连接' : '重连中'} · {hostLabel}
              </p>
            )}
            <h1>{room ? room.name : '房间'}</h1>
            {(room?.description || !room) && (
              <p>{room?.description || '创建房间，或用邀请码加入'}</p>
            )}
          </div>
          <div className='tm-rooms-heading-actions'>
            {room ? (
              <>
                <button
                  className='tm-room-avatar-cluster'
                  aria-label={`成员，${room.memberCount}人`}
                  aria-expanded={membersOpen}
                  onClick={() => {
                    setMembersOpen((value) => !value);
                    setPanelTab('members');
                  }}
                >
                  <AnimatePresence initial={false}>
                    {watchRoom.members.slice(0, 4).map((member) => (
                      <motion.span
                        key={member.id}
                        className='tm-room-avatar'
                        initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.8 }}
                        transition={
                          reducedMotion
                            ? { duration: 0.12 }
                            : { type: 'spring', duration: 0.32, bounce: 0.2 }
                        }
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  <span>{room.memberCount} 人</span>
                </button>
                <button onClick={copyInvite}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? '已复制' : '邀请朋友'}
                </button>
                {watchRoom.isOwner && (
                  <button
                    className='tm-room-heading-settings'
                    onClick={openSettings}
                    aria-label='房间设置'
                  >
                    <Settings2 size={18} />
                  </button>
                )}
                <button
                  onClick={() => {
                    watchRoom.leaveRoom();
                    router.replace('/watch-room');
                    void refresh();
                  }}
                >
                  <LogOut size={16} />
                  退出房间
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setJoinId(inviteId);
                    setPassword('');
                    setError('');
                    setDialog('join');
                  }}
                >
                  <Link2 size={16} />
                  用邀请码加入
                </button>
                <button className='tm-room-primary' onClick={openCreate}>
                  <Plus size={17} />
                  创建房间
                </button>
              </>
            )}
          </div>
        </div>
        {(error || watchRoom.lastError || directoryError) && (
          <div className='tm-room-feedback tm-room-feedback-error' role='alert'>
            {error || watchRoom.lastError || directoryError}
            <button
              onClick={() => {
                setError('');
                setDirectoryError('');
                watchRoom.clearError();
              }}
              aria-label='关闭错误'
            >
              <X size={14} />
            </button>
          </div>
        )}
        {notice && (
          <div className='tm-room-feedback' role='status'>
            {notice}
            <button onClick={() => setNotice('')} aria-label='关闭提示'>
              <X size={14} />
            </button>
          </div>
        )}
        {room ? (
          <div className='tm-room-workspace'>
            <section className='tm-room-stage'>
              {room.currentState?.type === 'play' && playback.followingRoom ? (
                <>
                  {playback.presentation === 'folded' && (
                    <button
                      className='tm-room-restore tm-room-primary'
                      onClick={playback.restore}
                    >
                      恢复画面
                    </button>
                  )}
                </>
              ) : (
                <div className='tm-room-empty-stage'>
                  <Film size={36} strokeWidth={1} />
                  <h2>
                    {!playback.followingRoom
                      ? '你正在个人观看'
                      : room.currentState
                      ? '房间正在进行其他活动'
                      : '选一部影片'}
                  </h2>
                  <p>
                    {!playback.followingRoom
                      ? '房间连接和消息保留'
                      : '加入片单，再由主持播放'}
                  </p>
                  {!playback.followingRoom ? (
                    <button
                      className='tm-room-primary'
                      onClick={playback.resumeRoom}
                    >
                      回到一起看
                    </button>
                  ) : (
                    <button
                      className='tm-room-primary'
                      onClick={() => setDialog('picker')}
                    >
                      <Plus size={16} />
                      选择影片
                    </button>
                  )}
                  {!room.currentState &&
                    playback.href &&
                    watchRoom.canControl && (
                      <button onClick={playback.shareCurrentPlayback}>
                        <Play size={14} />
                        分享当前正在看的影片
                      </button>
                    )}
                </div>
              )}
              {(room.currentState?.type === 'play' ||
                !playback.followingRoom) && (
                <div
                  className={
                    playback.followingRoom
                      ? 'tm-room-main-anchor'
                      : 'tm-room-personal-anchor'
                  }
                >
                  <PlaybackSlot />
                </div>
              )}
              {playback.metadata.error && (
                <p className='tm-room-media-status' role='status'>
                  视频加载失败 · 使用「重新加载影片」重试
                </p>
              )}
              <div className='tm-room-stage-footer'>
                <div>
                  <h2>
                    {room.currentState?.type === 'play'
                      ? room.currentState.videoName
                      : '还没有在播放的影片'}
                  </h2>
                  <p>
                    {room.currentState?.type === 'play'
                      ? `第 ${room.currentState.episode || 1} 集 · ${
                          playback.metadata.loading
                            ? '正在准备播放'
                            : '原始画质优先'
                        }`
                      : '离开页面或收起画面，房间仍会继续'}
                  </p>
                </div>
                <div className='tm-room-stage-actions'>
                  {room.currentState?.type === 'play' &&
                    playback.followingRoom &&
                    playback.presentation !== 'folded' && (
                      <RoomPlaybackButton
                        className='tm-room-personal-button'
                        hint='暂时脱离同步，房间连接和消息保留'
                        onClick={playback.enterPersonalViewing}
                      >
                        仅自己看
                      </RoomPlaybackButton>
                    )}
                </div>
              </div>
              <div className='tm-room-activities'>
                <button
                  className='tm-room-stage-chat'
                  onClick={() =>
                    window.dispatchEvent(new Event('tongmu:open-chat'))
                  }
                >
                  <MessageCircle size={17} />
                  聊天
                  {Boolean(room.unreadCount) && (
                    <motion.b
                      key={room.unreadCount}
                      initial={{ scale: reducedMotion ? 1 : 0.8 }}
                      animate={{ scale: 1 }}
                      transition={
                        reducedMotion
                          ? { duration: 0.12 }
                          : { type: 'spring', duration: 0.32, bounce: 0.2 }
                      }
                    >
                      {room.unreadCount}
                    </motion.b>
                  )}
                </button>
                <Link href='/search'>
                  <Search size={15} />
                  浏览片库
                  <ArrowUpRight size={12} />
                </Link>
                {liveEnabled && (
                  <Link href='/live'>
                    <Radio size={15} />
                    电视直播
                  </Link>
                )}
                {musicEnabled && (
                  <Link href='/music'>
                    <Music2 size={15} />
                    一起听
                  </Link>
                )}
                {watchRoom.canControl && (
                  <Link href='/watch-room/screen'>
                    <Monitor size={15} />
                    屏幕共享
                  </Link>
                )}
              </div>
            </section>
            <aside className='tm-room-side'>
              <div
                className='tm-room-panel-tabs'
                role='tablist'
                aria-label='房间面板'
              >
                {(['queue', 'chat', 'members'] as const).map((tab) => (
                  <button
                    key={tab}
                    id={`tm-room-tab-${tab}`}
                    role='tab'
                    aria-selected={panelTab === tab}
                    aria-controls={`tm-room-panel-${tab}`}
                    onClick={() => setPanelTab(tab)}
                  >
                    {panelTab === tab && (
                      <motion.span
                        className='tm-room-tab-active'
                        layoutId='tm-room-panel-active'
                        transition={{ duration: reducedMotion ? 0 : 0.2 }}
                      />
                    )}
                    <span>
                      {tab === 'queue'
                        ? `片单 ${room.queue?.length || 0}`
                        : tab === 'chat'
                        ? '聊天'
                        : `成员 ${room.memberCount}`}
                    </span>
                  </button>
                ))}
              </div>
              <section
                className='tm-room-queue'
                id='tm-room-panel-queue'
                data-active={panelTab === 'queue'}
                aria-label='片单'
              >
                <header>
                  <div>
                    <h2>片单 {room.queue?.length || 0}</h2>
                    <p>{room.queue?.length || 0} 部待播影片</p>
                  </div>
                  <button
                    onClick={() => setDialog('picker')}
                    aria-label='添加影片'
                  >
                    <Plus size={20} />
                  </button>
                </header>
                {!room.queue?.length && (
                  <div className='tm-room-queue-empty'>
                    <Film size={25} strokeWidth={1} />
                    <p>片单为空</p>
                    <button
                      className='tm-room-primary'
                      onClick={() => setDialog('picker')}
                    >
                      添加影片
                    </button>
                  </div>
                )}
                <ol>
                  {room.queue?.map((item, index) => (
                    <motion.li
                      key={item.id}
                      layout={reducedMotion ? false : 'position'}
                      transition={{ duration: reducedMotion ? 0 : 0.32 }}
                    >
                      <span className='tm-room-queue-number'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className='tm-room-queue-thumbnail'
                        aria-hidden='true'
                      >
                        <Film size={18} />
                      </span>
                      <div className='tm-room-queue-copy'>
                        <h3>{item.title}</h3>
                        <p>
                          {item.addedBy} 添加 · 第{item.episode || 1}集
                        </p>
                      </div>
                      <div className='tm-room-queue-actions'>
                        {watchRoom.canControl && (
                          <button
                            onClick={() =>
                              playback.requestPlayback(
                                queuePlaybackHref(item.href, item.episode || 1),
                                'user'
                              )
                            }
                            aria-label={`播放${item.title}`}
                          >
                            <Play size={15} />
                          </button>
                        )}
                        <RoomActionMenu
                          label={`${item.title}的片单操作`}
                          items={[
                            ...(watchRoom.isOwner ||
                            watchRoom.members.find(
                              (member) => member.id === watchRoom.socket?.id
                            )?.canHost
                              ? [
                                  {
                                    label: '上移',
                                    disabled: busy || index === 0,
                                    onSelect: () =>
                                      void mutate('queue:move', {
                                        id: item.id,
                                        position: index - 1,
                                      }),
                                  },
                                  {
                                    label: '下移',
                                    disabled:
                                      busy ||
                                      index === (room.queue?.length || 0) - 1,
                                    onSelect: () =>
                                      void mutate('queue:move', {
                                        id: item.id,
                                        position: index + 1,
                                      }),
                                  },
                                ]
                              : []),
                            ...(item.addedBy === username ||
                            watchRoom.isOwner ||
                            watchRoom.members.find(
                              (member) => member.id === watchRoom.socket?.id
                            )?.canHost
                              ? [
                                  {
                                    label: '移除',
                                    disabled: busy,
                                    onSelect: () =>
                                      void mutate('queue:remove', {
                                        id: item.id,
                                      }),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </motion.li>
                  ))}
                </ol>
                {!!room.queue?.length && (
                  <button
                    className='tm-room-add-film'
                    onClick={() => setDialog('picker')}
                  >
                    <Plus size={16} />
                    添加影片
                  </button>
                )}
              </section>
              <div
                id='tm-room-panel-chat'
                className='tm-room-chat-slot'
                data-tm-room-chat-slot
                data-active={panelTab === 'chat'}
              />
              <section
                className='tm-room-members'
                id='tm-room-panel-members'
                data-active={panelTab === 'members'}
                data-expanded={membersOpen}
                aria-label='成员'
              >
                <header>
                  <h2>成员</h2>
                  <span>{room.memberCount}人</span>
                  {watchRoom.isOwner && (
                    <button onClick={openSettings} aria-label='房间设置'>
                      <Settings2 size={18} />
                    </button>
                  )}
                </header>
                {watchRoom.members.map((member) => (
                  <div key={member.id} className='tm-room-member'>
                    <span className='tm-room-avatar'>
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <h3>
                        {member.name}
                        {member.id === watchRoom.socket?.id && '（你）'}
                      </h3>
                      <p>
                        {member.isController
                          ? '当前主持'
                          : member.isOwner
                          ? '房间创建者'
                          : member.following === false
                          ? '个人观看中'
                          : member.canHost
                          ? '可接替主持'
                          : '一起观看'}
                      </p>
                    </div>
                    {member.isController && <Shield size={15} />}
                    {watchRoom.isOwner &&
                      !member.isOwner &&
                      member.accountId && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            mutate('room:authorize-host', {
                              accountId: member.accountId,
                              canHost: !member.canHost,
                            })
                          }
                        >
                          {member.canHost ? '取消授权' : '授权主持'}
                        </button>
                      )}
                  </div>
                ))}
              </section>
            </aside>
          </div>
        ) : (
          <>
            <div className='tm-room-directory-toolbar'>
              <div role='tablist' aria-label='房间目录'>
                {(['mine', 'public', 'archived'] as const).map((tab) => (
                  <button
                    key={tab}
                    role='tab'
                    aria-selected={directory === tab}
                    disabled={!username && tab !== 'public'}
                    onClick={() => {
                      setDirectory(tab);
                      setError('');
                    }}
                  >
                    {tab === 'mine'
                      ? '我的房间'
                      : tab === 'public'
                      ? '公开房间'
                      : '已归档'}
                  </button>
                ))}
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                aria-label='刷新房间'
              >
                <RefreshCw
                  size={17}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>
            {!rooms.length ? (
              <div className='tm-room-directory-empty'>
                <Users size={40} strokeWidth={1} />
                <h2>
                  {loading
                    ? '正在加载房间'
                    : directory === 'mine'
                    ? '还没有房间'
                    : directory === 'archived'
                    ? '暂时没有归档房间'
                    : '还没有公开房间'}
                </h2>
                <p>
                  {directory === 'archived'
                    ? '归档后七天内可以恢复'
                    : '创建一个房间，把邀请发给朋友'}
                </p>
                {directory !== 'archived' && (
                  <button className='tm-room-primary' onClick={openCreate}>
                    创建第一个房间
                  </button>
                )}
              </div>
            ) : (
              <div className='tm-room-directory'>
                {rooms.map((item) => (
                  <article key={item.id} className='tm-room-card'>
                    <div className='tm-room-card-art'>
                      <Users size={32} strokeWidth={1.25} aria-hidden />
                      <span
                        className='tm-badge tm-room-card-presence'
                        data-on-art='true'
                      >
                        <i
                          className='tm-dot'
                          data-live={item.memberCount > 0}
                        />
                        {item.memberCount > 0
                          ? `${item.memberCount} 人在线`
                          : '无人在线'}
                      </span>
                      <span
                        className='tm-badge tm-room-card-access'
                        data-on-art='true'
                      >
                        {item.hasPassword && <Lock size={12} aria-hidden />}
                        {item.isPublic ? '公开' : '私密'}
                      </span>
                    </div>
                    <div className='tm-room-card-body'>
                      <h2>{item.name}</h2>
                      <p>
                        {item.description ||
                          (item.lifecycle === 'archived'
                            ? '已归档'
                            : `房主 ${item.ownerAccountId}`)}
                      </p>
                    </div>
                    <button
                      className='tm-btn tm-btn-secondary tm-btn-sm tm-room-card-action'
                      disabled={busy}
                      onClick={() =>
                        item.lifecycle === 'archived'
                          ? restore(item.id)
                          : join(item.id)
                      }
                    >
                      {item.lifecycle === 'archived' ? '恢复房间' : '进入房间'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        {dialog &&
          createPortal(
            <div className='tm-rooms tm-room-modal-root'>
              <div
                className='tm-room-dialog-backdrop'
                onClick={() => !busy && setDialog(null)}
                role='presentation'
              >
                <section
                  className='tm-room-dialog'
                  role='dialog'
                  aria-modal='true'
                  aria-labelledby='tm-room-dialog-title'
                  onClick={(event) => event.stopPropagation()}
                >
                  <header>
                    <h2 id='tm-room-dialog-title'>
                      {dialog === 'create'
                        ? '创建房间'
                        : dialog === 'join'
                        ? '加入朋友的房间'
                        : dialog === 'picker'
                        ? '添加影片'
                        : '房间设置'}
                    </h2>
                    <button
                      disabled={busy}
                      onClick={() => setDialog(null)}
                      aria-label='关闭'
                    >
                      <X size={20} />
                    </button>
                  </header>
                  {dialog === 'picker' ? (
                    <FilmPicker busy={busy} onAdd={addFilm} />
                  ) : dialog === 'join' ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void join(joinId, password, true);
                      }}
                    >
                      <label>
                        房间号
                        <input
                          required
                          value={joinId}
                          onChange={(event) => setJoinId(event.target.value)}
                          maxLength={64}
                        />
                      </label>
                      <label>
                        房间密码（如果有）
                        <input
                          type='password'
                          autoComplete='new-password'
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          maxLength={128}
                        />
                      </label>
                      {room && room.id !== joinId && (
                        <p>加入时将退出「{room.name}」，其他成员继续观看。</p>
                      )}
                      <button
                        className='tm-room-primary'
                        disabled={busy || !joinId.trim()}
                      >
                        {busy
                          ? '正在加入…'
                          : username
                          ? '进入房间'
                          : '登录后加入'}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (dialog === 'create') void create();
                        else
                          void mutate('room:settings', {
                            name,
                            description,
                            isPublic,
                            ...(password ? { password } : {}),
                            ...(isStationAdmin ? { autoArchive } : {}),
                          }).then((ok) => {
                            if (ok) setDialog(null);
                          });
                      }}
                    >
                      <label>
                        房间名称
                        <input
                          required
                          maxLength={80}
                          autoComplete='off'
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder='例如：周五夜场'
                        />
                      </label>
                      <label>
                        一句介绍
                        <textarea
                          maxLength={500}
                          rows={2}
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                          placeholder='介绍这个房间（可选）'
                        />
                      </label>
                      <label className='tm-room-checkbox'>
                        <input
                          type='checkbox'
                          checked={isPublic}
                          onChange={(event) =>
                            setIsPublic(event.target.checked)
                          }
                        />
                        出现在公开房间列表
                      </label>
                      <label>
                        {dialog === 'create'
                          ? '设置房间密码（可选）'
                          : '更换密码（留空保留原密码）'}
                        <input
                          type='password'
                          maxLength={128}
                          autoComplete='new-password'
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </label>
                      <p>
                        {isPublic
                          ? '所有人可以看到房间介绍；登录后才能加入和播放。'
                          : '默认私密，通过邀请地址或房间号加入。'}
                      </p>
                      <button
                        className='tm-room-primary'
                        disabled={
                          busy || !name.trim() || !watchRoom.isConnected
                        }
                      >
                        {busy
                          ? '正在保存…'
                          : dialog === 'create'
                          ? '创建并进入'
                          : '保存设置'}
                      </button>
                      {dialog === 'settings' && isStationAdmin && (
                        <label className='tm-room-checkbox'>
                          <input
                            type='checkbox'
                            checked={autoArchive}
                            onChange={(event) =>
                              setAutoArchive(event.target.checked)
                            }
                          />
                          空闲30天后自动归档（关闭可长期保留）
                        </label>
                      )}
                      {dialog === 'settings' && room && (
                        <div className='tm-room-danger'>
                          <label>
                            删除房间请输入「{room.name}」
                            <input
                              value={deleteConfirmation}
                              onChange={(event) =>
                                setDeleteConfirmation(event.target.value)
                              }
                            />
                          </label>
                          <button
                            type='button'
                            disabled={busy || deleteConfirmation !== room.name}
                            onClick={() =>
                              void mutate('room:delete', {}).then((ok) => {
                                if (ok) {
                                  setDialog(null);
                                  router.replace('/watch-room');
                                  void refresh();
                                }
                              })
                            }
                          >
                            <Trash2 size={14} />
                            永久删除房间与聊天
                          </button>
                        </div>
                      )}
                    </form>
                  )}
                  {error && (
                    <p className='tm-room-dialog-error' role='alert'>
                      {error}
                    </p>
                  )}
                </section>
              </div>
            </div>,
            document.body
          )}
      </PageContainer>
    </PageLayout>
  );
}

function FilmPicker({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (href: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'catalog' | 'direct'>('catalog');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [results, setResults] = useState<FilmChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const search = async () => {
    setError('');
    if (mode === 'direct') {
      try {
        const url = new URL(query.trim());
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          !/\.(mp4|m3u8)$/i.test(url.pathname)
        )
          throw new Error(
            '请使用完整的 MP4 或 M3U8 直链。电影网页地址需要独立解析能力。'
          );
        await onAdd(
          `/play?${new URLSearchParams({
            source: 'directplay',
            id: base58Encode(url.href),
            title: title || '分享的影片',
            episode: '1',
          })}`
        );
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : '地址无效');
      }
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}`,
        { cache: 'no-store' }
      );
      if (!response.ok)
        throw new Error('搜索失败，请检查登录和站长配置的数据源');
      const data = await response.json();
      setResults(data.results || []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '搜索失败');
    } finally {
      setSearching(false);
    }
  };
  return (
    <div className='tm-room-picker'>
      <div className='tm-room-picker-tabs'>
        <button
          aria-pressed={mode === 'catalog'}
          onClick={() => {
            setMode('catalog');
            setQuery('');
            setError('');
          }}
        >
          <Film size={15} />
          影视库
        </button>
        <button
          aria-pressed={mode === 'direct'}
          onClick={() => {
            setMode('direct');
            setQuery('');
            setError('');
          }}
        >
          <Link2 size={15} />
          视频直链
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        {mode === 'direct' && (
          <label>
            影片名称
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={240}
              placeholder='给朋友一个好认的名字'
            />
          </label>
        )}
        <label>
          {mode === 'catalog' ? '搜索影片' : 'MP4 / M3U8 地址'}
          <input
            required
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              mode === 'catalog'
                ? '电影名、剧集名…'
                : 'https://…/video.m3u8?token=…'
            }
          />
        </label>
        <button
          className='tm-room-primary'
          disabled={busy || searching || !query.trim()}
        >
          {searching ? '正在搜索…' : mode === 'catalog' ? '搜索' : '加入片单'}
        </button>
      </form>
      <p>加入片单不会切换正在播放的影片。播放由当前主持确认。</p>
      {error && <p role='alert'>{error}</p>}
      <div className='tm-room-picker-results'>
        {results.map((film, index) => (
          <div key={`${film.source}:${film.id}:${index}`}>
            <div>
              <h3>{film.title}</h3>
              <p>
                {film.year || '年份未知'} · {film.source_name || film.source}
              </p>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                onAdd(
                  `/play?${new URLSearchParams({
                    source: film.source,
                    id: String(film.id),
                    title: film.title,
                    year: film.year || '',
                    episode: '1',
                  })}`
                )
              }
              aria-label={`将${film.title}加入片单`}
            >
              <Plus size={18} />
            </button>
          </div>
        ))}
        {searched && !searching && !results.length && !error && (
          <p>没有找到结果。可以换个关键词，或请站长检查数据源。</p>
        )}
      </div>
    </div>
  );
}
