'use strict';

const { createServer } = require('node:http');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const { Server } = require('socket.io');
const { RoomStore, openRoomStore } = require('../../server/room-store');
const { RoomService } = require('../../server/room-service');
const { createRoomAuthenticator } = require('../../server/room-auth');
const { RoomSocketServer, createRoomHttpHandler } = require('../../server/room-transport');
const { createHealthHandler } = require('../../server/room-health');

const database = openRoomStore(process.argv[2]);
const service = new RoomService(new RoomStore(database));
const authenticator = createRoomAuthenticator(database);
const api = createRoomHttpHandler(service, authenticator);
const health = createHealthHandler(() => ({ roomsRequired: true, roomDatabase: database, roomService: service }));
const http = createServer(async (req, res) => { if (health(req, res)) return; if (!await api(req, res)) { res.statusCode = 404; res.end(); } });
const io = new Server(http, { transports: ['websocket'], pingInterval: 25000, pingTimeout: 35000, maxHttpBufferSize: 262144 });
const transport = new RoomSocketServer(io, service, authenticator);
const lag = monitorEventLoopDelay({ resolution: 10 }); lag.enable();
let startedAt = performance.now();
let baseline = process.cpuUsage();
function metrics() {
  const cpu = process.cpuUsage(baseline);
  const elapsedMs = performance.now() - startedAt;
  return { elapsedMs, cpuOneCorePercent: (cpu.user + cpu.system) / (elapsedMs * 10), rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed, eventLoopP95Ms: lag.percentile(95) / 1e6, eventLoopMaxMs: lag.max / 1e6, sockets: io.sockets.sockets.size, roomSessions: service.sessions.size };
}
const timer = setInterval(() => process.send?.({ type: 'metrics', ...metrics() }), 1000);
let stopping = false;
function shutdown() {
  if (stopping) return; stopping = true;
  clearInterval(timer); process.send?.({ type: 'metrics', ...metrics() });
  transport.destroy();
  io.close(() => { database.close(); lag.disable(); process.disconnect?.(); });
}
process.on('message', message => {
  if (message?.type === 'shutdown') shutdown();
  if (message?.type === 'begin-load') { startedAt = performance.now(); baseline = process.cpuUsage(); lag.reset(); }
});
process.on('SIGTERM', shutdown);
http.listen(0, '127.0.0.1', () => process.send?.({ type: 'ready', port: http.address().port }));
