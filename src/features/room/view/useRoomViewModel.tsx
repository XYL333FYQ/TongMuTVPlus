'use client';

/*
 * 房间页的状态和动作集中在这里：权限、排版档位、面板 / 侧栏标签、选片、邀请、设置、复制链接、发命令。画面各块（RoomHeader / RoomMain / RoomSide / RoomDialogs）只读它。
 */

import { Headphones, Mic, MicOff, VolumeOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { isHandheld } from '@/lib/device-tier';
import { useDeviceTier, usePageLayout } from '@/hooks/useDeviceTier';
import { useImmersiveShell } from '@/hooks/useImmersiveShell';

import { useWatchRoomContext } from '@/components/WatchRoomProvider';

import PlaylistPanel from './PlaylistPanel';
import {
  filmFromQueue,
  filmFromState,
  FilmRef,
  playChange,
} from '../lib/commands';
import { useRoomSession } from '../session/context';

import type { PlayState, Room, RoomPermission } from '@/types/watch-room';

export type Panel =
  | 'playlist'
  | 'members'
  | 'activities'
  | 'recs'
  | 'danmaku'
  | 'menu';

export type SideTab = 'chat' | 'playlist' | 'members' | 'activities';
export const SIDE_TABS: SideTab[] = [
  'chat',
  'playlist',
  'members',
  'activities',
];

export interface RoomViewProps {
  /** 当前房间（RoomRoute 只在有房间时渲染这一页） */
  current: Room;
  onLeave(): void;
  onBack(): void;
  /** 从站内其他地方带来的片名：打开选片并搜它 */
  pick?: string;
  onPickHandled?(): void;
}

export function useRoomViewModel({
  current,
  onLeave,
  onBack,
  pick,
  onPickHandled,
}: RoomViewProps) {
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

  return {
    current,
    onLeave,
    onBack,
    pick,
    onPickHandled,
    room,
    session,
    self,
    can,
    isOwner,
    layout,
    handheld,
    compact,
    tablet,
    panel,
    setPanel,
    tab,
    setTab,
    openPanel,
    picker,
    setPicker,
    settings,
    setSettings,
    invite,
    setInvite,
    copied,
    setCopied,
    busy,
    setBusy,
    error,
    setError,
    player,
    voice,
    command,
    state,
    onlineMembers,
    online,
    waiting,
    requests,
    act,
    playFilm,
    inviteUrl,
    copy,
    detail,
    total,
    poster,
    canPick,
    statusLabel,
    openPicker,
    micButton,
    speakerButton,
    playlist,
  };
}

export type RoomViewModel = ReturnType<typeof useRoomViewModel>;
