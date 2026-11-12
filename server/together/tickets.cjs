'use strict';
const { createHash, timingSafeEqual } = require('node:crypto');
const hash = (value) => createHash('sha256').update(value).digest();
const validRoom = (id) =>
  typeof id === 'string' && /^room_[A-Za-z0-9]{1,59}$/.test(id);
class TicketLeases {
  constructor({ now = Date.now, maxEntries = 4096 } = {}) {
    this.now = now;
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }
  prune() {
    for (const [key, lease] of this.entries)
      if (lease.expiresAt <= this.now()) this.entries.delete(key);
  }
  issue({
    ticket,
    roomId,
    accountId,
    sessionId,
    cookie,
    expiresInSecs,
    principal,
  }) {
    this.prune();
    // ProtoJSON represents uint64 as decimal strings. TTL is capped before arithmetic.
    if (
      typeof expiresInSecs === 'string' &&
      /^[0-9]{1,20}$/.test(expiresInSecs)
    ) {
      const ttl = BigInt(expiresInSecs);
      expiresInSecs =
        ttl <= BigInt('18446744073709551615')
          ? Number(ttl > BigInt(30) ? BigInt(30) : ttl)
          : NaN;
    }
    if (
      typeof ticket !== 'string' ||
      !ticket ||
      ticket.length > 4096 ||
      !validRoom(roomId) ||
      !accountId ||
      !sessionId ||
      typeof cookie !== 'string' ||
      !cookie ||
      !Number.isFinite(expiresInSecs) ||
      expiresInSecs <= 0
    )
      throw new Error('Invalid realtime ticket');
    if (this.entries.size >= this.maxEntries)
      throw Object.assign(new Error('Too many pending realtime tickets'), {
        status: 429,
      });
    const key = hash(ticket).toString('hex');
    if (this.entries.has(key)) throw new Error('Duplicate realtime ticket');
    this.entries.set(key, {
      roomId,
      accountId,
      sessionId,
      principal,
      cookieHash: hash(cookie),
      expiresAt: this.now() + Math.min(30, expiresInSecs) * 1000,
    });
  }
  consume(ticket, roomId, cookie) {
    this.prune();
    if (
      typeof ticket !== 'string' ||
      ticket.length > 4096 ||
      !validRoom(roomId) ||
      typeof cookie !== 'string'
    )
      return null;
    const key = hash(ticket).toString('hex'),
      lease = this.entries.get(key);
    if (
      !lease ||
      lease.roomId !== roomId ||
      !timingSafeEqual(lease.cookieHash, hash(cookie))
    )
      return null;
    this.entries.delete(key);
    return {
      principal: lease.principal,
      roomId: lease.roomId,
      accountId: lease.accountId,
      sessionId: lease.sessionId,
      expiresAt: lease.expiresAt,
    };
  }
  revoke(accountId, sessionId) {
    for (const [key, lease] of this.entries)
      if (
        lease.accountId === accountId &&
        (!sessionId || lease.sessionId === sessionId)
      )
        this.entries.delete(key);
  }
}
module.exports = { TicketLeases, validRoom };
