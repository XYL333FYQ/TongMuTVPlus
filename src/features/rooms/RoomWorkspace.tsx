'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { useReducedMotionSetting } from '@/lib/motion';

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import { usePlaybackSession } from '@/features/playback/context';
import {
  liveActivityHref,
  normalizeActivityReturnHref,
} from '@/features/playback/room-live';
import {
  normalizePlaybackHref,
  queueItemFromHref,
} from '@/features/playback/session';
import { useRoomPlayback } from '@/features/room/RoomPlaybackBridge';

import {
  EXTERNAL_ROOM_SERVER_NOTICE,
  isExternalRoomServer,
} from './external-room-server';
import { compressRoomCover } from './room-cover';
import { defaultRoomName, displayRoomName } from './room-presentation';
import {
  type RoomFormValues,
  JoinRoomForm,
  RoomDialogShell,
  RoomForm,
} from './RoomDialogs';
import RoomDirectory, { type RoomSummary } from './RoomDirectory';
import RoomFilmPicker from './RoomFilmPicker';
import RoomHeader from './RoomHeader';
import RoomMediaInfo from './RoomMediaInfo';
import RoomQuickStart from './RoomQuickStart';
import RoomSidePanel from './RoomSidePanel';
import RoomStage from './RoomStage';
import useRoomScreening from './useRoomScreening';

