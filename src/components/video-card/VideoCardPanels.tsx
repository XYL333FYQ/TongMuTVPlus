'use client';

/*
 * 卡片打开的面板：操作菜单、预告片、AI 问片、详情、追番订阅、提示、看大图
 */

import React from 'react';

import { queuePlaybackHref, roomSelectionHref } from '@/lib/playback-links';

import AIChatPanel from '@/components/AIChatPanel.lazy';
import AnimeSubscribeModal from '@/components/AnimeSubscribeModal';
import DetailPanel from '@/components/DetailPanel';
import ImageViewer from '@/components/feedback/ImageViewer';
import MobileActionSheet from '@/components/feedback/MobileActionSheet';
import TrailerPickerDialog from '@/components/TrailerPickerDialog';

import type { VideoCardModel } from './useVideoCardModel';

export default function VideoCardPanels({ vm }: { vm: VideoCardModel }) {
  const {
    id,
    source,
    source_name,
    from,
    currentEpisode,
    tmdb_id,
    isBangumi,
    isAggregate,
    origin,
    seasonNumber,
    cmsData,
    router,
    showAnimeSubscribe,
    setShowAnimeSubscribe,
    animeSubscribeToast,
    setAnimeSubscribeToast,
    actualTitle,
    actualPoster,
    favorited,
    showMobileActions,
    setShowMobileActions,
    openExternal,
    searchFavorited,
    showAIChat,
    setShowAIChat,
    isAIStreaming,
    setIsAIStreaming,
    aiEnabled,
    aiDefaultMessageWithVideo,
    showDetailPanel,
    setShowDetailPanel,
    detailTriggerRef,
    showImageViewer,
    setShowImageViewer,
    showTrailerPicker,
    setShowTrailerPicker,
    trailerLoading,
    trailerError,
    trailerVideos,
    displayPoster,
    dynamicSourceNames,
    actualSource,
    actualId,
    actualDoubanId,
    actualEpisodes,
    actualYear,
    actualSearchType,
    directLinkUrl,
    handleToggleFavorite,
    selectedPlaybackHref,
    handleClick,
    upcomingReleaseText,
    openTrailerPicker,
    mobileActions,
  } = vm;
  return (
    <>
      {/* 操作菜单 - 支持右键和长按触发 */}
      <MobileActionSheet
        isOpen={showMobileActions}
        onClose={() => setShowMobileActions(false)}
        title={actualTitle}
        poster={displayPoster}
        actions={mobileActions}
        sources={
          isAggregate && dynamicSourceNames
            ? Array.from(new Set(dynamicSourceNames))
            : undefined
        }
        isAggregate={isAggregate}
        sourceName={cmsData ? undefined : source_name}
        directLinkUrl={directLinkUrl || undefined}
        currentEpisode={currentEpisode}
        totalEpisodes={actualEpisodes}
        origin={origin}
        description={upcomingReleaseText}
        onPosterClick={() => {
          setShowImageViewer(true);
        }}
      />

      <TrailerPickerDialog
        isOpen={showTrailerPicker}
        title={actualTitle}
        loading={trailerLoading}
        error={trailerError}
        videos={trailerVideos}
        onClose={() => setShowTrailerPicker(false)}
        onRetry={openTrailerPicker}
        onSelect={(video) => {
          openExternal(`https://www.youtube.com/watch?v=${video.key}`);
          setShowTrailerPicker(false);
        }}
      />

      {/* AI问片面板 - 只在打开或正在流式响应时渲染 */}
      {aiEnabled && (showAIChat || isAIStreaming) && (
        <AIChatPanel
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
          onStreamingChange={setIsAIStreaming}
          context={{
            title: actualTitle,
            year: actualYear,
            douban_id: actualDoubanId,
            tmdb_id,
            type: actualSearchType as 'movie' | 'tv',
            currentEpisode,
          }}
          welcomeMessage={
            aiDefaultMessageWithVideo
              ? aiDefaultMessageWithVideo.replace('{title}', actualTitle || '')
              : `想了解《${actualTitle}》的更多信息吗？我可以帮你查询剧情、演员、评价等。`
          }
        />
      )}

      {/* 详情面板 */}
      {showDetailPanel && (
        <DetailPanel
          isOpen={showDetailPanel}
          returnFocusRef={detailTriggerRef}
          onClose={() => setShowDetailPanel(false)}
          title={actualTitle}
          poster={displayPoster}
          doubanId={actualDoubanId}
          bangumiId={isBangumi ? actualDoubanId : undefined}
          isBangumi={isBangumi}
          tmdbId={tmdb_id}
          type={actualSearchType as 'movie' | 'tv'}
          year={actualYear}
          seasonNumber={seasonNumber}
          currentEpisode={currentEpisode}
          cmsData={cmsData}
          sourceId={id}
          source={source}
          onPlay={handleClick}
          onWatchInRoom={() =>
            router.push(
              roomSelectionHref(
                queuePlaybackHref(selectedPlaybackHref, currentEpisode || 1)
              )
            )
          }
          onFavorite={
            from !== 'douban' && from !== 'tmdb' && actualSource && actualId
              ? handleToggleFavorite
              : undefined
          }
          favorited={from === 'search' ? searchFavorited === true : favorited}
        />
      )}

      {/* 添加追番订阅（管理员） */}
      <AnimeSubscribeModal
        isOpen={showAnimeSubscribe}
        onClose={() => setShowAnimeSubscribe(false)}
        initialTitle={actualTitle}
        initialLastEpisode={
          from === 'playrecord' && currentEpisode ? currentEpisode : 0
        }
        onSuccess={() => {
          setAnimeSubscribeToast('已添加追番订阅');
          window.setTimeout(() => setAnimeSubscribeToast(''), 2500);
        }}
      />
      {animeSubscribeToast ? (
        <div className='tm-video-card-toast'>{animeSubscribeToast}</div>
      ) : null}

      {/* 图片查看器 */}
      {showImageViewer && (
        <ImageViewer
          isOpen={showImageViewer}
          onClose={() => setShowImageViewer(false)}
          imageUrl={actualPoster}
          alt={actualTitle}
        />
      )}
    </>
  );
}
