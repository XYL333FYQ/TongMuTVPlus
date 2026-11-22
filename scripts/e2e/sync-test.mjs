// 两个账号实测房间同步（本机测试站）。
//   node scripts/e2e/sync-test.mjs
// 一个无头 Chrome、两个互相隔离的浏览器上下文：房主（test.env 的主账号）和成员（第二个账号），
// 都进 seed-test.mjs 建的测试房间。房主播放 / 暂停 / 拖进度，成员要跟上；成员发聊天，房主要收到。
//
// 测试片默认用本机生成的 200 秒 WAV（test-env.mjs，本脚本起一个支持 Range 的小服务器），
// 开始前房主把房间影片换成它：外网测试视频（media.w3.org）常在两边卡在 0 秒或被播放器重连拉回 0 秒，
// 和同步无关却会让测试失败。SYNC_TEST_MEDIA=remote 用回房间原来的外网视频。
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
  await s('Page.navigate', { url: `${BASE}/watch-room?room=${ROOM}` });
  return { name, run, send: s };
}

const VIDEO = `document.querySelector('.tm-room-view video')`;
const state = (c) =>
  c.run(
    `(() => { const v = ${VIDEO}; return v ? { paused: v.paused, t: Math.round(v.currentTime * 10) / 10, ready: v.readyState } : null })()`
  );
async function until(c, test, what, timeout = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await state(c);
    if (last && test(last)) return { ok: true, last, ms: Date.now() - start };
    await sleep(300);
  }
  return { ok: false, last, what };
}
const results = [];
let ownerRef = null;
// ownerKept：房主自己的画面还保持着这次操作（没被拉回）。
// 没跟上时，房主保持住、成员的视频还在加载（readyState < 3）= 外部测试视频网速问题（NET），
// 不算同步失败；房主自己被拉回，或成员已加载好却没跟上 = 同步失败（FAIL）。
const report = async (label, r, ownerKept) => {
  if (ownerRef) r.owner = await state(ownerRef);
  let verdict = r.ok ? 'PASS' : 'FAIL';
  if (
    !r.ok &&
    ownerKept &&
    r.owner &&
    ownerKept(r.owner) &&
    r.last &&
    r.last.ready < 3
  )
    verdict = 'NET';
  results.push({ label, verdict });
  console.log(
    `${verdict} ${label}${
      r.ms !== undefined ? `（${r.ms} ms）` : ''
    } 成员 ${JSON.stringify(r.last)} 房主 ${JSON.stringify(r.owner)}`
  );
};

