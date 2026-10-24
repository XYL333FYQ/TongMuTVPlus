// 只认“最新一次”请求的结果：每次发起时领一个号，响应回来时号不是最新的就丢弃。
// 用于用户可以连续切换（直播源、频道、节目单）而旧请求晚到的场景。
export interface RequestGate {
  begin(): { isCurrent: () => boolean };
}

export function createRequestGate(): RequestGate {
  let latest = 0;
  return {
    begin() {
      const id = ++latest;
      return { isCurrent: () => id === latest };
    },
  };
}
