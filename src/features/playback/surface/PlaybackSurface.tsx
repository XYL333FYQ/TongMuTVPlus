/*
 * 自己看的播放页：取片源、选集、换源、弹幕面板、详情等页面状态，播放器交给内核 WatchPlayer。
 * 由 PlaybackSessionProvider 挂在根布局里，换页面不卸载（完整 / 小窗 / 收起是同一个实例）。
 */

'use client';

import { Suspense } from 'react';

import PageLayout from '@/components/PageLayout';

import PlaybackPageBody from './state/PlaybackPageBody';
import PlaybackPageOverlays from './state/PlaybackPageOverlays';
import { usePlaybackPage } from './state/usePlaybackPage';
import DanmakuSourceDialog from '../page/DanmakuSourceDialog';
import PlaybackFailure from '../page/PlaybackFailure';
import PlaybackLoading from '../page/PlaybackLoading';

function PlayPageClient() {
  const vm = usePlaybackPage();
  const {
    tmdbBackdrop,
    isWebFullscreen,
    danmaku,
    danmakuState,
    loading,
    initialLoadParams,
    loadingStage,
    loadingMessage,
    optimizationEnabled,
    error,
    videoTitle,
    searchTitle,
    hasCompletedSearchRequest,
    fallbackRecommendations,
  } = vm;

  if (loading) {
    return (
      <PageLayout activePath='/play' hideNavigation={isWebFullscreen}>
        <PlaybackLoading
          entry={initialLoadParams}
          stage={loadingStage}
          message={loadingMessage}
          optimizationEnabled={optimizationEnabled}
        />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/play' hideNavigation={isWebFullscreen}>
        <PlaybackFailure
          error={error}
          entry={initialLoadParams}
          stage={loadingStage}
          optimizationEnabled={optimizationEnabled}
          videoTitle={videoTitle}
          searchTitle={searchTitle}
          recommendations={
            hasCompletedSearchRequest ? fallbackRecommendations : []
          }
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play' hideNavigation={isWebFullscreen}>
      {/* TMDB背景图 */}
      {tmdbBackdrop && (
        <div
          className='tm-psurface-div-1'
          style={{
            backgroundImage: `url(${tmdbBackdrop})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(5px) brightness(0.7)',
          }}
        />
      )}
      {danmakuState.matches.length > 0 && (
        <DanmakuSourceDialog
          matches={danmakuState.matches}
          onSelect={(anime, index) => void danmaku.selectSource(anime, index)}
          onCancel={() => danmaku.dismissMatches()}
        />
      )}

      <PlaybackPageBody vm={vm} />

      <PlaybackPageOverlays vm={vm} />
    </PageLayout>
  );
}

export default function PlaybackSurface() {
  return (
    <Suspense
      fallback={
        <div className='tm-public-feedback' role='status'>
          正在加载播放器…
        </div>
      }
    >
      <PlayPageClient />
    </Suspense>
  );
}
