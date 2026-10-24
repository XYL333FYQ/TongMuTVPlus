'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { fork } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { io } = require('socket.io-client');
const { openRoomStore } = require('../../server/room-store');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function exited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}
function waitForExit(child, timeoutMs) {
  if (exited(child)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const completed = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      child.off('exit', completed);
      reject(new Error('Load server shutdown timed out'));
    }, timeoutMs);
    child.once('exit', completed);
  });
}
function percentile(values, percentage) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(
      sorted.length - 1,
      Math.ceil((sorted.length * percentage) / 100) - 1
    )
  ];
}
function optionsFor(args) {
  const options = {
    connections: 50,
    durationMs: 30000,
    output: path.join(
      process.cwd(),
      'docs',
      'verification',
      'room-load-latest.json'
    ),
  };
  for (let i = 0; i < args.length; i += 2) {
    const key = {
      '--connections': 'connections',
      '--duration-ms': 'durationMs',
      '--output': 'output',
    }[args[i]];
    if (!key || !args[i + 1])
      throw new Error(
        'Usage: node scripts/ops/room-load.cjs [--connections 50] [--duration-ms 30000] [--output report.json]'
      );
    options[key] =
      key === 'output' ? path.resolve(args[i + 1]) : Number(args[i + 1]);
  }
  if (
    !Number.isSafeInteger(options.connections) ||
    options.connections < 1 ||
    options.connections > 1000 ||
    !Number.isSafeInteger(options.durationMs) ||
    options.durationMs < 1000 ||
    options.durationMs > 300000
  )
    throw new Error('Connection count/duration outside supported test range.');
  return options;
}
async function run(options) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tongmutvplus-load-')
  );
  const databasePath = path.join(directory, 'load.db');
  const secret = crypto.randomBytes(32).toString('hex');
  const database = openRoomStore(databasePath);
  database.exec(
    'CREATE TABLE users (username TEXT PRIMARY KEY,role TEXT,banned INTEGER DEFAULT 0); CREATE TABLE global_config (key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER)'
  );
  const credentials = [];
  for (let i = 0; i < options.connections; i++) {
    const username = `load-user-${i}`;
    const timestamp = Date.now();
    const tokenId = crypto.randomBytes(16).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const role = i === 0 ? 'owner' : 'user';
    database
      .prepare('INSERT INTO users (username,role) VALUES (?,?)')
      .run(username, role);
    database
      .prepare(
        'INSERT INTO global_config (key,value,updated_at) VALUES (?,?,?)'
      )
      .run(
        `user_tokens:${username}:${tokenId}`,
        JSON.stringify({
          token: refreshToken,
          expiresAt: timestamp + 86400000,
        }),
        timestamp
      );
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify({ username, role, timestamp }))
      .digest('hex');
    credentials.push(
      encodeURIComponent(
        JSON.stringify({
          username,
          role,
          timestamp,
          signature,
          tokenId,
          refreshToken,
          refreshExpires: timestamp + 86400000,
        })
      )
    );
  }
  database.close();
  const child = fork(
    path.join(__dirname, 'room-load-server.cjs'),
    [databasePath],
    {
      env: {
        ...process.env,
        PASSWORD: secret,
        AUTH_SECRET: secret,
        ROOM_MAX_MEMBERS: '8',
      },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    }
  );
  const metrics = [];
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('message', (message) => {
    if (message.type === 'metrics') metrics.push(message);
  });
  const sockets = [];
  const groups = [];
  const latencies = [];
  const errors = [];
  let broadcastCount = 0;
  let broadcastJsonBytes = 0;
  let chatDelivered = 0;
  let sentMessages = 0;
  let acknowledged = 0;
  let heartbeatTimer;
  const startedAt = performance.now();
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Load server startup timed out')),
        15000
      );
      child.once('error', reject);
      child.once('exit', (code) =>
        reject(new Error(`Load server exited during startup (${code})`))
      );
      child.on('message', (message) => {
        if (message.type === 'ready') {
          clearTimeout(timer);
          resolve(message.port);
        }
      });
    });
    const base = `http://127.0.0.1:${port}`;
    async function connect(index) {
      const socket = io(base, {
        transports: ['websocket'],
        reconnection: false,
        auth: { token: credentials[index] },
        timeout: 10000,
      });
      socket.__index = index;
      socket.on('room:snapshot', (snapshot) => {
        socket.__room = snapshot.room;
        broadcastCount += 1;
        broadcastJsonBytes += Buffer.byteLength(JSON.stringify(snapshot));
      });
      socket.on('chat:message', () => {
        chatDelivered += 1;
      });
      socket.on('room:command-error', (error) =>
        errors.push({ event: error.event, code: error.code })
      );
      sockets[index] = socket;
      await new Promise((resolve, reject) => {
        const connected = () => {
          socket.off('connect_error', rejected);
          resolve();
        };
        const rejected = (error) => {
          socket.off('connect', connected);
          reject(error);
        };
        socket.once('connect', connected);
        socket.once('connect_error', rejected);
      });
      return socket;
    }
    function ack(socket, event, payload = {}, expectedError) {
      const start = performance.now();
      return new Promise((resolve, reject) =>
        socket.timeout(10000).emit(event, payload, (error, response) => {
          latencies.push(performance.now() - start);
          if (error) {
            errors.push({ event, code: 'ACK_TIMEOUT' });
            reject(error);
            return;
          }
          acknowledged += 1;
          if (response?.success === false && response.code !== expectedError) {
            errors.push({ event, code: response.code });
            reject(new Error(`${event}: ${response.code}`));
            return;
          }
          if (response?.room) socket.__room = response.room;
          resolve(response);
        })
      );
    }
    function meta(socket) {
      return {
        commandId: crypto.randomUUID(),
        controllerEpoch: socket.__room.controllerEpoch,
        baseRevision: socket.__room.revision,
      };
    }
    await Promise.all(credentials.map((_, index) => connect(index)));
    for (let offset = 0; offset < sockets.length; offset += 8) {
      const members = sockets.slice(offset, offset + 8);
      const owner = members[0];
      const created = await ack(owner, 'room:create', {
        name: `Load group ${groups.length + 1}`,
        isPublic: true,
        roomType: 'sync',
        commandId: crypto.randomUUID(),
      });
      await ack(owner, 'room:sync-applied', {
        revision: created.room.revision,
        controllerEpoch: created.room.controllerEpoch,
      });
      await ack(owner, 'room:ready', { revision: created.room.revision });
      const initial = {
        type: 'play',
        videoId: `fixture-${groups.length}`,
        videoName: 'Signal-only fixture',
        source: 'fixture',
        url: 'https://example.test/not-fetched.mp4',
        currentTime: 0,
        isPlaying: true,
        playbackRate: 1,
        episode: 1,
      };
      await ack(owner, 'play:change', { ...initial, ...meta(owner) });
      for (const guest of members.slice(1)) {
        const joined = await ack(guest, 'room:join', {
          roomId: created.room.id,
        });
        await ack(guest, 'room:sync-applied', {
          revision: joined.room.revision,
          controllerEpoch: joined.room.controllerEpoch,
        });
        await ack(guest, 'room:ready', { revision: joined.room.revision });
      }
      groups.push({ id: created.room.id, owner, members, initial });
    }
    heartbeatTimer = setInterval(() => {
      for (const socket of sockets)
        if (socket.connected) socket.emit('heartbeat');
    }, 5000);
    metrics.length = 0;
    child.send({ type: 'begin-load' });
    const loadStartedAt = performance.now();
    let cycle = 0;
    let reconnected = false;
    while (performance.now() - loadStartedAt < options.durationMs) {
      await Promise.all(
        groups.map(async (group) => {
          await ack(group.owner, 'play:update', {
            ...group.initial,
            currentTime: (performance.now() - loadStartedAt) / 1000,
            ...meta(group.owner),
          });
          if (cycle % 10 === 0)
            await ack(group.owner, 'queue:add', {
              title: 'Signal queue fixture',
              href: '/play?title=load-fixture',
              ...meta(group.owner),
            });
        })
      );
      if (cycle % 5 === 0) {
        await Promise.all(
          sockets.map((socket) =>
            ack(socket, 'chat:message', {
              content: 'Signal load fixture',
              type: 'text',
              commandId: crypto.randomUUID(),
            })
          )
        );
        sentMessages += sockets.length;
      }
      if (!reconnected && cycle >= 2 && sockets.length > 1) {
        const index = Math.min(1, sockets.length - 1);
        const previous = sockets[index];
        const roomId = previous.__room.id;
        previous.disconnect();
        const replacement = await connect(index);
        const joined = await ack(replacement, 'room:join', { roomId });
        await ack(replacement, 'room:sync-applied', {
          revision: joined.room.revision,
          controllerEpoch: joined.room.controllerEpoch,
        });
        await ack(replacement, 'room:ready', {
          revision: joined.room.revision,
        });
        for (const group of groups)
          group.members = group.members.map((socket) =>
            socket === previous ? replacement : socket
          );
        reconnected = true;
      }
      cycle += 1;
      await sleep(1000);
    }
    const finalRooms = groups.map((group) => ({
      members: group.members.length,
      actualMembers: group.owner.__room.memberCount,
      revision: group.owner.__room.revision,
    }));
    if (groups.length > 1)
      await ack(
        groups[0].owner,
        'voice:offer',
        {
          targetUserId: groups[1].owner.id,
          offer: { type: 'offer', sdp: 'fixture' },
        },
        'FORBIDDEN'
      );
    const active = sockets.filter((socket) => socket.connected).length;
    if (
      active !== options.connections ||
      finalRooms.some((group) => group.members !== group.actualMembers)
    )
      throw new Error('Connection/member count diverged during load');
    const measuredDurationMs = performance.now() - loadStartedAt;
    child.send({ type: 'shutdown' });
    await waitForExit(child, 10000);
    const latest = metrics.at(-1) || {};
    const report = {
      recordedAt: new Date().toISOString(),
      passed: errors.length === 0,
      scope:
        'Real authenticated Socket.IO/WebSocket connections to production room modules in an isolated Node server and SQLite database; Next rendering and media bytes are excluded.',
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu: os.cpus()[0]?.model,
        logicalCpus: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
      },
      scenario: {
        connections: options.connections,
        roomCount: groups.length,
        maxRoomMembers: 8,
        durationMs: options.durationMs,
        measuredDurationMs,
        updates: 'one playback state per room per second',
        chat: 'every connection sends once per five cycles',
        queue: 'one enqueue per room per ten cycles',
        reconnectCompleted: reconnected,
        crossRoomSignalRejected: groups.length > 1,
      },
      results: {
        acknowledged,
        ackP50Ms: percentile(latencies, 50),
        ackP95Ms: percentile(latencies, 95),
        ackP99Ms: percentile(latencies, 99),
        ackMaxMs: Math.max(...latencies),
        unexpectedErrors: errors,
        snapshotsDelivered: broadcastCount,
        snapshotJsonBytes: broadcastJsonBytes,
        chatMessagesSent: sentMessages,
        chatDeliveries: chatDelivered,
        finalActiveConnections: active,
        finalRooms,
      },
      server: {
        cpuOneCorePercent: latest.cpuOneCorePercent,
        peakRssBytes: Math.max(...metrics.map((item) => item.rssBytes)),
        peakHeapUsedBytes: Math.max(
          ...metrics.map((item) => item.heapUsedBytes)
        ),
        eventLoopP95Ms: latest.eventLoopP95Ms,
        eventLoopMaxMs: latest.eventLoopMaxMs,
      },
      mediaThroughput: {
        tested: false,
        reason:
          'No video/audio media requests, decoding, proxying, WebRTC payload or transcode workload is generated. These metrics do not establish media capacity.',
      },
      container: {
        tested: false,
        reason:
          'Host has no Docker executable; isolated native Node process only.',
      },
      elapsedMs: performance.now() - startedAt,
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(
      `${JSON.stringify({
        passed: report.passed,
        connections: active,
        rooms: groups.length,
        ackP95Ms: report.results.ackP95Ms,
        peakRssMiB: report.server.peakRssBytes / 1048576,
        report: options.output,
      })}\n`
    );
    if (!report.passed) process.exitCode = 1;
  } finally {
    clearInterval(heartbeatTimer);
    for (const socket of sockets) socket.disconnect();
    if (!exited(child) && child.connected) {
      child.send({ type: 'shutdown' });
      await waitForExit(child, 5000).catch(() => {});
    }
    if (!exited(child)) {
      child.kill();
      await waitForExit(child, 5000).catch(() => {});
    }
    // This is an agent-created temporary directory, never the application's .data directory.
    if (exited(child)) fs.rmSync(directory, { recursive: true, force: true });
    if (stderr) process.stderr.write(stderr);
  }
}

if (require.main === module)
  run(optionsFor(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  });
module.exports = { run, optionsFor };
