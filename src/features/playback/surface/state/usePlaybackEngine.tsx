'use client';

/*
 * 播放页状态（六）：进度保存、播放器内核（完整 / 小窗 / 收起共用一个实例）、切集写回地址。
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { useLatest } from '@/hooks/useLatest';

import { notify } from '@/components/feedback/AppDialogs';
import { useWatchRoomContextSafe } from '@/components/WatchRoomProvider';

import {
  type SourceSubtitle,
  SubtitleController,
  WatchPlayer,
} from '@/features/player';

import type { PlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import type { PlaybackIdentity } from './usePlaybackIdentity';
import type { PlaybackSession0 } from './usePlaybackSession0';
import type { PlaybackSourceState } from './usePlaybackSourceState';
import type { PlaybackStreams } from './usePlaybackStreams';

export function usePlaybackEngine(
  vm: PlaybackSession0 &
    PlaybackIdentity &
    PlaybackEpisodeSync &
    PlaybackStreams &
    PlaybackSourceState
) {
  const {
    artPlayerRef,
    router,
    searchParams,
    playbackSession,
    reportMedia,
    attachController,
    setMetadata,
    commitPlaybackHref,
    authInfo,
    loading,
    error,
    detail,
    videoTitle,
    videoYear,
    currentSource,
    currentId,
    searchTitle,
    currentEpisodeIndex,
    detailRef,
    currentEpisodeIndexRef,
    videoUrl,
    videoError,
    isVideoLoading,
    playerReady,
  } = vm;
  // 播放进度保存相关
  const lastSaveTimeRef = useRef<number>(0);
  const lastSavedPlayTimeRef = useRef<number | null>(null);

  const artRef = useRef<HTMLDivElement | null>(null);
  // 换集重建播放器前记住网页全屏状态，新播放器 ready 后恢复
  const restoreWebFullscreenOnReadyRef = useRef(false);
  // 播放器内核：实例在完整 / 小窗 / 收起之间保留，换集换源由它决定换地址还是重建
  const watchPlayerRef = useRef<WatchPlayer | null>(null);
  const stopKeyboardRef = useRef<(() => void) | null>(null);
  // 当前实例创建时的去广告开关（变了就要重建）
  const activeAdBlockRef = useRef<boolean | null>(null);
  const customSubtitleInputRef = useRef<HTMLInputElement | null>(null);
  // 字幕（内核 SubtitleController，和房间同一份）：片源字幕、本地上传、ASS/SSA、PGS/SUP
  const subtitlesRef = useRef<SubtitleController | null>(null);
  const subtitles = (subtitlesRef.current ??= new SubtitleController(
    (message, type) =>
      notify(message, type, type === 'info' ? { duration: 5000 } : {}),
    () => customSubtitleInputRef.current?.click()
  ));
  const episodeSubtitles = () =>
    (detailRef.current?.subtitles?.[currentEpisodeIndexRef.current] ||
      []) as SourceSubtitle[];

  const mediaReady = Boolean(
    playerReady && !isVideoLoading && !loading && videoUrl
  );
  const queueItemId = searchParams.get('queueId') || undefined;
  useEffect(() => {
    if (!currentSource || !currentId) {
      reportMedia(null);
      return;
    }
    reportMedia({
      source: currentSource,
      videoId: String(currentId),
      episode: currentEpisodeIndex + 1,
      videoName: videoTitle || detail?.title || '',
      videoYear: videoYear || detail?.year || '',
      searchTitle: searchTitle || '',
      poster: detail?.poster || '',
      url: videoUrl || '',
      queueItemId,
      ready: mediaReady,
    });
  }, [
    currentSource,
    currentId,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
    searchTitle,
    detail?.title,
    detail?.year,
    detail?.poster,
    videoUrl,
    queueItemId,
    mediaReady,
    reportMedia,
  ]);
  const reportMediaLatest = useLatest(reportMedia);
  useEffect(
    () => () => reportMediaLatest.current(null),
    // 卸载时清空：这个播放实例不再在放任何影片
    [reportMediaLatest]
  );
  const watchRoomContext = useWatchRoomContextSafe();
  useEffect(() => {
    if (!playerReady || !artPlayerRef.current) return;
    attachController(artPlayerRef.current);
    return () => attachController(null);
  }, [playerReady, attachController, artPlayerRef]);
  useEffect(() => {
    setMetadata({
      title: videoTitle || detail?.title || '正在准备影片',
      episode: currentEpisodeIndex + 1,
      poster: detail?.poster,
      loading,
      error: error || videoError,
      episodeTitles: Array.from(
        { length: detail?.episodes?.length || 0 },
        (_, index) => detail?.episodes_titles?.[index] || ''
      ),
    });
  }, [
    videoTitle,
    detail?.title,
    detail?.poster,
    detail?.episodes?.length,
    detail?.episodes_titles,
    currentEpisodeIndex,
    loading,
    error,
    videoError,
    setMetadata,
  ]);
  // 切集后把集数写回播放地址（不重建播放器）。否则地址仍是上一集：
  // 刷新、复制链接、带着当前影片开房间时都会被当成另一部片而重新加载。
  const commitPlaybackHrefLatest = useLatest(commitPlaybackHref);
  const playbackSessionLatest = useLatest(playbackSession);
  useEffect(() => {
    if (loading || !detail || !currentSource || !currentId) return;
    if (
      detail.source !== currentSource ||
      String(detail.id) !== String(currentId)
    )
      return;
    const current = new URL(
      playbackSessionLatest.current.href || '/play',
      window.location.origin
    );
    if (current.pathname !== '/play') return;
    const episode = String(currentEpisodeIndex + 1);
    if (current.searchParams.get('episode') === episode) return;
    current.searchParams.set('episode', episode);
    commitPlaybackHrefLatest.current(current);
  }, [
    currentEpisodeIndex,
    detail,
    currentSource,
    currentId,
    loading,
    commitPlaybackHrefLatest,
    playbackSessionLatest,
  ]);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const handleCreateWatchRoom = async () => {
    const watchRoom = watchRoomContext;
    if (watchRoom?.currentRoom) {
      router.push(
        `/watch-room?room=${encodeURIComponent(watchRoom.currentRoom.id)}`
      );
      return;
    }
    if (!watchRoom || !watchRoom.isConnected) {
      notify('观影室服务未连接', 'error', { duration: 3000 });
      return;
    }

    setIsCreatingRoom(true);
    try {
      const room = await watchRoom.createRoom({
        name: (videoTitle || detail?.title || '一起看').slice(0, 50),
        description: '',
        isPublic: false,
        roomType: 'sync',
        userName: authInfo?.username || '游客',
      });
      // 创建成功直接进房间页：同一个播放实例从整页变成房间里的画面，不会重建；
      // 空房间会自动接着这部影片和当前进度一起看（RoomPlaybackBridge）。
      router.push(`/watch-room?room=${encodeURIComponent(room.id)}`);
    } catch (error) {
      notify((error as Error | null)?.message || '创建观影室失败', 'error', {
        duration: 3000,
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // -----------------------------------------------------------------------------

  return {
    lastSaveTimeRef,
    lastSavedPlayTimeRef,
    artRef,
    restoreWebFullscreenOnReadyRef,
    watchPlayerRef,
    stopKeyboardRef,
    activeAdBlockRef,
    customSubtitleInputRef,
    subtitlesRef,
    subtitles,
    episodeSubtitles,
    mediaReady,
    queueItemId,
    reportMediaLatest,
    watchRoomContext,
    commitPlaybackHrefLatest,
    playbackSessionLatest,
    isCreatingRoom,
    setIsCreatingRoom,
    handleCreateWatchRoom,
  };
}

export type PlaybackEngine = ReturnType<typeof usePlaybackEngine>;
