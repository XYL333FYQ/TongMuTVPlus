/*
 * 播放器内核（两边共用）：WatchPlayer + 通用插件。不依赖 React，也不认识房间或自己看。
 * 别的功能只从这里引用；core/ 下面是内部。
 */
export { playerEnvironment } from './core/env';
export { Anime4KController, checkWebGPU } from './core/plugins/anime4k';
export {
  iosOrientationPlugin,
  playbackRatePlugin,
  progressThumbPlugin,
  wakeLockPlugin,
} from './core/plugins/basics';
export { DanmakuController, type DanmakuState } from './core/plugins/danmaku';
export { heatmapPlugin, setHeatmapEnabled } from './core/plugins/heatmap';
export { bindKeyboard } from './core/plugins/keyboard';
export { LinkRefresher } from './core/plugins/link-refresh';
export {
  type SourceSubtitle,
  SubtitleController,
} from './core/plugins/subtitles';
export { type MediaType, isNetdiskMountSource } from './core/source-policy';
export {
  type Art,
  type PlayerPlugin,
  type WatchSource,
  PLAYBACK_RATES,
  WatchPlayer,
} from './core/WatchPlayer';
