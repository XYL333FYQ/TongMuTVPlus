/*
 * 新播放器 -> 同步引擎需要的播放器接口。
 */

import type { PlayerEvent, PlayerPort } from '@/features/room/sync/sync-engine';
import type { WatchPlayer } from '@/features/watch/player/WatchPlayer';

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
    play: () => player.play(),
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
      // 这不是用户操作，不能当成“暂停全房间”
      return player.on(name, () => {
        if (player.video?.isConnected) listener();
      });
    },
  };
}
