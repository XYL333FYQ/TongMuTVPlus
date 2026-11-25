'use client';

/*
 * 自己看播放页的全部状态集中在这里：按原来的顺序依次调用各段（后一段只拿用到的前面的状态）。页面和各块画面只读它。
 */

import { usePlaybackControls } from './usePlaybackControls';
import { usePlaybackEngine } from './usePlaybackEngine';
import { usePlaybackEpisodeFlow } from './usePlaybackEpisodeFlow';
import { usePlaybackEpisodeSync } from './usePlaybackEpisodeSync';
import { usePlaybackFavorites } from './usePlaybackFavorites';
import { usePlaybackIdentity } from './usePlaybackIdentity';
import { usePlaybackLoad } from './usePlaybackLoad';
import { usePlaybackSession0 } from './usePlaybackSession0';
import { usePlaybackSourceActions } from './usePlaybackSourceActions';
import { usePlaybackSourceState } from './usePlaybackSourceState';
import { usePlaybackStreams } from './usePlaybackStreams';

export function usePlaybackPage() {
  const s0 = usePlaybackSession0();
  const s1 = usePlaybackIdentity({ ...s0 });
  const s2 = usePlaybackEpisodeSync({ ...s0, ...s1 });
  const s3 = usePlaybackStreams({ ...s0, ...s1, ...s2 });
  const s4 = usePlaybackSourceState();
  const s5 = usePlaybackEngine({ ...s0, ...s1, ...s2, ...s3, ...s4 });
  const s6 = usePlaybackSourceActions({
    ...s0,
    ...s1,
    ...s2,
    ...s3,
    ...s4,
    ...s5,
  });
  const s7 = usePlaybackLoad({
    ...s0,
    ...s1,
    ...s2,
    ...s3,
    ...s4,
    ...s5,
    ...s6,
  });
  const s8 = usePlaybackEpisodeFlow({
    ...s0,
    ...s1,
    ...s2,
    ...s3,
    ...s4,
    ...s5,
    ...s6,
    ...s7,
  });
  const s9 = usePlaybackControls({
    ...s0,
    ...s1,
    ...s2,
    ...s3,
    ...s4,
    ...s5,
    ...s6,
    ...s7,
    ...s8,
  });
  const s10 = usePlaybackFavorites({
    ...s0,
    ...s1,
    ...s2,
    ...s3,
    ...s4,
    ...s5,
    ...s6,
    ...s7,
    ...s8,
    ...s9,
  });
  return {
    ...s0,
    ...s1,
    ...s2,
    ...s3,
    ...s4,
    ...s5,
    ...s6,
    ...s7,
    ...s8,
    ...s9,
    ...s10,
  };
}

export type PlaybackPage = ReturnType<typeof usePlaybackPage>;
