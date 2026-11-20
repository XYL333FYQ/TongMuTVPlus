/*
 * 播放器内核（两边共用）：WatchPlayer + 通用插件。不依赖 React，也不认识房间或自己看。
 * 别的功能只从这里引用；core/ 下面是内部。
 */
export {
  iosOrientationPlugin,
  playbackRatePlugin,
  progressThumbPlugin,
  wakeLockPlugin,
} from './core/plugins/basics';
export { DanmakuController } from './core/plugins/danmaku';
export { heatmapPlugin } from './core/plugins/heatmap';
export { bindKeyboard } from './core/plugins/keyboard';
export {
  type SourceSubtitle,
  SubtitleController,
} from './core/plugins/subtitles';
export type { MediaType } from './core/source-policy';
export {
  type Art,
  type PlayerPlugin,
  PLAYBACK_RATES,
  WatchPlayer,
} from './core/WatchPlayer';
