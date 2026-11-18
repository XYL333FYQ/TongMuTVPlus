/*
 * 新播放器 -> 同步引擎需要的播放器接口。
 */

import type {
  PlayerEvent,
  PlayerPort,
} from '@/features/together/sync/sync-engine';
import type { WatchPlayer } from '@/features/together/player/core/WatchPlayer';

/** 视频暂停后等这么久，页面仍在前台才算用户暂停 */
export const BACKGROUND_PAUSE_GRACE_MS = 300;

export function portFor(player: WatchPlayer): PlayerPort {
  const video = () => player.video;
  return {
    get currentTime() {
      return player.currentTime;
    },
    get duration() {
      return Number(video()?.duration) || 0;
    },
    get paused() {
      return video()?.paused ?? true;
    },
    get ended() {
      return video()?.ended ?? false;
    },
    get readyState() {
      return video()?.readyState ?? 0;
    },
    get seeking() {
      return video()?.seeking ?? false;
    },
    get playbackRate() {
      return Number(player.art?.playbackRate) || 1;
    },
    get bufferedAhead() {
      const element = video();
      if (!element) return 0;
      const time = element.currentTime;
      const ranges = element.buffered;
      for (let index = 0; index < ranges.length; index++)
        if (ranges.start(index) <= time + 0.5 && ranges.end(index) > time)
          return ranges.end(index) - time;
      return 0;
    },
    // 自动播放被浏览器拦下要让同步引擎知道（它会提示“点击播放”）
    play: () => player.playOrThrow(),
    pause: () => player.pause(),
    seek: (time) => player.seek(time),
    setRate: (rate) => {
      if (player.art) player.art.playbackRate = rate;
    },
    notice: (message) => player.notice(message),
    on: (event: PlayerEvent, listener: () => void) => {
      // 播放器重建时视频元素会换：用会话级监听，重建后自动挂到新元素上
      const name =
        event === 'seeked'
          ? 'video:seeked'
          : event === 'ratechange'
          ? 'video:ratechange'
          : event === 'play'
          ? 'video:play'
          : 'video:pause';
      // 离开房间页时视频先被移出页面，浏览器会补发一个 pause：
      // 这不是用户操作，不能当成“暂停全房间”。
      // 页面转到后台（手机切应用、锁屏、切标签）时系统也会暂停视频，
      // 同样不是用户操作：以前一个人切后台，全房间都跟着停。回到前台时引擎会重新对齐。
      // 有的浏览器先暂停视频、稍后才把页面标成隐藏，所以暂停要等一小会儿再确认。
      if (event === 'pause') {
        let timer = 0;
        const off = player.on(name, () => {
          if (!player.video?.isConnected) return;
          if (document.visibilityState === 'hidden') return;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            const video = player.video;
            if (!video?.isConnected || !video.paused) return;
            if (document.visibilityState === 'hidden') return;
            // 解码 / 网络出错时浏览器会自己停下（播放器随后自动重连），也不是用户暂停：
            // 以前一个人的片源出错，全房间都被暂停
            if (video.error) return;
            listener();
          }, BACKGROUND_PAUSE_GRACE_MS);
        });
        return () => {
          window.clearTimeout(timer);
          off();
        };
      }
      return player.on(name, () => {
        if (player.video?.isConnected) listener();
      });
    },
  };
}
