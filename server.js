// Next.js 自定义服务器 + Socket.IO
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const {
  attachTVRemoteIO,
  cleanupTVRemoteDevices,
  clearTVRemoteHub,
  registerTVRemoteDevice,
  removeTVRemoteSocket,
  updateTVRemoteDevice,
} = require('./src/lib/tv-remote-hub.js');

function shouldInitSQLite() {
  const isCloudflare =
    process.env.CF_PAGES === '1' || process.env.BUILD_TARGET === 'cloudflare';
  return (
    process.env.NEXT_PUBLIC_STORAGE_TYPE === 'd1' &&
    !isCloudflare &&
    process.env.MOONTV_LITE !== 'true'
  );
}

function isTVModeEnabled() {
  return process.env.ENABLE_TV_MODE !== 'false';
}

function ensureSQLiteReady() {
  if (!shouldInitSQLite()) {
    return;
  }

  try {
    const {
      initSQLiteDatabase,
      getSqliteDbPath,
    } = require('./scripts/init-sqlite.js');
    if (require('node:fs').existsSync(`${getSqliteDbPath()}.restore.lock`))
      throw new Error(
        'SQLite restore is in progress; retry startup after the restore lock is removed.'
      );
    initSQLiteDatabase();
  } catch (error) {
    console.error('❌ Error initializing SQLite database:', error);
    throw error;
  }
}

// 登录 Cookie 的签名密钥与站长密码分开：未显式配置 AUTH_SECRET 时，
// 首次启动生成 32 字节随机密钥并保存在数据目录（权限 600），之后重启沿用，
// 这样成员无法从自己的 Cookie 离线反推出站长密码。必须在 Next 初始化前设置，
// 中间件和 Socket.IO 房间认证读取的都是同一个值。
function ensureAuthSecret() {
  if (process.env.AUTH_SECRET) return;
  const fs = require('node:fs');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const dataDir = path.dirname(
    path.resolve(process.env.SQLITE_DB_PATH || path.join('.data', 'moontv.db'))
  );
  const file = path.join(dataDir, 'auth-secret');
  try {
    let secret = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
    if (secret.length < 32) {
      secret = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, `${secret}
`, { mode: 0o600 });
      console.log(`🔐 已生成登录签名密钥：${file}（请随数据目录一起备份）`);
    }
    process.env.AUTH_SECRET = secret;
  } catch (error) {
    // 数据目录不可写时退回旧行为（用 PASSWORD 签名），并提示站长手动配置
    console.warn(
      '⚠️ 无法保存登录签名密钥，暂用 PASSWORD 签名。建议设置环境变量 AUTH_SECRET：',
      error && error.message
    );
  }
}

ensureAuthSecret();
ensureSQLiteReady();

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 读取观影室配置的辅助函数
async function getWatchRoomConfig() {
  // 观影室配置现在统一从环境变量读取
  const config = {
    enabled: process.env.WATCH_ROOM_ENABLED === 'true',
    serverType: process.env.WATCH_ROOM_SERVER_TYPE || 'internal',
    externalServerUrl: process.env.WATCH_ROOM_EXTERNAL_SERVER_URL,
    externalServerAuth: process.env.WATCH_ROOM_EXTERNAL_SERVER_AUTH,
  };

  console.log(
    `[WatchRoom] Watch room ${
      config.enabled ? 'enabled' : 'disabled'
    } via environment variable.`
  );
  return config;
}

// Persistent room rules, transport and storage have separate lifetimes.
const { RoomStore, openRoomStore } = require('./server/room-store.js');
const { RoomService } = require('./server/room-service.js');
const { createRoomAuthenticator } = require('./server/room-auth.js');
const {
  RoomSocketServer,
  createRoomHttpHandler,
  validOrigin,
} = require('./server/room-transport.js');
const { createHealthHandler } = require('./server/room-health.js');

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index <= 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function parseSocketAuth(socket) {
  const cookies = parseCookieHeader(socket.handshake.headers.cookie || '');
  const raw = cookies.auth || socket.handshake.auth?.token || '';
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}

  if (decoded.includes('%')) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {}
  }

  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

