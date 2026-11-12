/**
 * 房间时钟：估计“服务器时间 - 本机时间”的偏差。
 *
 * 一起看的播放状态只记录“在服务器时间 updatedAt 时播放到 currentTime”，
 * 各端用自己的时钟推算此刻位置。两台设备的系统时钟可能差好几秒，
 * 因此用 NTP 的思路取往返最快的一次采样：offset = serverTime - (发出 + 往返/2)。
 */

let offset = 0;
let bestRoundTrip = Number.POSITIVE_INFINITY;
let sampledAt = 0;

export function roomServerNow() {
  return Date.now() + offset;
}

export function roomClockOffset() {
  return offset;
}

/** 只有在还没有精确采样时，才用快照里的 serverTime 粗略校准。 */
export function noteRoomServerTime(serverTime: number | undefined) {
  if (!serverTime || !Number.isFinite(serverTime)) return;
  if (bestRoundTrip !== Number.POSITIVE_INFINITY) return;
  offset = serverTime - Date.now();
}

export function recordRoomClockSample(
  sentAt: number,
  receivedAt: number,
  serverTime: number
) {
  const roundTrip = receivedAt - sentAt;
  if (!Number.isFinite(roundTrip) || roundTrip < 0 || roundTrip > 10000) return;
  // 旧的最佳采样过一段时间就失效（网络路径或系统时钟可能变化）。
  const stale = Date.now() - sampledAt > 5 * 60000;
  if (roundTrip <= bestRoundTrip || stale) {
    bestRoundTrip = roundTrip;
    sampledAt = Date.now();
    offset = serverTime - (sentAt + roundTrip / 2);
  }
}

interface ClockSocket {
  connected?: boolean;
  timeout: (ms: number) => {
    emit: (
      event: string,
      data: unknown,
      ack: (error: Error | null, reply?: { serverTime?: number }) => void
    ) => void;
  };
}

/** 连续采样几次，取往返最快的一次。 */
export async function syncRoomClock(socket: ClockSocket, samples = 5) {
  for (let index = 0; index < samples; index += 1) {
    if (!socket.connected) return;
    await new Promise<void>((resolve) => {
      const sentAt = Date.now();
      socket.timeout(3000).emit('time:sync', {}, (error, reply) => {
        if (!error && reply?.serverTime)
          recordRoomClockSample(sentAt, Date.now(), reply.serverTime);
        resolve();
      });
    });
  }
}

export function resetRoomClockForTests() {
  offset = 0;
  bestRoundTrip = Number.POSITIVE_INFINITY;
  sampledAt = 0;
}
