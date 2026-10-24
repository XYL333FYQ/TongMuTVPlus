type RoomLabel = {
  id: string;
  name: string;
  ownerName?: string;
  ownerAccountId?: string;
};

const identifier = (value: string) =>
  !value || /^\+?[\d\s()-]{7,}$/.test(value) || /^[a-f\d]{12,}$/i.test(value);

export function defaultRoomName(userName: string) {
  return identifier(userName) ? '我的放映室' : `${userName} 的放映室`;
}

/** 只转换标题显示，不重写用户已经保存的房名。 */
export function displayRoomName(room: RoomLabel) {
  if (
    identifier(room.name) ||
    room.name === room.id ||
    room.name === room.ownerAccountId
  ) {
    return defaultRoomName(room.ownerName || room.ownerAccountId || '');
  }
  return room.name;
}

export function maskedRoomId(id: string) {
  const visible = id.length > 8 ? 4 : 2;
  return `${id.slice(0, visible)}…${id.slice(-visible)}`;
}
