'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TicketLeases } = require('./tickets.cjs');
test('tickets are single use and bound to the original room and browser session', () => {
  let now = 1000;
  const leases = new TicketLeases({ now: () => now });
  leases.issue({
    ticket: 'upstream-secret',
    roomId: 'room_one',
    accountId: 'alice',
    sessionId: 'device-a',
    cookie: 'cookie-a',
    expiresInSecs: 60,
  });
  assert.equal(leases.consume('upstream-secret', 'room_two', 'cookie-a'), null);
  assert.equal(leases.consume('upstream-secret', 'room_one', 'cookie-b'), null);
  const lease = leases.consume('upstream-secret', 'room_one', 'cookie-a');
  assert.equal(lease.accountId, 'alice');
  assert.equal(lease.sessionId, 'device-a');
  assert.equal(leases.consume('upstream-secret', 'room_one', 'cookie-a'), null);
  leases.issue({
    ticket: 'expired',
    roomId: 'room_one',
    accountId: 'alice',
    sessionId: 'device-a',
    cookie: 'cookie-a',
    expiresInSecs: 60,
  });
  now += 30001;
  assert.equal(leases.consume('expired', 'room_one', 'cookie-a'), null);
});
test('revocation invalidates only matching device and never accepts malformed or wrong-room tickets', () => {
  const leases = new TicketLeases();
  for (const sessionId of ['a', 'b'])
    leases.issue({
      ticket: sessionId,
      roomId: 'room_one',
      accountId: 'alice',
      sessionId,
      cookie: 'cookie',
      expiresInSecs: 30,
    });
  leases.revoke('alice', 'a');
  assert.equal(leases.consume('a', 'room_one', 'cookie'), null);
  assert.ok(leases.consume('b', 'room_one', 'cookie'));
  assert.throws(() =>
    leases.issue({
      ticket: 't',
      roomId: '../admin',
      accountId: 'alice',
      sessionId: 'a',
      cookie: 'c',
      expiresInSecs: 30,
    })
  );
  assert.throws(() =>
    leases.issue({
      ticket: 't',
      roomId: 'room_one',
      accountId: 'alice',
      sessionId: 'a',
      cookie: 'c',
      expiresInSecs: 0,
    })
  );
});

test('upstream ProtoJSON encodes uint64 ticket TTL as a decimal string', () => {
  const leases = new TicketLeases({ now: () => 1000 });
  leases.issue({
    ticket: 'proto-json',
    roomId: 'room_one',
    accountId: 'alice',
    sessionId: 'a',
    cookie: 'c',
    expiresInSecs: '30',
  });
  assert.equal(leases.consume('proto-json', 'room_one', 'c').expiresAt, 31000);
});
