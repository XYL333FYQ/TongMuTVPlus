'use client';

/*
 * 影片卡片的动作：收藏 / 取消收藏、删记录、点开播放、新标签页播放、搜索结果的收藏状态、长按菜单。
 */

import React, { useCallback, useMemo } from 'react';

import {
  deleteFavorite,
  deletePlayRecord,
  isFavorited,
  saveFavorite,
} from '@/lib/db.client';
import { filmPlaybackHref } from '@/lib/playback-links';
import { appendSpecialSourceParam } from '@/lib/special-source.client';
import { useLongPress } from '@/hooks/useLongPress';

import type { VideoCardBase } from './useVideoCardBase';

export function useVideoCardActions(vm: VideoCardBase) {
  const {
    source_name,
    from,
    onDelete,
    isAggregate,
    origin,
    isUpcoming,
    onBeforeNavigate,
    detailOnTouch,
    isDuanju,
    router,
    requestPlayback,
    actualTitle,
    actualPoster,
    favorited,
    setFavorited,
    showMobileActions,
    setShowMobileActions,
    openExternal,
    searchFavorited,
    setSearchFavorited,
    setShowDetailPanel,
    setShowUpcomingInfo,
    actualSource,
    actualId,
    actualEpisodes,
    actualYear,
    actualQuery,
    actualSearchType,
  } = vm;
  const handleToggleFavorite = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (from === 'douban' || !actualSource || !actualId) return;

      try {
        // 确定当前收藏状态
        const currentFavorited =
          from === 'search' ? searchFavorited : favorited;

        if (currentFavorited) {
          // 如果已收藏，删除收藏
          await deleteFavorite(actualSource, actualId);
          if (from === 'search') {
            setSearchFavorited(false);
          } else {
            setFavorited(false);
          }
        } else {
          // 如果未收藏，添加收藏
          await saveFavorite(actualSource, actualId, {
            title: actualTitle,
            source_name: source_name || '',
            year: actualYear || '',
            cover: actualPoster,
            total_episodes: actualEpisodes ?? 1,
            save_time: Date.now(),
          });
          if (from === 'search') {
            setSearchFavorited(true);
          } else {
            setFavorited(true);
          }
        }
      } catch (err) {
        throw new Error('切换收藏状态失败');
      }
    },
    [
      setFavorited,
      setSearchFavorited,
      from,
      actualSource,
      actualId,
      actualTitle,
      source_name,
      actualYear,
      actualPoster,
      actualEpisodes,
      favorited,
      searchFavorited,
    ]
  );

  const handleDeleteRecord = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (from !== 'playrecord' || !actualSource || !actualId) return;
      try {
        await deletePlayRecord(actualSource, actualId);
        onDelete?.();
      } catch (err) {
        throw new Error('删除播放记录失败');
      }
    },
    [from, actualSource, actualId, onDelete]
  );

  const selectedPlaybackHref = useMemo(() => {
    const searchOnly = from === 'douban' || from === 'tmdb';
    return appendSpecialSourceParam(
      filmPlaybackHref({
        title: actualTitle,
        source: searchOnly ? undefined : actualSource,
        id: searchOnly ? undefined : actualId,
        year: actualYear,
        searchType: actualSearchType,
        searchTitle: actualQuery,
        prefer: isAggregate,
        duanju: isDuanju,
      })
    );
  }, [
    from,
    actualTitle,
    actualSource,
    actualId,
    actualYear,
    actualSearchType,
    actualQuery,
    isAggregate,
    isDuanju,
  ]);

  const handleClick = useCallback(() => {
    if (isUpcoming) {
      setShowUpcomingInfo(true);
      setTimeout(() => setShowUpcomingInfo(false), 2000);
      return;
    }
    onBeforeNavigate?.();
    if (origin === 'live' && actualSource && actualId) {
      router.push(
        '/live?' +
          new URLSearchParams({
            source: actualSource.replace('live_', ''),
            id: actualId.replace('live_', ''),
          })
      );
    } else {
      if (
        window.location.pathname + window.location.search ===
        selectedPlaybackHref
      )
        requestPlayback?.(selectedPlaybackHref, 'user');
      else router.push(selectedPlaybackHref);
    }
  }, [
    setShowUpcomingInfo,
    isUpcoming,
    onBeforeNavigate,
    origin,
    actualSource,
    actualId,
    selectedPlaybackHref,
    requestPlayback,
    router,
  ]);

  // 新标签页播放处理函数
  const handlePlayInNewTab = useCallback(() => {
    // 即将上映的电影不跳转
    if (isUpcoming) {
      return;
    }

    onBeforeNavigate?.();

    if (origin === 'live' && actualSource && actualId) {
      // 直播内容跳转到直播页面
      const url = `/live?source=${actualSource.replace(
        'live_',
        ''
      )}&id=${actualId.replace('live_', '')}`;
      openExternal(url);
    } else if (
      from === 'douban' ||
      from === 'tmdb' ||
      (isAggregate && !actualSource && !actualId)
    ) {
      const url = appendSpecialSourceParam(
        `/play?title=${encodeURIComponent(actualTitle.trim())}${
          actualYear ? `&year=${actualYear}` : ''
        }${actualSearchType ? `&stype=${actualSearchType}` : ''}${
          isAggregate ? '&prefer=true' : ''
        }${
          actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
        }`
      );
      openExternal(url);
    } else if (actualSource && actualId) {
      const url = appendSpecialSourceParam(
        `/play?source=${actualSource}&id=${actualId}&title=${encodeURIComponent(
          actualTitle
        )}${actualYear ? `&year=${actualYear}` : ''}${
          isAggregate ? '&prefer=true' : ''
        }${
          actualQuery ? `&stitle=${encodeURIComponent(actualQuery.trim())}` : ''
        }${actualSearchType ? `&stype=${actualSearchType}` : ''}${
          isDuanju ? '&duanju=1' : ''
        }`
      );
      openExternal(url);
    }
  }, [
    isUpcoming,
    openExternal,
    origin,
    from,
    actualSource,
    actualId,
    actualTitle,
    actualYear,
    isAggregate,
    actualQuery,
    actualSearchType,
    onBeforeNavigate,
    isDuanju,
  ]);

  // 检查搜索结果的收藏状态
  const checkSearchFavoriteStatus = useCallback(async () => {
    if (
      from === 'search' &&
      !isAggregate &&
      actualSource &&
      actualId &&
      searchFavorited === null
    ) {
      try {
        const fav = await isFavorited(actualSource, actualId);
        setSearchFavorited(fav);
      } catch (err) {
        setSearchFavorited(false);
      }
    }
  }, [
    from,
    isAggregate,
    actualSource,
    actualId,
    searchFavorited,
    setSearchFavorited,
  ]);

  // 长按操作
  const handleLongPress = useCallback(() => {
    if (!showMobileActions) {
      // 防止重复触发
      // 立即显示菜单，避免等待数据加载导致动画卡顿
      setShowMobileActions(true);

      // 异步检查收藏状态，不阻塞菜单显示
      if (
        from === 'search' &&
        !isAggregate &&
        actualSource &&
        actualId &&
        searchFavorited === null
      ) {
        checkSearchFavoriteStatus();
      }
    }
  }, [
    setShowMobileActions,
    showMobileActions,
    from,
    isAggregate,
    actualSource,
    actualId,
    searchFavorited,
    checkSearchFavoriteStatus,
  ]);

  // 长按手势hook
  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: () => {
      if (detailOnTouch) setShowDetailPanel(true);
      else handleClick();
    }, // 首页触屏先进入详情，记录卡保留恢复播放
    longPressDelay: 500,
  });

  return {
    handleToggleFavorite,
    handleDeleteRecord,
    selectedPlaybackHref,
    handleClick,
    handlePlayInNewTab,
    checkSearchFavoriteStatus,
    handleLongPress,
    longPressProps,
  };
}

export type VideoCardActions = ReturnType<typeof useVideoCardActions>;
