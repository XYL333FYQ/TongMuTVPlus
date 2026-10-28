'use client';

import { useRoomLiveActivity } from './useRoomLiveActivity';

interface UseLiveSyncOptions {
  currentChannelId: string;
  currentChannelName: string;
  currentChannelUrl: string;
  onChannelChange?: (channelId: string, channelUrl: string) => void;
  isReady?: () => boolean;
}

export function useLiveSync(options: UseLiveSyncOptions) {
  const activity = useRoomLiveActivity({
    kind: 'iptv',
    selection:
      options.currentChannelId && options.currentChannelUrl
        ? {
            type: 'live',
            channelId: options.currentChannelId,
            channelName: options.currentChannelName,
            channelUrl: options.currentChannelUrl,
          }
        : null,
    onApply: (state) =>
      options.onChannelChange?.(state.channelId, state.channelUrl),
    isReady: options.isReady,
  });
  return { ...activity, broadcastChannelChange: activity.broadcast };
}
