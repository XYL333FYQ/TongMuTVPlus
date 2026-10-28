'use client';

import {
  parseWebLiveReference,
  webLiveReference,
} from '@/features/playback/room-live';

import { useRoomLiveActivity } from './useRoomLiveActivity';

interface UseWebLiveSyncOptions {
  currentSourceKey: string;
  currentSourceName: string;
  currentSourcePlatform: string;
  currentSourceRoomId: string;
  onSourceChange?: (
    sourceKey: string,
    platform: string,
    roomId: string
  ) => void;
  isReady?: () => boolean;
}

export function useWebLiveSync(options: UseWebLiveSyncOptions) {
  const activity = useRoomLiveActivity({
    kind: 'web',
    selection:
      options.currentSourceKey &&
      options.currentSourcePlatform &&
      options.currentSourceRoomId
        ? {
            type: 'live',
            channelId: options.currentSourceKey,
            channelName: options.currentSourceName,
            channelUrl: webLiveReference(
              options.currentSourcePlatform,
              options.currentSourceRoomId
            ),
          }
        : null,
    onApply: (state) => {
      const source = parseWebLiveReference(state);
      if (source)
        options.onSourceChange?.(
          state.channelId,
          source.platform,
          source.roomId
        );
    },
    isReady: options.isReady,
  });
  return { ...activity, broadcastSourceChange: activity.broadcast };
}
