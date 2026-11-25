'use client';

/*
 * 播放页浮在上面的东西：提示、下载选集、弹幕过滤、快捷键说明、网盘搜索、抽屉（AI / 纠错 / 详情）。
 */

'use client';

import { CUSTOM_SUBTITLE_ACCEPT } from '@/lib/subtitle-converter';

import DanmakuFilterSettings from '@/components/DanmakuFilterSettings';
import DownloadEpisodeSelector from '@/components/DownloadEpisodeSelector';
import { notify } from '@/components/feedback/AppDialogs';

import type { PlaybackPage } from './usePlaybackPage';
import PansouDialog from '../../page/PansouDialog';
import PlaybackDrawers from '../../page/PlaybackDrawers';
import ShortcutDialog from '../../page/ShortcutDialog';

export default function PlaybackPageOverlays({ vm }: { vm: PlaybackPage }) {
  const {
    enableOfflineDownload,
    hasOfflinePermission,
    detail,
    aiEnabled,
    aiDefaultMessageWithVideo,
    showShortcutDialog,
    setShowShortcutDialog,
    isLargeScreen,
    drawers,
    danmaku,
    showDanmakuFilterSettings,
    setShowDanmakuFilterSettings,
    videoTitle,
    videoDoubanId,
    currentEpisodeIndex,
    totalEpisodes,
    showDownloadSelector,
    setShowDownloadSelector,
    customSubtitleInputRef,
    subtitles,
    handleDownloadEpisode,
    handleCorrectSuccess,
  } = vm;
  return (
    <>
      {/* Toast通知 */}

      <input
        ref={customSubtitleInputRef}
        type='file'
        accept={CUSTOM_SUBTITLE_ACCEPT}
        className='tm-psurface-input-1'
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void subtitles.loadFile(file);
        }}
      />

      {/* 下载选集面板 */}
      <DownloadEpisodeSelector
        isOpen={showDownloadSelector}
        onClose={() => setShowDownloadSelector(false)}
        totalEpisodes={totalEpisodes}
        episodesTitles={detail?.episodes_titles || []}
        videoTitle={videoTitle}
        currentEpisodeIndex={currentEpisodeIndex}
        onDownload={handleDownloadEpisode}
        enableOfflineDownload={enableOfflineDownload}
        hasOfflinePermission={hasOfflinePermission}
      />

      {/* 弹幕过滤设置对话框 */}
      <DanmakuFilterSettings
        isOpen={showDanmakuFilterSettings}
        onClose={() => setShowDanmakuFilterSettings(false)}
        onConfigUpdate={(config) => {
          // 新规则马上作用到屏幕上的弹幕
          danmaku.setFilter(config);
          try {
            danmaku.plugin?.load();
          } catch {
            // 插件还没就绪
          }
        }}
        onShowToast={(message, type) => {
          notify(message, type);
        }}
      />

      {showShortcutDialog && (
        <ShortcutDialog onClose={() => setShowShortcutDialog(false)} />
      )}

      {drawers.open.pansou && (
        <PansouDialog
          keyword={detail?.title || ''}
          drawer={isLargeScreen}
          onClose={() => drawers.close('pansou')}
        />
      )}

      <PlaybackDrawers
        open={drawers.open}
        onClose={drawers.close}
        drawerMode={isLargeScreen}
        detail={detail}
        videoDoubanId={videoDoubanId}
        currentEpisode={currentEpisodeIndex + 1}
        aiEnabled={aiEnabled}
        aiWelcomeTemplate={aiDefaultMessageWithVideo}
        onCorrected={handleCorrectSuccess}
      />
    </>
  );
}
