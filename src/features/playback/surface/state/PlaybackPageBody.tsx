'use client';

/*
 * 播放页主体：标题、画面和选集、电脑右侧图标栏、详情 / 评论 / 推荐、手机底部操作坞。
 */

'use client';

import EpisodeSelector from '@/components/EpisodeSelector';
import SmartRecommendations from '@/components/SmartRecommendations';

import type { PlaybackPage } from './usePlaybackPage';
import EpisodePanel from '../../page/EpisodePanel';
import PlaybackComments from '../../page/PlaybackComments';
import PlaybackDetail from '../../page/PlaybackDetail';
import PlaybackDock from '../../page/PlaybackDock';
import PlaybackRail from '../../page/PlaybackRail';
import PlaybackTitle from '../../page/PlaybackTitle';
import PlaybackTools from '../../page/PlaybackTools';
import VideoOverlays from '../../page/VideoOverlays';

export default function PlaybackPageBody({ vm }: { vm: PlaybackPage }) {
  const {
    artPlayerRef,
    enableComments,
    enableAIComments,
    detail,
    tmdbBackdrop,
    netdiskSearchEnabled,
    aiEnabled,
    setShowShortcutDialog,
    openDrawer,
    externalPlayerAdBlock,
    danmaku,
    danmakuState,
    episodeFilterConfig,
    setEpisodeFilterConfig,
    showToast,
    isTranscoding,
    videoTitle,
    videoYear,
    videoCover,
    videoDoubanId,
    doubanRating,
    doubanCardSubtitle,
    doubanAka,
    doubanYear,
    correctedDesc,
    netdiskTMDBMeta,
    currentSource,
    currentId,
    isDirectPlay,
    isNetdiskMountSource,
    searchTitle,
    episodeProgressContentKey,
    currentEpisodeIndex,
    totalEpisodes,
    richEpisodeNames,
    videoUrl,
    setVideoUrl,
    playbackSourceBadge,
    isHarmonyOS,
    harmonyHlsPlaybackMode,
    proxyAttemptedRef,
    corsFailedUrl,
    setCorsFailedUrl,
    videoError,
    setVideoError,
    videoLoadingStage,
    isVideoLoading,
    setIsVideoLoading,
    supportsNativeHls,
    netdiskHlsPlaybackMode,
    isRefreshingUrl,
    sourceProxyMode,
    handleCreateTranscodeSession,
    showExternalTranscodeButton,
    shouldShowEpisodeLabel,
    episodeLabel,
    availableSources,
    sourceSearchLoading,
    sourceSearchError,
    backgroundSourcesLoading,
    precomputedVideoInfo,
    currentSourceVideoInfo,
    isEpisodeSelectorCollapsed,
    soloSheet,
    setSoloSheet,
    soloRail,
    selectorRequest,
    openSoloSheet,
    selectSoloRail,
    setShowDownloadSelector,
    addDirectplayProxyDomain,
    artRef,
    watchRoomContext,
    isCreatingRoom,
    handleCreateWatchRoom,
    fetchCurrentSourceVideoInfo,
    switchHarmonyHlsPlaybackMode,
    switchNetdiskHlsPlaybackMode,
    toggleToolbarAdBlock,
    handleSourceChange,
    handleEpisodeChange,
    favorited,
    handleToggleFavorite,
  } = vm;
  return (
    <>
      <div className='tm-page-container tm-psurface-div-2 tm-solo-page'>
        {/* 第一行：影片标题 */}
        <PlaybackTitle
          detail={detail}
          videoTitle={videoTitle}
          videoYear={videoYear}
          doubanYear={doubanYear}
          doubanRating={doubanRating}
          episodeLabel={shouldShowEpisodeLabel ? episodeLabel : null}
          sourceBadge={playbackSourceBadge}
          onArt={!!tmdbBackdrop}
          totalEpisodes={totalEpisodes}
        />
        {/* 第二行：播放器和选集 */}
        <div className='tm-psurface-div-3 tm-solo-row'>
          <div
            // 手机 / 平板上和标题之间留 8px（电脑档不留，见 PlaybackSurface.css）
            className={`tm-psurface-div-4 ${
              isEpisodeSelectorCollapsed
                ? 'tm-psurface-div-5'
                : 'tm-psurface-div-6'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`tm-psurface-div-7 ${
                isEpisodeSelectorCollapsed
                  ? 'tm-psurface-div-8'
                  : 'tm-psurface-div-9'
              }`}
            >
              {/* 播放器容器 */}
              <div className='tm-playback-video-frame tm-psurface-div-10'>
                <div
                  ref={artRef}
                  data-tm-player-mount
                  className='tm-psurface-div-11'
                ></div>

                <VideoOverlays
                  loading={isVideoLoading}
                  stage={videoLoadingStage}
                  error={videoError}
                  canUseProxy={
                    !proxyAttemptedRef.current &&
                    Boolean(
                      corsFailedUrl ||
                        (isDirectPlay &&
                          videoUrl &&
                          !videoUrl.includes('/api/proxy-m3u8'))
                    )
                  }
                  onRetry={() => {
                    setVideoError(null);
                    setIsVideoLoading(true);
                    // 重新加载视频
                    if (artPlayerRef.current) {
                      artPlayerRef.current.url = videoUrl;
                    }
                  }}
                  onUseProxy={() => {
                    const originalUrl = corsFailedUrl || videoUrl;
                    // 记忆域名到 localStorage
                    addDirectplayProxyDomain(originalUrl);
                    const proxyUrl = `/api/proxy-m3u8?url=${encodeURIComponent(
                      originalUrl
                    )}&source=directplay`;
                    // 清除错误状态并重新播放
                    setVideoError(null);
                    setCorsFailedUrl(null);
                    setIsVideoLoading(true);
                    proxyAttemptedRef.current = true;
                    setVideoUrl(proxyUrl);
                  }}
                  refreshingLink={isRefreshingUrl}
                  danmakuLoading={danmakuState.loading}
                  danmakuCount={danmakuState.count}
                  danmakuOriginalCount={danmakuState.originalCount}
                />
              </div>

              {videoUrl && (
                <PlaybackTools
                  open={soloSheet === 'tools'}
                  onClose={() => setSoloSheet(null)}
                  videoUrl={videoUrl}
                  originalUrl={
                    // 代理播放时交出原始地址
                    sourceProxyMode &&
                    detail?.episodes &&
                    currentEpisodeIndex < detail.episodes.length
                      ? detail.episodes[currentEpisodeIndex]
                      : videoUrl
                  }
                  currentSource={currentSource}
                  videoTitle={videoTitle}
                  externalPlayerAdBlock={externalPlayerAdBlock}
                  onToggleAdBlock={toggleToolbarAdBlock}
                  onDownload={() => setShowDownloadSelector(true)}
                  onShowShortcuts={() => setShowShortcutDialog(true)}
                  roomEntry={
                    watchRoomContext?.isEnabled && watchRoomContext.isConnected
                      ? watchRoomContext.currentRoom
                        ? 'return'
                        : 'create'
                      : null
                  }
                  creatingRoom={isCreatingRoom}
                  onRoom={() => void handleCreateWatchRoom()}
                  canTranscode={showExternalTranscodeButton}
                  transcoding={isTranscoding}
                  onTranscode={handleCreateTranscodeSession}
                  harmonyMode={isHarmonyOS ? harmonyHlsPlaybackMode : null}
                  onHarmonyMode={switchHarmonyHlsPlaybackMode}
                  netdiskMode={
                    isNetdiskMountSource(currentSource) && supportsNativeHls
                      ? netdiskHlsPlaybackMode
                      : null
                  }
                  onNetdiskMode={switchNetdiskHlsPlaybackMode}
                  showToast={showToast}
                />
              )}
            </div>

            {/* 选集和换源 - 在移动端始终显示，在电脑上可折叠 */}
            <EpisodePanel
              open={Boolean(soloSheet && soloSheet !== 'tools')}
              collapsed={isEpisodeSelectorCollapsed}
              onClose={() => setSoloSheet(null)}
            >
              <EpisodeSelector
                requestedTab={selectorRequest}
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                richEpisodeNames={richEpisodeNames}
                value={currentEpisodeIndex + 1}
                onChange={(episodeNumber: number) => {
                  handleEpisodeChange(episodeNumber);
                  setSoloSheet(null);
                }}
                onSourceChange={handleSourceChange}
                isRoomMember={false}
                currentSource={currentSource}
                currentId={currentId}
                episodeProgressContentKey={
                  episodeProgressContentKey || undefined
                }
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                backgroundSourcesLoading={backgroundSourcesLoading}
                precomputedVideoInfo={precomputedVideoInfo}
                useLightTextOnBackdrop={!!tmdbBackdrop}
                onDanmakuSelect={(selection) =>
                  void danmaku.select(selection, true)
                }
                onDanmakuEpisodesLoaded={(episodes) =>
                  danmaku.setEpisodes(episodes)
                }
                currentDanmakuSelection={danmakuState.selection}
                onUploadDanmaku={(comments) => void danmaku.upload(comments)}
                episodeFilterConfig={episodeFilterConfig}
                onFilterConfigUpdate={setEpisodeFilterConfig}
                onShowToast={showToast}
              />
            </EpisodePanel>
          </div>

          {/* 电脑：右侧图标栏，选集 / 换源 / 弹幕开合右边的面板，其余打开抽屉 */}
          <PlaybackRail
            activePanel={isEpisodeSelectorCollapsed ? null : soloRail}
            onPanel={selectSoloRail}
            showTools={Boolean(videoUrl)}
            toolsOpen={soloSheet === 'tools'}
            onToggleTools={() =>
              setSoloSheet(soloSheet === 'tools' ? null : 'tools')
            }
            showDetail={Boolean(detail)}
            showAiChat={Boolean(aiEnabled && detail)}
            showNetdisk={netdiskSearchEnabled}
            onDrawer={openDrawer}
            onShortcuts={() => setShowShortcutDialog(true)}
          />
        </div>

        <PlaybackDock
          sheetOpen={Boolean(soloSheet)}
          onOpen={openSoloSheet}
          onClose={() => setSoloSheet(null)}
          episodeHint={
            totalEpisodes > 1 ? `第 ${currentEpisodeIndex + 1} 集` : '正片'
          }
          sourceName={detail?.source_name || '片源'}
          danmakuCount={danmakuState.count}
          showTools={Boolean(videoUrl)}
          detailHint={
            detail
              ? doubanRating && doubanRating.value > 0
                ? `豆瓣 ${doubanRating.value.toFixed(1)}`
                : '简介'
              : null
          }
          onDetail={() => openDrawer('detail')}
        />

        {!isDirectPlay && (
          <>
            {/* 详情展示 */}
            <PlaybackDetail
              detail={detail}
              videoTitle={videoTitle}
              videoYear={videoYear}
              videoCover={videoCover}
              videoDoubanId={videoDoubanId}
              doubanYear={doubanYear}
              doubanAka={doubanAka}
              doubanCardSubtitle={doubanCardSubtitle}
              doubanRating={doubanRating}
              correctedDesc={correctedDesc}
              netdiskTMDBMeta={netdiskTMDBMeta}
              sourceInfo={currentSourceVideoInfo}
              onSourceInfo={() => void fetchCurrentSourceVideoInfo()}
              favorited={favorited}
              onToggleFavorite={() => void handleToggleFavorite()}
              aiEnabled={aiEnabled}
              netdiskSearchEnabled={netdiskSearchEnabled}
              onDrawer={openDrawer}
              onArt={!!tmdbBackdrop}
            />

            {/* 推荐区域 */}
            <SmartRecommendations
              doubanId={videoDoubanId !== 0 ? videoDoubanId : undefined}
              videoTitle={videoTitle}
            />

            <PlaybackComments
              enableAIComments={enableAIComments}
              enableComments={enableComments}
              videoDoubanId={videoDoubanId}
              videoTitle={videoTitle}
            />
          </>
        )}
      </div>
    </>
  );
}
