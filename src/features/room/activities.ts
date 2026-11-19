// 直播、网络直播、音乐页在房间里使用的“房间活动”入口。
export { webLiveReference } from './activities/room-live';
export { default as RoomActivityActions } from './activities/RoomActivityActions';
export { RoomLiveMessages } from './activities/RoomLiveMessages';
export { useLiveSync } from './hooks/useLiveSync';
export { useRoomMusicActivity } from './hooks/useRoomMusicActivity';
export { useWebLiveSync } from './hooks/useWebLiveSync';
