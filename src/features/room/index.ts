// 一起看对外的轻量入口：纯函数，不带组件和样式，首页等地方引用它不会把房间界面打进包里。
// 页面入口另有：RoomRoute（房间页）、RoomSession（根布局里的全站房间会话）、
// MusicPage / ScreenSharePage（房间活动页）、activities（直播、音乐页用的房间活动）。
export {
  EXTERNAL_ROOM_SERVER_NOTICE,
  isExternalRoomServer,
} from './lib/external-room-server';
export { roomCoverSource } from './lib/room-cover';
export { displayRoomName } from './lib/room-presentation';
