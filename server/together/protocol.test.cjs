'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const {
  synctv,
} = require('../../src/features/rooms/synctv/protocol/client.js');
test('generated heartbeat matches pinned upstream protobuf wire format', () => {
  const bytes = synctv.client.ClientMessage.encode({
    heartbeat: { timestamp: 123 },
  }).finish();
  assert.equal(Buffer.from(bytes).toString('hex'), '1202087b');
  const ack = synctv.client.ServerMessage.decode(
    Buffer.from('3202087b', 'hex')
  );
  assert.equal(Number(ack.heartbeatAck.timestamp), 123);
});
test('generated decoder rejects truncated frames and skips unknown fields', () => {
  assert.throws(() =>
    synctv.client.ServerMessage.decode(Buffer.from('320508', 'hex'))
  );
  const ack = synctv.client.ServerMessage.decode(
    Buffer.from('3202087bf80701', 'hex')
  );
  assert.equal(Number(ack.heartbeatAck.timestamp), 123);
});

test('64-bit permission masks retain every bit instead of rounding through JavaScript numbers', () => {
  const Long = require('protobufjs/minimal').util.Long;
  assert(Long, 'protobuf runtime must provide lossless 64-bit values');
  const value = Long.fromString('18446744073709551615', true);
  const bytes = synctv.common.RoomMember.encode({
    permissions: value,
  }).finish();
  const member = synctv.common.RoomMember.decode(bytes);
  assert.equal(member.permissions.toString(), '18446744073709551615');
});

test('generator emits usable typed exports, including lossless protobuf Long types', () => {
  const fs = require('node:fs'),
    path = require('node:path');
  const definitions = fs.readFileSync(
    path.join(
      __dirname,
      '../../src/features/rooms/synctv/protocol/client.d.ts'
    ),
    'utf8'
  );
  assert.match(definitions, /export namespace synctv/);
  assert.match(definitions, /class ClientMessage/);
  assert.match(definitions, /heartbeat\??:/);
  assert(
    !definitions.includes('require("long")'),
    'types must use approved protobufjs Long interface'
  );
});
