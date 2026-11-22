// 自己看实测（本机测试站）：播放页建播放器、播放、离开页面转小窗（同一个视频元素接着播）、回到播放页。
//   node scripts/e2e/solo-test.mjs
// 片子默认用本机生成的 200 秒 WAV（test-env.mjs，本脚本起一个支持 Range 的小服务器）；SYNC_TEST_MEDIA=remote 用外网视频。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import {
  BASE,
  CHROME,
  readRoomId,
  readTestEnv,
  ROOT,
  serveTestMedia,
} from './test-env.mjs';

const PORT = 9334;
const env = readTestEnv();
const ROOM = readRoomId();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MEDIA_PORT = 3199;
const LOCAL_MEDIA = process.env.SYNC_TEST_MEDIA !== 'remote';
let mediaServer = null;
if (LOCAL_MEDIA) {
  mediaServer = await serveTestMedia(MEDIA_PORT, '127.0.0.1');

  // 房主把房间影片换成本机测试片（暂停在 0 秒）
  const require = createRequire(path.join(ROOT, 'package.json'));
  const { io } = require('socket.io-client');
  const bs58 = require('bs58').default ?? require('bs58');
  const login = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.USERNAME, password: env.PASSWORD }),
  });
  if (login.status !== 200) throw new Error(`房主登录失败 ${login.status}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const socket = io(BASE, {
    transports: ['websocket'],
    extraHeaders: { cookie },
  });
  const ack = (event, payload) =>
    new Promise((resolve) =>
      socket
        .timeout(10000)
        .emit(event, payload, (err, reply) =>
          resolve(err ? { error: String(err) } : reply)
        )
    );
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  await ack('room:join', { roomId: ROOM, userName: env.USERNAME });
  const url = `http://127.0.0.1:${MEDIA_PORT}/sync-test.wav`;
  const changed = await ack('play:change', {
    type: 'play',
    url: '',
    source: 'directplay',
    videoId: bs58.encode(Buffer.from(url)),
    videoName: '同步测试片',
    episode: 1,
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    commandId: `sync-test-${Date.now()}`,
  });
  socket.close();
  if (!changed?.success)
    throw new Error(`换测试片失败：${JSON.stringify(changed)}`);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-sync-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ],
  { stdio: 'ignore' }
);
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    wsUrl = (
      await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    ).webSocketDebuggerUrl;
  } catch {
    await sleep(200);
  }
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error
      ? p.reject(new Error(JSON.stringify(m.error)))
      : p.resolve(m.result);
  } else if (m.method === 'Page.javascriptDialogOpening') {
    send('Page.handleJavaScriptDialog', { accept: true }, m.sessionId).catch(
      () => {}
    );
  }
});
function send(method, params = {}, sessionId) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(
      () =>
        pending.has(id) &&
        (pending.delete(id), reject(new Error(`${method} 超时`))),
      120000
    );
  });
}

async function client(name, username, password) {
  const { browserContextId } = await send('Target.createBrowserContext');
  const { targetId } = await send('Target.createTarget', {
    url: 'about:blank',
    browserContextId,
  });
  const { sessionId } = await send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const run = async (expression) => {
    const { result, exceptionDetails } = await s('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails)
      throw new Error(
        `${name}: ${
          exceptionDetails.exception?.description || exceptionDetails.text
        }`
      );
    return result.value;
  };
  await s('Page.navigate', { url: `${BASE}/login` });
  await sleep(4000);
  const status = await run(
    `fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(
      { username, password }
    )})}).then(r=>r.status)`
  );
  if (status !== 200) throw new Error(`${name} 登录失败 ${status}`);

  return { name, run, send: s };
}

// —— 自己看：播放页建播放器、播放、离开页面转小窗（同一个视频元素继续播）、回到播放页 ——
const require2 = createRequire(path.join(ROOT, 'package.json'));
const bs58 = require2('bs58').default ?? require2('bs58');
const results = [];
const check = (label, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} ${JSON.stringify(detail)}`);
};
const waitFor = async (c, expr, ms = 30000) => {
  const start = Date.now();
  let last;
  while (Date.now() - start < ms) {
    last = await c.run(expr);
    if (last && (typeof last !== 'object' || last.ok)) return last;
    await sleep(400);
  }
  return last;
};
try {
  const user = await client('自己看', env.USERNAME, env.PASSWORD);
  const mediaUrl = LOCAL_MEDIA
    ? `http://127.0.0.1:${MEDIA_PORT}/sync-test.wav`
    : 'https://media.w3.org/2010/05/bunny/movie.mp4';
  const id = bs58.encode(Buffer.from(mediaUrl));
  await user.send('Page.navigate', {
    url: `${BASE}/play?source=directplay&id=${id}&title=${encodeURIComponent(
      '自己看测试'
    )}`,
  });
  const ready = await waitFor(
    user,
    `(() => { const v = document.querySelector('.art-video-player video'); return { ok: !!v && v.readyState >= 1, dur: v ? Math.round(v.duration || 0) : 0 }; })()`,
    60000
  );
  check('播放页建好播放器、片子加载', ready?.ok, ready);
  await user.run(
    `(async () => { const v = document.querySelector('.art-video-player video'); v.muted = true; window.__soloVideo = v; await v.play(); })()`
  );
  const playing = await waitFor(
    user,
    `(() => { const v = window.__soloVideo; return { ok: !v.paused && v.currentTime > 0.5, t: v.currentTime }; })()`
  );
  check('开始播放', playing?.ok, playing);
  await user.run(
    `(() => { const a = [...document.querySelectorAll('a[href="/"]')].find((x) => x.offsetParent); a && a.click(); return !!a; })()`
  );
  const mini = await waitFor(
    user,
    `(() => { const v = document.querySelector('video'); return { ok: location.pathname === '/' && v === window.__soloVideo && !v.paused, path: location.pathname, same: v === window.__soloVideo, paused: v ? v.paused : null, presentation: document.documentElement.dataset.tmPlaybackPresentation }; })()`
  );
  check('离开播放页：同一个视频元素在小窗里接着播', mini?.ok, mini);
  const t1 = await user.run(`window.__soloVideo.currentTime`);
  await sleep(2000);
  const t2 = await user.run(`window.__soloVideo.currentTime`);
  check('小窗里时间在走', t2 > t1 + 1, { t1, t2 });
  await user.run(`history.back()`);
  const back = await waitFor(
    user,
    `(() => { const v = document.querySelector('.art-video-player video'); return { ok: location.pathname === '/play' && v === window.__soloVideo && !v.paused, path: location.pathname, same: v === window.__soloVideo, presentation: document.documentElement.dataset.tmPlaybackPresentation }; })()`
  );
  check('回到播放页：还是同一个视频元素，接着播', back?.ok, back);
} catch (error) {
  console.log(`ERROR ${error.message}`);
  results.push(false);
} finally {
  ws.close();
  chrome.kill();
  mediaServer?.close();
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} 项没通过` : '全部通过');
process.exitCode = failed ? 1 : 0;
