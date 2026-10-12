'use strict';

// Local Windows acceptance entry. Keep data and existing credentials on restart.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseEnv } = require('node:util');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, '.data');
const lockPath = path.join(runtimeDir, 'local-launch.json');
const marker = `local-${crypto
  .createHash('sha256')
  .update(root)
  .digest('hex')
  .slice(0, 16)}`;
const noBrowser = process.argv.includes('--no-browser');
let server;
let ownLock = false;
let stopping = false;

function config() {
  const envPath = path.join(root, '.env');
  const defaults = {
    USERNAME: 'admin',
    PASSWORD: '123456',
    NEXT_PUBLIC_STORAGE_TYPE: 'd1',
    NEXT_PUBLIC_SITE_NAME: 'TongMuTV Plus',
    SQLITE_DB_PATH: '.data/moontv.db',
    WATCH_ROOM_ENABLED: 'true',
    WATCH_ROOM_SERVER_TYPE: 'internal',
    HOSTNAME: '127.0.0.1',
    PORT: '3000',
  };
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const existing = parseEnv(text);
  const missing = Object.entries(defaults).filter(
    ([key]) => !Object.hasOwn(existing, key)
  );
  if (missing.length) {
    fs.appendFileSync(
      envPath,
      `${text && !text.endsWith('\n') ? '\n' : ''}${missing
        .map(([key, value]) => `${key}=${value}`)
        .join('\n')}\n`,
      { mode: 0o600 }
    );
    console.log('[配置] 已补齐本地配置；已有值保留。');
  }
  let values = {};
  // Same precedence as Next's development env files; pass to server before DB init.
  for (const name of [
    '.env',
    '.env.development',
    '.env.local',
    '.env.development.local',
  ]) {
    const file = path.join(root, name);
    if (fs.existsSync(file))
      values = { ...values, ...parseEnv(fs.readFileSync(file, 'utf8')) };
  }
  if (!values.USERNAME || !values.PASSWORD)
    throw new Error(
      '.env 中 USERNAME / PASSWORD 不能为空。已有密码不会自动覆盖。'
    );
  if (
    values.NEXT_PUBLIC_STORAGE_TYPE !== 'd1' ||
    values.WATCH_ROOM_ENABLED !== 'true' ||
    values.WATCH_ROOM_SERVER_TYPE !== 'internal'
  ) {
    throw new Error(
      '现有配置不是 SQLite + 内部房间。请检查 .env/.env.local；脚本不会擅自切换已有存储。'
    );
  }
  if (
    values.BUILD_TARGET ||
    values.CF_PAGES === '1' ||
    values.EDGEONE_PAGES === '1' ||
    values.MOONTV_LITE === 'true'
  ) {
    throw new Error(
      '现有环境文件启用了 Edge/Lite。此启动器需要完整本地 Node 服务。'
    );
  }
  return {
    ...process.env,
    ...values,
    NODE_ENV: 'development',
    HOSTNAME: '127.0.0.1',
    APP_COMMIT_SHA: marker,
    SQLITE_DB_PATH: path.resolve(
      root,
      values.SQLITE_DB_PATH || defaults.SQLITE_DB_PATH
    ),
    BUILD_TARGET: '',
    CF_PAGES: '',
    EDGEONE_PAGES: '',
    MOONTV_LITE: 'false',
  };
}

function command(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `步骤失败：${path.basename(executable)}，退出码 ${code}，信号 ${
                signal || '无'
              }`
            )
          )
    );
  });
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ready(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
      signal: AbortSignal.timeout(1500),
    });
    const value = await response.json();
    return (
      response.ok &&
      value.service === 'tongmutvplus' &&
      value.buildSha === marker &&
      value.checks?.rooms === 'ok'
    );
  } catch {
    return false;
  }
}

function openBrowser(port) {
  const url = `http://localhost:${port}`;
  console.log(`\n[网页] ${url}\n[后台] ${url}/admin`);
  if (noBrowser) return;
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-Command', `Start-Process '${url}'`],
    { windowsHide: true, stdio: 'ignore' }
  );
  child.on('error', () =>
    console.log('自动打开浏览器失败，请点击上面的地址。')
  );
  child.on('exit', (code) => {
    if (code) console.log('请手动打开上面的网页地址。');
  });
}

function releaseLock() {
  if (!ownLock) return;
  try {
    if (JSON.parse(fs.readFileSync(lockPath, 'utf8')).pid === process.pid)
      fs.unlinkSync(lockPath);
  } catch {}
  ownLock = false;
}

