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

/**
 * 房间号本身就是邀请凭据的一半（还需要账号登录 / 可选密码），只有 12 位，
 * 截断显示反而让人没法口头告诉朋友。按 4 位分组完整显示，过长的才截断。
 */
export function maskedRoomId(id: string) {
  if (id.length <= 16) return id.match(/.{1,4}/g)?.join(' ') || id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** 选集按钮上的字：标题是“第 3 集 / EP03 / 03”时只显示数字，否则显示原标题 */
export function episodeLabel(title: string | undefined, index: number) {
  if (!title) return String(index + 1);
  const match =
    title.match(/^(?:第\s*)?0*(\d+)\s*(?:集|话|話)?$/) ||
    title.match(/^EP?\s*0*(\d+)$/i);
  return match ? match[1] : title;
}