export default function RoomWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const watchRoom = useWatchRoomContext();
  const playback = usePlaybackSession();
  const roomPlayback = useRoomPlayback();
  const room = watchRoom.currentRoom;
  const activity = room?.currentState;
  const activityHref =
    activity?.type === 'live'
      ? liveActivityHref(activity)
      : activity?.type === 'music'
      ? '/watch-room/music'
      : activity?.type === 'screen'
      ? '/watch-room/screen'
      : null;
  const activityLabel =
    activity?.type === 'live'
      ? '观看直播'
      : activity?.type === 'music'
      ? '一起听'
      : '观看共享';
  const waitingQueue = room?.queue?.filter((item) => !item.playedAt) || [];
  const reducedMotion = useReducedMotionSetting();
  const [panelTab, setPanelTab] = useState<'queue' | 'chat' | 'members'>(
    'queue'
  );
  // 首次进入房间时让窄屏直接聊天；之后切换标签或旋转屏幕不覆盖用户选择。
  useEffect(() => {
    if (room?.id) setPanelTab(window.innerWidth < 1200 ? 'chat' : 'queue');
  }, [room?.id]);
  const screening = useRoomScreening(
    playback.controller?.video || null,
    Boolean(room && playback.presentation === 'docked')
  );
  // 与 SyncTV 一致：没有“唯一主持设备”，有权限的人都能直接控制播放。
  const membersControl = room?.settings?.memberCanControl !== false;
  const hostLabel = !watchRoom.canControl
    ? '仅房主和管理员可控制播放'
    : membersControl
    ? '所有人都可以控制播放'
    : watchRoom.isOwner
    ? '你是房主'
    : '你是管理员';
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
  const roomTitle = room ? displayRoomName(room) : '房间';
  const [isStationAdmin, setIsStationAdmin] = useState(false);
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
  const mutationOperation = useRef(0);
  const activeRoom = useRef(room?.id);
  activeRoom.current = room?.id;
  const pickerAttempt = useRef<{
    roomId: string;
    href: string;
    commandId: string;
  } | null>(null);
  useEffect(() => {
    mutationOperation.current += 1;
    pickerAttempt.current = null;
    setBusy(false);
    setError('');
    setNotice('');
    setDialog(null);
  }, [room?.id]);
  const [pickerTitle, setPickerTitle] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [copiedInviteRoomId, setCopiedInviteRoomId] = useState('');
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const attemptedInvite = useRef('');
  const directoryRequest = useRef(0);
  const inviteId = params.get('room') || '';
  const selectedFilm = normalizePlaybackHref(params.get('film') || '');
  const activityReturn = normalizeActivityReturnHref(
    params.get('activityReturn')
  );
  const roomLocation = (id: string) =>
    `/watch-room?${new URLSearchParams({
      room: id,
      ...(selectedFilm ? { film: selectedFilm } : {}),
      ...(activityReturn ? { activityReturn } : {}),
    })}`;

  useEffect(() => {
    const user = getAuthInfoFromBrowserCookie()?.username || '';
    setUsername(user);
    setDirectory(user ? 'mine' : 'public');
    const role = getAuthInfoFromBrowserCookie()?.role;
    setIsStationAdmin(role === 'owner' || role === 'admin');
    setMusicEnabled(Boolean(window.RUNTIME_CONFIG?.MUSIC_ENABLED));
    setLiveEnabled(Boolean(window.RUNTIME_CONFIG?.LIVE_ENABLED));
  }, []);

  const externalServer = isExternalRoomServer(watchRoom.config);
  const refresh = useCallback(async () => {
    const request = ++directoryRequest.current;
    if (externalServer) {
      // 外部服务没有房间目录 REST：不请求必败的接口，直接说明边界
      setRooms([]);
      setDirectoryError(EXTERNAL_ROOM_SERVER_NOTICE);
      setLoading(false);
      return;
    }
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
  }, [directory, externalServer]);
  useEffect(() => {
    if (room?.id) return;
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      directoryRequest.current += 1;
    };
  }, [refresh, room?.id]);

  const requireLogin = (targetRoomId?: string) => {
    if (username) return true;
    const destination = new URLSearchParams();
    if (targetRoomId || inviteId)
      destination.set('room', targetRoomId || inviteId);
    if (selectedFilm) destination.set('film', selectedFilm);
    if (activityReturn) destination.set('activityReturn', activityReturn);
    router.push(
      `/login?redirect=${encodeURIComponent(
        '/watch-room' + (destination.toString() ? `?${destination}` : '')
      )}`
    );
    return false;
  };
  const join = async (
    id: string,
    roomPassword?: string,
    replaceCurrent = false
  ) => {
    if (!requireLogin(id.trim())) return;
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
    // 自动重连旧房间留下的报错（如“房间不存在或已归档”）与这次操作无关
    watchRoom.clearError();
    try {
      await watchRoom.joinRoom({
        roomId: id.trim(),
        password: roomPassword,
        userName: username,
      });
      setDialog(null);
      // An invitation already has its room parameter; retain its other query values.
      if (inviteId !== id.trim()) router.replace(roomLocation(id.trim()));
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
    const target = room?.id;
    if (!target) return false;
    const operation = ++mutationOperation.current;
    const isCurrent = () =>
      operation === mutationOperation.current && target === activeRoom.current;
    setBusy(true);
    setError('');
    try {
      await watchRoom.roomCommand(event, { ...payload, roomId: target });
      return isCurrent();
    } catch (failure) {
      if (isCurrent())
        setError(failure instanceof Error ? failure.message : '操作未完成');
      return false;
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };
  const addFilm = async (href: string) => {
    const target = room?.id;
    if (!target) return;
    if (
      pickerAttempt.current?.roomId !== target ||
      pickerAttempt.current.href !== href
    )
      pickerAttempt.current = {
        roomId: target,
        href,
        commandId: crypto.randomUUID(),
      };
    if (
      (await mutate('queue:add', {
        ...queueItemFromHref(href),
        commandId: pickerAttempt.current.commandId,
      })) &&
      activeRoom.current === target
    ) {
      pickerAttempt.current = null;
      setDialog(null);
      // 只有正在放映时才需要说明“不会切换当前影片”
      setNotice(
        room?.currentState ? '已加入片单，当前影片继续播放' : '已加入片单'
      );
    }
  };
  const openCreate = () => {
    if (!requireLogin()) return;
    setError('');
    setDialog('create');
  };
  const create = async (values: RoomFormValues) => {
    if (room) {
      setError('先退出当前房间，再创建新房间；已有房间会保留。');
      return;
    }
    setBusy(true);
    setError('');
    watchRoom.clearError();
    try {
      const created = await watchRoom.createRoom({
        name: values.name.trim() || defaultRoomName(username),
        description: values.description,
        password: values.password || undefined,
        isPublic: values.isPublic,
        roomType: 'sync',
        userName: username,
        settings: {
          memberCanControl: values.memberCanControl,
          memberCanQueue: values.memberCanQueue,
        },
      });
      setDialog(null);
      router.replace(roomLocation(created.id));
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
      setCopiedInviteRoomId(room.id);
    } catch {
      setNotice(
        `邀请地址：${window.location.origin}/watch-room?room=${room.id}`
      );
    }
  };
  const openSettings = () => {
    if (!room) return;
    setError('');
    setDialog('settings');
  };
  const openPicker = (title = '') => {
    setPickerTitle(title);
    setDialog('picker');
  };
  const uploadCover = async (file?: File | null) => {
    if (!file) return;
    try {
      const image = await compressRoomCover(file);
      if (await mutate('room:cover', { image })) setNotice('封面已更新');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '封面上传失败');
    }
  };
  const removeCover = async () => {
    if (await mutate('room:cover', { image: null }))
      setNotice('已移除自定义封面');
  };
  const copyRoomId = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopiedRoomId(room.id);
    } catch {
      setNotice('房间号复制失败，请重试');
    }
  };
  const restore = async (id: string) => {
    if (externalServer) {
      setError(EXTERNAL_ROOM_SERVER_NOTICE);
      return;
    }
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
      mobileTitle={room ? '房间' : undefined}
      pageHasHeading
    >
      <PageContainer
        className='tm-rooms'
        data-screening={screening}
        data-joined={Boolean(room)}
        data-playing={room?.currentState?.type === 'play'}
      >
        {room && !watchRoom.isConnected && (
          <div className='tm-room-reconnecting' role='status'>
            重连中 · 影片继续播放
            {watchRoom.reconnectFailed && (
              <button onClick={watchRoom.manualReconnect}>重新连接</button>
            )}
          </div>
        )}
        <RoomHeader
          room={room}
          roomTitle={roomTitle}
          members={watchRoom.members}
          connected={watchRoom.isConnected}
          canControl={watchRoom.canControl}
          isOwner={watchRoom.isOwner}
          hostLabel={hostLabel}
          panelTab={panelTab}
          copiedRoomId={copiedRoomId}
          copiedInviteRoomId={copiedInviteRoomId}
          copyRoomId={() => void copyRoomId()}
          copyInvite={() => void copyInvite()}
          openSettings={openSettings}
          openCreate={openCreate}
          openJoin={() => {
            setJoinId(inviteId);
            setError('');
            setDialog('join');
          }}
          onToggleMembers={() =>
            setPanelTab((value) => (value === 'members' ? 'queue' : 'members'))
          }
          onLeave={() => {
            watchRoom.leaveRoom();
            router.replace('/watch-room');
          }}
        />
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
        {activityReturn && (
          <div className='tm-room-feedback'>
            <p>
              {room
                ? '房间已连接。返回已选内容，再明确共享到房间。'
                : '创建或加入房间后，可返回继续共享已选内容。'}
            </p>
            {room && (
              <Link className='tm-room-primary' href={activityReturn}>
                返回已选内容
              </Link>
            )}
          </div>
        )}
        {selectedFilm && (
          <div className='tm-room-feedback'>
            <p>
              已选择「{queueItemFromHref(selectedFilm).title}」。
              {room
                ? '确认片源后加入待看，当前影片继续。'
                : '创建或进入房间后继续选片。'}
            </p>
            {room && (
              <Link
                className='tm-room-primary'
                href={`/watch-room/select?${new URLSearchParams({
                  room: room.id,
                  film: selectedFilm,
                })}`}
              >
                添加这部到待看
              </Link>
            )}
          </div>
        )}
        {room ? (
          <div className='tm-room-workspace'>
            <RoomStage
              room={room}
              canControl={watchRoom.canControl}
              waitingQueue={waitingQueue}
              activityHref={activityHref}
              activityLabel={activityLabel}
              liveEnabled={liveEnabled}
              musicEnabled={musicEnabled}
              openPicker={() => openPicker()}
            />
            <RoomSidePanel
              room={room}
              members={watchRoom.members}
              selfId={watchRoom.socket?.id}
              username={username}
              canControl={watchRoom.canControl}
              isOwner={watchRoom.isOwner}
              isRoomAdmin={watchRoom.isRoomAdmin}
              busy={busy}
              panelTab={panelTab}
              onTabChange={setPanelTab}
              mutate={mutate}
              openPicker={() => openPicker()}
            />
            {room.currentState?.type === 'play' && (
              <RoomMediaInfo
                roomId={room.id}
                state={room.currentState}
                queue={room.queue || []}
              />
            )}
            <RoomQuickStart
              playing={Boolean(room.currentState)}
              onChoose={(title) =>
                router.push(
                  `/watch-room/select?${new URLSearchParams({
                    room: room.id,
                    q: title,
                  })}`
                )
              }
            />
          </div>
        ) : (
          <RoomDirectory
            username={username}
            directory={directory}
            setDirectory={setDirectory}
            setError={setError}
            rooms={rooms}
            loading={loading}
            busy={busy}
            refresh={refresh}
            join={(id) => void join(id)}
            restore={(id) => void restore(id)}
            openCreate={openCreate}
          />
        )}
        {dialog && (
          <RoomDialogShell
            title={
              dialog === 'create'
                ? '创建房间'
                : dialog === 'join'
                ? '加入朋友的房间'
                : dialog === 'picker'
                ? '添加影片'
                : '房间设置'
            }
            busy={busy}
            error={error}
            onClose={() => setDialog(null)}
          >
            {dialog === 'picker' ? (
              <RoomFilmPicker
                busy={busy}
                onAdd={addFilm}
                onPlayNow={
                  watchRoom.canControl
                    ? (href) => {
                        setDialog(null);
                        roomPlayback.playTogether(href);
                      }
                    : undefined
                }
                initialQuery={pickerTitle}
              />
            ) : dialog === 'join' ? (
              <JoinRoomForm
                initialId={joinId}
                currentRoom={room}
                username={username}
                busy={busy}
                onJoin={(id, roomPassword) => void join(id, roomPassword, true)}
              />
            ) : (
              <RoomForm
                key={dialog}
                mode={dialog}
                room={room}
                username={username}
                isStationAdmin={isStationAdmin}
                busy={busy}
                connected={watchRoom.isConnected}
                onSubmit={(values) => {
                  if (dialog === 'create') void create(values);
                  else
                    void mutate('room:settings', {
                      name: values.name,
                      description: values.description,
                      isPublic: values.isPublic,
                      memberCanControl: values.memberCanControl,
                      memberCanQueue: values.memberCanQueue,
                      ...(values.password ? { password: values.password } : {}),
                      ...(isStationAdmin
                        ? { autoArchive: values.autoArchive }
                        : {}),
                    }).then((ok) => {
                      if (ok) setDialog(null);
                    });
                }}
                onDelete={() =>
                  void mutate('room:delete', {}).then((ok) => {
                    if (ok) {
                      setDialog(null);
                      router.replace('/watch-room');
                    }
                  })
                }
                onUploadCover={(file) => void uploadCover(file)}
                onRemoveCover={() => void removeCover()}
              />
            )}
          </RoomDialogShell>
        )}
      </PageContainer>
    </PageLayout>
  );
}