function freePort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function main() {
  if (
    Number(process.versions.node.split('.')[0]) < 22 ||
    typeof parseEnv !== 'function'
  )
    throw new Error(
      '需要 Node.js 22.9 或更新版本，推荐项目指定的 Node.js 24。'
    );
  process.chdir(root);
  fs.mkdirSync(runtimeDir, { recursive: true });
  const env = config();
  if (fs.existsSync(lockPath)) {
    const previous = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (alive(previous.pid)) {
      if (!Number.isInteger(previous.port))
        throw new Error('已有启动窗口正在准备依赖，请查看那个窗口。');
      console.log('[启动] 已有启动窗口，等待它的网页和房间服务就绪…');
      for (let i = 0; i < 120; i++) {
        if (await ready(previous.port)) {
          openBrowser(previous.port);
          return;
        }
        if (!alive(previous.pid)) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error(
        '已有启动窗口尚未就绪。请查看那个窗口；不会重复启动数据库服务。'
      );
    }
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), {
    flag: 'wx',
  });
  ownLock = true;

  let depsMissing = false;
  for (const name of ['next', 'react', 'better-sqlite3', 'socket.io']) {
    try {
      require.resolve(name, { paths: [root] });
    } catch {
      depsMissing = true;
    }
  }
  if (depsMissing) {
    console.log('[依赖] 首次下载依赖，请保持网络连接…');
    await command(
      process.env.ComSpec || 'cmd.exe',
      [
        '/d',
        '/s',
        '/c',
        'npx.cmd --yes pnpm@10.14.0 install --frozen-lockfile',
      ],
      env
    );
  }
  await command(
    process.execPath,
    [
      '-e',
      "const DB=require('better-sqlite3'); const db=new DB(':memory:'); db.prepare('select 1').get(); db.close();",
    ],
    env
  );
  await command(process.execPath, ['scripts/generate-manifest.js'], env);

  let port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65525)
    throw new Error('.env 的 PORT 必须是 1024–65525 的整数。');
  const requestedPort = port;
  while (port < requestedPort + 10 && !(await freePort(port))) port++;
  if (port === requestedPort + 10)
    throw new Error('连续 10 个端口都被占用，请修改 .env 的 PORT。');
  env.PORT = String(port);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, port }));
  if (port !== requestedPort)
    console.log(
      `[端口] ${requestedPort} 已占用，使用 ${port}，不停止其他项目。`
    );

  console.log(
    `[启动] 站长账号：${env.USERNAME}；密码取自 .env，首次默认 123456。`
  );
  console.log(
    '[启动] 数据库会自动初始化；已有账号、片单、消息和来源不会重置。'
  );
  console.log(
    '[启动] 本地开发模式，首次打开页面需要编译。保持此窗口，Ctrl+C 停止。'
  );
  const logPath = path.join(runtimeDir, 'local-start.log');
  fs.appendFileSync(
    logPath,
    `\n=== ${new Date().toISOString()} local start ===\n`
  );
  server = spawn(process.execPath, ['--regexp-interpret-all', 'server.js'], {
    cwd: root,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
  });
  for (const [source, target] of [
    [server.stdout, process.stdout],
    [server.stderr, process.stderr],
  ]) {
    source.on('data', (chunk) => {
      target.write(chunk);
      fs.appendFileSync(logPath, chunk);
    });
  }
  let exited = false;
  server.on('error', (error) => {
    exited = true;
    console.error(error.message);
    process.exitCode = 1;
    releaseLock();
  });
  server.on('exit', (code, signal) => {
    exited = true;
    releaseLock();
    if (!stopping) {
      console.error(`\n[失败] 服务退出：${code ?? signal}。日志：${logPath}`);
      process.exitCode = 1;
    }
  });
  for (let i = 0; i < 180; i++) {
    if (exited) return;
    if (await ready(port)) {
      console.log('[就绪] 网页服务、SQLite 和长期房间已启动。');
      openBrowser(port);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('启动超过 3 分钟仍未就绪，请查看 .data/local-start.log。');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    server?.kill('SIGTERM');
    releaseLock();
    process.exit(0);
  });
}
process.on('exit', releaseLock);
main().catch((error) => {
  console.error(`\n[失败] ${error.message}`);
  stopping = true;
  server?.kill('SIGTERM');
  releaseLock();
  process.exitCode = 1;
});
