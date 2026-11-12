/** Port of synctv-app v1.1.32 SyncedClock and RealtimeReconnectPolicy (Apache-2.0). */
export class SyncedClock {
  offsetMillis = 0;
  roundTripMillis: number | null = null;
  constructor(private localNow: () => number = Date.now) {}
  now() {
    return this.localNow() + this.offsetMillis;
  }
  sample(
    clientSent: string,
    clientReceived: string,
    serverReceived: string,
    serverSent: string
  ) {
    try {
      if (
        ![clientSent, clientReceived, serverReceived, serverSent].every(
          (value) => /^\d{1,20}$/.test(value)
        )
      )
        return false;
      const [t1, t4, t2, t3] = [
        clientSent,
        clientReceived,
        serverReceived,
        serverSent,
      ].map(BigInt);
      const zero = BigInt(0);
      if ([t1, t4, t2, t3].some((value) => value <= zero) || t4 < t1 || t3 < t2)
        return false;
      const roundTrip = t4 - t1 - (t3 - t2);
      if (roundTrip < zero) return false;
      const offsetNanos = (t2 - t1 + t3 - t4) / BigInt(2);
      // Convert differences, never epoch nanoseconds, to Number.
      const offsetMicros = Math.round(Number(offsetNanos) / 1000);
      const roundTripMicros = Number(roundTrip / BigInt(1000));
      if (
        !Number.isSafeInteger(offsetMicros) ||
        !Number.isSafeInteger(roundTripMicros)
      )
        return false;
      this.offsetMillis = offsetMicros / 1000;
      this.roundTripMillis = roundTripMicros / 1000;
      return true;
    } catch {
      return false;
    }
  }
  reset() {
    this.offsetMillis = 0;
    this.roundTripMillis = null;
  }
}
export class ReconnectPolicy {
  private attempts = 0;
  constructor(private random = Math.random) {}
  next() {
    const cap = Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 30));
    return cap / 2 + Math.floor(this.random() * (cap / 2 + 1));
  }
  reset() {
    this.attempts = 0;
  }
}
