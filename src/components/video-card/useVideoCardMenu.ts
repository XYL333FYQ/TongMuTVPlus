'use client';

/*
 * 影片卡片的上映倒计时、卡片配置（按来源显示哪些按钮）、预告片选择、长按 / 右键菜单里的项。
 */

import { useCallback, useMemo } from 'react';

import { apiFetch } from '@/lib/api-client';

import { cardConfig } from './card-config';
import { buildMobileActions } from './mobile-actions';
import type { VideoCardActions } from './useVideoCardActions';
import type { VideoCardBase } from './useVideoCardBase';

export function useVideoCardMenu(vm: VideoCardBase & VideoCardActions) {
  const {
    from,
    tmdb_id,
    rate,
    isBangumi,
    origin,
    releaseDate,
    isUpcoming,
    setShowAnimeSubscribe,
    isAdminUser,
    resolvedIsAnime,
    actualTitle,
    favorited,
    setShowMobileActions,
    openExternal,
    externalMode,
    searchFavorited,
    setShowAIChat,
    aiEnabled,
    setShowDetailPanel,
    setShowTrailerPicker,
    setTrailerLoading,
    setTrailerError,
    setTrailerVideos,
    actualSource,
    actualId,
    actualDoubanId,
    actualYear,
    actualSearchType,
    handleToggleFavorite,
    handleDeleteRecord,
    handleClick,
    handlePlayInNewTab,
  } = vm;
  // 计算距离上映的天数（使用本地时区）
  const daysUntilRelease = useMemo(() => {
    if (!isUpcoming || !releaseDate) return null;

    // 获取今天的本地日期（午夜）
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 将日期字符串解析为本地时区的日期对象
    // 使用 'YYYY-MM-DD' 格式直接构造，避免 UTC 解析问题
    const [releaseYear, releaseMonth, releaseDay] = releaseDate
      .split('-')
      .map(Number);
    const release = new Date(releaseYear, releaseMonth - 1, releaseDay);

    const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
    const todayDate = new Date(todayYear, todayMonth - 1, todayDay);

    const diffTime = release.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }, [isUpcoming, releaseDate]);

  const config = useMemo(
    () => cardConfig(from, rate, isUpcoming),
    [from, rate, isUpcoming]
  );

  const upcomingReleaseText = useMemo(() => {
    if (!isUpcoming || daysUntilRelease === null) return undefined;
    if (daysUntilRelease > 0) return `${daysUntilRelease}天后上映`;
    if (daysUntilRelease === 0) return '今日上映';
    return '已上映';
  }, [isUpcoming, daysUntilRelease]);

  const openTrailerPicker = useCallback(async () => {
    if (!actualTitle) return;
    setShowMobileActions(false);
    setTrailerError(null);
    setTrailerLoading(true);
    setShowTrailerPicker(true);

    try {
      const params = new URLSearchParams();
      if (tmdb_id) params.set('id', String(tmdb_id));
      if (actualSearchType) params.set('type', actualSearchType);
      if (actualTitle) params.set('title', actualTitle);
      if (actualYear) params.set('year', actualYear);

      const res = await apiFetch(`/api/tmdb/videos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '获取预告片失败');
      }

      setTrailerVideos(data.videos || []);
    } catch (err) {
      setTrailerVideos([]);
      setTrailerError(err instanceof Error ? err.message : '获取预告片失败');
    } finally {
      setTrailerLoading(false);
    }
  }, [
    actualSearchType,
    actualTitle,
    actualYear,
    tmdb_id,
    setShowMobileActions,
    setShowTrailerPicker,
    setTrailerError,
    setTrailerLoading,
    setTrailerVideos,
  ]);

  // 移动端操作菜单配置
  const mobileActions = useMemo(
    () =>
      buildMobileActions({
        config,
        from,
        origin,
        externalMode,
        actualSource,
        actualId,
        favorited,
        searchFavorited,
        actualDoubanId,
        isBangumi,
        isUpcoming,
        actualTitle,
        aiEnabled,
        isAdminUser,
        resolvedIsAnime,
        handleClick,
        handlePlayInNewTab,
        handleToggleFavorite,
        handleDeleteRecord,
        openExternal,
        openTrailerPicker,
        setShowMobileActions,
        setShowDetailPanel,
        setShowAIChat,
        setShowAnimeSubscribe,
      }),
    [
      setShowAIChat,
      setShowAnimeSubscribe,
      setShowDetailPanel,
      setShowMobileActions,
      config,
      from,
      actualSource,
      actualId,
      favorited,
      searchFavorited,
      actualDoubanId,
      isBangumi,
      handleClick,
      handleToggleFavorite,
      handleDeleteRecord,
      handlePlayInNewTab,
      externalMode,
      openExternal,
      aiEnabled,
      actualTitle,
      isUpcoming,
      origin,
      openTrailerPicker,
      isAdminUser,
      resolvedIsAnime,
    ]
  );

  return {
    daysUntilRelease,
    config,
    upcomingReleaseText,
    openTrailerPicker,
    mobileActions,
  };
}