try {
  const owner = await client('房主', env.USERNAME, env.PASSWORD);
  const member = await client(
    '成员',
    env.TEST_MEMBER_USERNAME,
    env.TEST_MEMBER_PASSWORD
  );
  ownerRef = owner;
  for (const c of [owner, member]) {
    const r = await until(c, (v) => v.ready >= 1, `${c.name} 画面就绪`, 90000);
    await report(`${c.name} 进房间、画面加载`, r);
    if (!r.ok) throw new Error('画面没加载');
  }

  // SYNC_TEST_SLOW=1：画面就绪后把成员网速压到很慢（测试片每秒 8 KB），成员反复缓冲，
  // 房间“等缓冲”会反复暂停、继续，房主的同步引擎因此不停替房间暂停 / 播放 / 跳转——
  // 用户操作最容易被误当成回声的情形。这时成员跟不上是网速（NET），要看的是房主自己有没有被拉回。
  if (process.env.SYNC_TEST_SLOW) {
    await member.send('Network.enable');
    await member.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: 9000,
      uploadThroughput: 50000,
    });
    console.log('成员网速已限制');
  }

  // 房主先暂停在开头，作为起点
  await owner.run(`${VIDEO}.pause()`);
  await report(
    '成员跟着暂停（起点）',
    await until(member, (v) => v.paused, '暂停')
  );

  await owner.run(`${VIDEO}.play()`);
  await report(
    '房主播放 → 成员也在播',
    await until(member, (v) => !v.paused && v.t > 0, '播放'),
    (o) => !o.paused
  );

  await sleep(3000);
  await owner.run(`${VIDEO}.pause()`);
  const ownerPaused = await state(owner);
  await report(
    '房主暂停 → 成员也暂停，位置差 < 1.5 秒',
    await until(
      member,
      (v) => v.paused && Math.abs(v.t - ownerPaused.t) < 1.5,
      '暂停'
    ),
    (o) => o.paused
  );

  await sleep(3000);
  await owner.run(`${VIDEO}.currentTime = 120`);
  await report(
    '房主拖到 120 秒 → 成员也到 120 秒附近',
    await until(member, (v) => Math.abs(v.t - 120) < 1.5, '拖进度'),
    (o) => Math.abs(o.t - 120) < 1.5
  );

  await owner.run(`${VIDEO}.play()`);
  await report(
    '房主从 120 秒接着播 → 成员也在播',
    await until(member, (v) => !v.paused && v.t >= 120, '播放'),
    (o) => !o.paused && o.t >= 120
  );
  await owner.run(`${VIDEO}.pause()`);
  await sleep(2000);

  // 连着拖两次（第一次被第二次打断，只有一个 seeked）
  await owner.run(
    `(() => { const v = ${VIDEO}; v.currentTime = 60; v.currentTime = 90; })()`
  );
  await report(
    '房主连着拖到 60、90 秒 → 成员到 90 秒附近，房主没被拉回',
    await until(member, (v) => Math.abs(v.t - 90) < 1.5, '连续拖动'),
    (o) => Math.abs(o.t - 90) < 1.5
  );
  await sleep(1000);
  const ownerAfterSeeks = await state(owner);
  await report('房主连着拖动后自己的位置保持在 90 秒附近', {
    ok: Math.abs(ownerAfterSeeks.t - 90) < 1.5,
    last: ownerAfterSeeks,
  });

  // 刚播放 0.6 秒就暂停
  await owner.run(`${VIDEO}.play()`);
  await sleep(600);
  await owner.run(`${VIDEO}.pause()`);
  await report(
    '房主播放后 0.6 秒暂停 → 成员也暂停',
    await until(member, (v) => v.paused, '快速暂停'),
    (o) => o.paused
  );
  await sleep(2500);
  const ownerAfterQuickPause = await state(owner);
  await report('房主快速暂停后自己没有被重新播起来', {
    ok: ownerAfterQuickPause.paused,
    last: ownerAfterQuickPause,
  });

  // 成员发一条聊天，房主那边要出现
  const text = `同步测试 ${Date.now() % 100000}`;
  const sent = await member.run(`(async () => {
    const input = document.querySelector('.tm-room-chat textarea, .tm-room-chat input[type=text], .tm-room-chat-compose textarea, .tm-room-chat-compose input');
    if (!input) return 'no-input';
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(
      text
    )});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const form = input.closest('form');
    if (form) form.requestSubmit(); else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'sent';
  })()`);
  let seen = false;
  for (let i = 0; i < 30 && !seen; i++) {
    seen = await owner.run(
      `document.body.innerText.includes(${JSON.stringify(text)})`
    );
    if (!seen) await sleep(300);
  }
  await report(`成员发聊天 → 房主收到（${sent}）`, { ok: seen, last: seen });
} catch (error) {
  console.log(`ERROR ${error.message}`);
  results.push({ label: 'error', verdict: 'FAIL' });
} finally {
  ws.close();
  chrome.kill();
  mediaServer?.close();
}
const failed = results.filter((r) => r.verdict === 'FAIL').length;
const slow = results.filter((r) => r.verdict === 'NET').length;
console.log(
  failed
    ? `${failed} 项同步失败`
    : slow
    ? `同步没有失败；${slow} 项因测试视频加载慢没法判断（NET）`
    : '全部通过'
);
process.exitCode = failed ? 1 : slow ? 2 : 0;
