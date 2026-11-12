'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  http = require('node:http'),
  crypto = require('node:crypto');
const { once } = require('node:events');
const { TicketLeases } = require('./tickets.cjs');
const { createTogetherUpgradeHandler } = require('./ws-proxy.cjs');
test('binary upgrade proxy binds ticket/cookie/room, forwards no browser credentials and closes on revocation', async () => {
  const sockets = new Set();
  let observed;
  let disconnect;
  const upstream = http.createServer();
  upstream.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  upstream.on('upgrade', (req, socket, head) => {
    observed = req;
    const accept = crypto
      .createHash('sha1')
      .update(
        req.headers['sec-websocket-key'] +
          '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
      )
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
        accept +
        '\r\n\r\n'
    );
    if (head.length) socket.write(head);
    socket.on('data', (data) => socket.write(data));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const tickets = new TicketLeases();
  const principal = {
    accountId: 'alice',
    sessionId: 'a',
    incarnation: '1',
    expiresAt: Date.now() + 10000,
  };
  principal.revalidate = async () => principal;
  const runtime = {
    tickets,
    config: { internalUrl: 'http://127.0.0.1:' + upstream.address().port },
    track(p, close) {
      disconnect = close;
      return () => {};
    },
  };
  const server = http.createServer();
  server.on('upgrade', (req, socket, head) => {
    createTogetherUpgradeHandler(runtime)(req, socket, head);
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  function issue(ticket) {
    tickets.issue({
      ticket,
      roomId: 'room_one',
      accountId: 'alice',
      sessionId: 'a',
      cookie: 'auth=private',
      expiresInSecs: 30,
      principal,
    });
  }
  function connect(ticket, cookie = 'auth=private', requestOrigin = origin) {
    return http.request(origin + '/sync/ws/room_one?ticket=' + ticket, {
      headers: {
        Origin: requestOrigin,
        Cookie: cookie,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
      },
    });
  }
  try {
    issue('once');
    const wrong = connect('once', 'auth=wrong');
    const wrongResult = once(wrong, 'response');
    wrong.end();
    const [response] = await wrongResult;
    response.resume();
    assert.equal(response.statusCode, 401);
    const req = connect('once'),
      upgraded = once(req, 'upgrade');
    req.end();
    const [, socket] = await upgraded;
    assert.equal(
      observed.url,
      '/ws/rooms/room_one?ticket=once&format=protobuf'
    );
    assert.equal(observed.headers.cookie, undefined);
    assert.equal(observed.headers.authorization, undefined);
    const message = once(socket, 'data');
    socket.write(Buffer.from([130, 3, 1, 2, 3]));
    assert.deepEqual((await message)[0], Buffer.from([130, 3, 1, 2, 3]));
    const closed = once(socket, 'close');
    disconnect();
    await closed;
    const replay = connect('once'),
      replayResult = once(replay, 'response');
    replay.end();
    const [replayed] = await replayResult;
    replayed.resume();
    assert.equal(replayed.statusCode, 401);
    issue('other');
    const foreign = connect('other', 'auth=private', 'https://evil.test'),
      foreignResult = once(foreign, 'response');
    foreign.end();
    const [blocked] = await foreignResult;
    blocked.resume();
    assert.equal(blocked.statusCode, 403);
  } finally {
    for (const socket of sockets) socket.destroy();
    server.close();
    upstream.close();
  }
});
