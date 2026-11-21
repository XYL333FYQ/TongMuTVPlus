/*
 * 自己看（播放页）对外的入口。根布局直接用 PlaybackSessionProvider、PlaybackRoute 和 playback.css；
 * 别的页面（电视版播放页）只从这里引用。
 */
export { useStandalonePlayback } from './session/useStandalonePlayback';