class TVRemoteServer {
  constructor(io) {
    this.io = io;
    this.cleanupInterval = null;
    attachTVRemoteIO(io);
    this.setupEventHandlers();
    this.startCleanupTimer();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('tv-remote:register-tv', (data, callback) => {
        const auth = socket.data.roomIdentity
          ? { username: socket.data.roomIdentity.accountId }
          : parseSocketAuth(socket);
        if (!auth?.username) {
          callback?.({ success: false, error: '未登录' });
          return;
        }

        const deviceId = String(data?.deviceId || '').slice(0, 128);
        if (!deviceId) {
          callback?.({ success: false, error: '缺少设备 ID' });
          return;
        }

        callback?.(registerTVRemoteDevice(socket.id, auth.username, data));
      });

      socket.on('tv-remote:tv-state', (data) => {
        const auth = socket.data.roomIdentity
          ? { username: socket.data.roomIdentity.accountId }
          : parseSocketAuth(socket);
        if (!auth?.username) return;
        updateTVRemoteDevice(socket.id, auth.username, data);
      });

      socket.on('disconnect', () => {
        removeTVRemoteSocket(socket.id);
      });
    });
  }

  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      cleanupTVRemoteDevices();
    }, 30_000);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    clearTVRemoteHub();
  }
}

app.prepare().then(async () => {
  let roomDatabase = null;
  let roomService = null;
  let roomAuthenticator = null;
  let roomHttpHandler = null;
  const healthHandler = createHealthHandler(() => ({
    roomDatabase,
    roomService,
    roomsRequired:
      process.env.WATCH_ROOM_ENABLED === 'true' &&
      process.env.WATCH_ROOM_SERVER_TYPE !== 'external',
  }));
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      if (healthHandler(req, res)) return;
      if (roomHttpHandler && (await roomHttpHandler(req, res))) return;
      if (
        !roomHttpHandler &&
        (parsedUrl.pathname === '/api/rooms' ||
          parsedUrl.pathname.startsWith('/api/rooms/'))
      ) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify({
            success: false,
            code: 'ROOM_STORAGE_UNSUPPORTED',
            error: '长期房间需要完整 Node 服务和 SQLite 存储',
          })
        );
        return;
      }
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // 读取观影室配置
  const watchRoomConfig = await getWatchRoomConfig();
  console.log('[WatchRoom] Configuration:', {
    enabled: watchRoomConfig.enabled,
    serverType: watchRoomConfig.serverType,
  });

  let watchRoomServer = null;
  let tvRemoteServer = null;
  let io = null;

  const tvModeEnabled = isTVModeEnabled();
  const shouldStartInternalWatchRoom =
    watchRoomConfig.enabled &&
    watchRoomConfig.serverType === 'internal' &&
    shouldInitSQLite();

  if (
    watchRoomConfig.enabled &&
    watchRoomConfig.serverType === 'internal' &&
    !shouldInitSQLite()
  ) {
    console.warn(
      '[WatchRoom] Persistent rooms require the full Node + SQLite deployment.'
    );
  }
  if (shouldStartInternalWatchRoom) {
    roomDatabase = openRoomStore();
    roomService = new RoomService(new RoomStore(roomDatabase));
    roomAuthenticator = createRoomAuthenticator(roomDatabase);
    roomHttpHandler = createRoomHttpHandler(roomService, roomAuthenticator);
  }

  if (tvModeEnabled || shouldStartInternalWatchRoom) {
    io = new Server(httpServer, {
      path: '/socket.io',
      pingInterval: 25000,
      pingTimeout: 35000,
      maxHttpBufferSize: 262144,
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      allowRequest: (req, callback) =>
        callback(
          null,
          validOrigin(
            req.headers.origin,
            req.headers.host,
            process.env.ROOM_ALLOWED_ORIGINS
          )
        ),
    });
  }

  if (tvModeEnabled && io) {
    tvRemoteServer = new TVRemoteServer(io);
    console.log('[TVRemote] Socket.IO remote server initialized');
  } else {
    console.log('[TVRemote] TV mode disabled, remote server not initialized');
  }

  if (shouldStartInternalWatchRoom && io) {
    // 初始化观影室服务器
    watchRoomServer = new RoomSocketServer(io, roomService, roomAuthenticator);
    console.log('[WatchRoom] Socket.IO server initialized');
  } else {
    if (!watchRoomConfig.enabled) {
      console.log('[WatchRoom] Watch room is disabled');
    } else if (watchRoomConfig.serverType === 'external') {
      console.log('[WatchRoom] Using external watch room server');
    }
  }

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      if (io) {
        console.log(`> Socket.IO ready on ws://${hostname}:${port}`);
      } else {
        console.log('> Socket.IO disabled');
      }
    });

  const forceExit = (signal) => {
    console.log(`\n[Server] Received ${signal}, force exiting...`);
    watchRoomServer?.destroy();
    tvRemoteServer?.destroy();
    roomDatabase?.close();
    process.exit(0);
  };

  process.on('SIGINT', () => forceExit('SIGINT'));
  process.on('SIGTERM', () => forceExit('SIGTERM'));
});
