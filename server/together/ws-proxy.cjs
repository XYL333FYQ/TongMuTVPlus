'use strict';
const http = require('node:http'),
  https = require('node:https');
const { validRoom } = require('./tickets.cjs');
function reject(socket, status) {
  if (socket.destroyed) return;
  socket.end(
    'HTTP/1.1 ' +
      status +
      ' Rejected\r\nConnection: close\r\nContent-Length: 0\r\nCache-Control: no-store\r\n\r\n'
  );
}
function createTogetherUpgradeHandler(runtime) {
  return function handle(req, socket, head) {
    let url;
    try {
      url = new URL(req.url, 'http://local');
    } catch {
      return false;
    }
    if (!url.pathname.startsWith('/sync/ws/')) return false;
    socket.pause();
    void (async () => {
      if (!runtime) {
        reject(socket, 503);
        return;
      }
      const roomId = url.pathname.slice('/sync/ws/'.length);
      const origin = req.headers.origin;
      let originUrl;
      try {
        originUrl = new URL(origin);
      } catch {
        reject(socket, 403);
        return;
      }
      if (
        !['http:', 'https:'].includes(originUrl.protocol) ||
        originUrl.host !== req.headers.host ||
        originUrl.origin !== origin
      ) {
        reject(socket, 403);
        return;
      }
      if (
        req.method !== 'GET' ||
        req.headers.upgrade?.toLowerCase() !== 'websocket' ||
        req.headers['sec-websocket-version'] !== '13' ||
        !validRoom(roomId) ||
        url.searchParams.getAll('ticket').length !== 1
      ) {
        reject(socket, 400);
        return;
      }
      const ticket = url.searchParams.get('ticket');
      const lease = runtime.tickets.consume(
        ticket,
        roomId,
        req.headers.cookie || ''
      );
      if (!lease?.principal?.revalidate) {
        reject(socket, 401);
        return;
      }
      let fresh;
      try {
        fresh = await lease.principal.revalidate();
      } catch {}
      if (!fresh) {
        reject(socket, 401);
        return;
      }
      if (socket.destroyed) return;
      const target = new URL(
        '/ws/rooms/' + encodeURIComponent(roomId),
        runtime.config.internalUrl
      );
      target.searchParams.set('ticket', ticket);
      target.searchParams.set('format', 'protobuf');
      let remote,
        finished = false;
      const close = () => {
        if (finished) return;
        finished = true;
        request.destroy();
        remote?.destroy();
        socket.destroy();
        untrack();
      };
      let untrack = () => {};
      const request = (target.protocol === 'https:' ? https : http).request(
        target,
        {
          method: 'GET',
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
            'Sec-WebSocket-Key': req.headers['sec-websocket-key'],
            'Sec-WebSocket-Version': '13',
          },
          timeout: 15000,
        }
      );
      untrack = runtime.track(fresh, close);
      socket.on('close', close);
      socket.on('error', close);
      request.on('timeout', close);
      request.on('error', () => {
        reject(socket, 502);
        close();
      });
      request.on('response', (response) => {
        response.resume();
        reject(
          socket,
          response.statusCode === 401 || response.statusCode === 403
            ? response.statusCode
            : 502
        );
        request.destroy();
        untrack();
      });
      request.on('upgrade', async (response, upstream, upstreamHead) => {
        remote = upstream;
        if (finished || socket.destroyed) {
          close();
          return;
        }
        let valid;
        try {
          valid = await fresh.revalidate();
        } catch {}
        if (!valid) {
          reject(socket, 401);
          close();
          return;
        }
        const accept = response.headers['sec-websocket-accept'];
        if (
          typeof accept !== 'string' ||
          !/^[A-Za-z0-9+/]{27}=$/.test(accept)
        ) {
          reject(socket, 502);
          close();
          return;
        }
        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
            accept +
            '\r\n\r\n'
        );
        upstream.on('error', close);
        upstream.on('close', close);
        if (upstreamHead.length) socket.write(upstreamHead);
        if (head.length) upstream.write(head);
        socket.pipe(upstream);
        upstream.pipe(socket);
        socket.resume();
      });
      request.end();
    })().catch(() => reject(socket, 502));
    return true;
  };
}
module.exports = { createTogetherUpgradeHandler };
