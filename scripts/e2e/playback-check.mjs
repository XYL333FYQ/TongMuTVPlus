// 自己看播放器行为记录（本机测试站）：node scripts/e2e/playback-check.mjs <输出.json>
// 用本机 200 秒 WAV（Range 服务器）直链播放，记录：能不能播、设置菜单各项、控制条按钮、
// 去小窗再回来是不是同一个 <video>、进度是否连续。只记录不判断：改前改后各跑一次，对比两份 JSON。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BASE, CHROME, readTestEnv, serveTestMedia } from './test-env.mjs';

const PORT = 9335;
const outFile = process.argv[2];
if (!outFile) {
  console.error('用法：node scripts/e2e/playback-check.mjs <输出.json>');
  process.exit(2);
}
const env = readTestEnv();
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const listener of this.listeners) listener(msg);
      }
    });
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 超时`));
      }, 240000);
      this.pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
    });
  }
  waitFor(method, sessionId, timeout = 30000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
        resolve(null);
      }, timeout);
      const listener = (msg) => {
        if (msg.method === method && msg.sessionId === sessionId) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((l) => l !== listener);
          resolve(msg);
        }
      };
      this.listeners.push(listener);
    });
  }
}

async function launchChrome(profileDir) {
  fs.mkdirSync(profileDir, { recursive: true });
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const { webSocketDebuggerUrl } = await res.json();
      return { chrome, url: webSocketDebuggerUrl };
    } catch {
      await sleep(200);
    }
  }
  chrome.kill();
  throw new Error('Chrome 没有启动');
}

const media = await serveTestMedia(3198);

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(str) {
  const bytes = new TextEncoder().encode(str);
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    out = ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out;
}

const out = {};
const profile = path.join(os.tmpdir(), 'tm-playback-check-profile');
const { chrome, url } = await launchChrome(profile);
const cdp = new Cdp(url);
await cdp.open();
try {
  const { targetId } = await cdp.send('Target.createTarget', {
    url: 'about:blank',
  });
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const s = (m, p) => cdp.send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  const errors = [];
  cdp.listeners.push((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Page.javascriptDialogOpening')
      s('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    if (msg.method === 'Runtime.exceptionThrown')
      errors.push(
        msg.params.exceptionDetails.exception?.description?.slice(0, 200) ||
          msg.params.exceptionDetails.text
      );
  });
  await s('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const go = async (href) => {
    const l = cdp.waitFor('Page.loadEventFired', sessionId, 240000);
    await s('Page.navigate', { url: BASE + href });
    await l;
  };
  const ev = async (expression) => {
    const { result, exceptionDetails } = await s('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails)
      throw new Error(JSON.stringify(exceptionDetails).slice(0, 400));
    return result.value;
  };
  await go('/login');
  const login = await ev(
    `fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(
      { username: env.USERNAME, password: env.PASSWORD }
    )})}).then(r=>r.status)`
  );
  if (login !== 200) throw new Error('login ' + login);
  await ev(
    `localStorage.removeItem('watch_room_info'); localStorage.removeItem('preferredPlaybackRate')`
  );
  const mediaUrl = 'http://localhost:3198/test.wav';
  await go(
    `/play?source=directplay&id=${base58(mediaUrl)}&title=${encodeURIComponent(
      '检查用'
    )}`
  );
  await sleep(10000);
  const state = `(() => { const v = document.querySelector('[data-tm-player-mount] video'); window.__v = window.__v || v; return { hasVideo: !!v, same: v === window.__v, time: v ? Math.round(v.currentTime*10)/10 : null, paused: v ? v.paused : null, src: v ? v.currentSrc.split('?')[0] : null, volume: v ? v.volume : null, presentation: document.documentElement.dataset.tmPlaybackPresentation, mask: !!document.querySelector('.tm-playback-video-frame > .absolute.inset-0'), maskText: (document.querySelector('.tm-playback-video-frame > .absolute.inset-0')||{}).innerText || '' }; })()`;
  out.loaded = await ev(state);
  out.play = await ev(
    `(async () => { const v = document.querySelector('[data-tm-player-mount] video'); try { await v.play(); } catch (e) { return 'play failed ' + e.message; } await new Promise(r => setTimeout(r, 3000)); return Math.round(v.currentTime*10)/10; })()`
  );
  out.controls = await ev(
    `[...document.querySelectorAll('.art-controls .art-control')].map(c => (c.getAttribute('data-index')||'') + ':' + ([...c.classList].find(x=>x.startsWith('art-control-'))||'') + ':' + (c.getAttribute('aria-label')||c.getAttribute('data-tooltip')||'')).join(' | ')`
  );
  out.settings = await ev(
    `(() => { const items = [...document.querySelectorAll('.art-settings .art-setting-panel.art-current .art-setting-item, .art-settings .art-setting-item')]; return [...new Set(items.map(i => (i.querySelector('.art-setting-item-left-text')||i).innerText.trim().split(/\\s+/).join(' ')))].join(' | '); })()`
  );
  out.settingsRaw = await ev(
    `[...document.querySelectorAll('.art-settings .art-setting-panel')].map(p => p.children.length + ':' + [...p.children].map(c => c.innerText.trim().split(/\s+/)[0]).join(',')).join(' || ')`
  );
  out.gpu = await ev(
    '(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter())))()'
  );

  const clickSetting = (text) =>
    ev(
      `(async () => { const item = [...document.querySelectorAll('.art-settings .art-setting-item')].find(i => (i.innerText || '').trim().startsWith('${text}')); if (!item) return 'missing'; item.click(); await new Promise(r => setTimeout(r, 4000)); const n = document.querySelector('.art-notice-inner'); return { canvas: !!document.querySelector('.tm-anime4k-canvas, [data-tm-player-mount] canvas[style*="object-fit"]'), notice: n ? n.innerText : '' }; })()`
    );
  out.anime4kOn = await clickSetting('Anime4K超分');
  out.anime4kOff = await clickSetting('Anime4K超分');
  out.subtitleMenu = await ev(
    `(async () => { const it = [...document.querySelectorAll('.art-settings .art-setting-item')].find(i => (i.innerText||'').trim().startsWith('字幕') && !(i.innerText||'').includes('大小')); it && it.click(); await new Promise(r => setTimeout(r, 500)); const panels = [...document.querySelectorAll('.art-settings .art-setting-panel')]; const p = panels.find(p => [...p.children].some(c => (c.innerText||'').trim() === '上传本地字幕')); return p ? [...p.children].map(c => c.innerText.trim()).join(',') : 'none'; })()`
  );
  out.danmakuPlugin = await ev(
    `!!document.querySelector('.artplayer-plugin-danmuku')`
  );
  out.heatmap = await ev(
    `!!document.querySelector('#custom-heatmap-canvas, .tm-heatmap-canvas')`
  );
  const key = (k, code) =>
    `(async () => { const v = document.querySelector('[data-tm-player-mount] video'); const before = { volume: v.volume, paused: v.paused, time: Math.round(v.currentTime) }; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', code: '${
      code || ''
    }', bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 400)); const n = document.querySelector('.art-notice-inner'); return { before, after: { volume: v.volume, paused: v.paused, time: Math.round(v.currentTime), rate: v.playbackRate }, notice: n ? n.innerText : '' }; })()`;
  out.keyDown = await ev(key('ArrowDown'));
  out.keyRight = await ev(key('ArrowRight'));
  out.keyRate = await ev(key('+', 'NumpadAdd'));
  out.rateStored = await ev(`localStorage.getItem('preferredPlaybackRate')`);
  out.touch = await ev(`!!document.querySelector('.tm-touch')`);
  // 去片库：小窗继续播，同一个 <video>
  out.miniClick = await ev(
    `(() => { if (window.next && window.next.router) { window.next.router.push('/douban'); return 'router'; } return 'none'; })()`
  );
  await sleep(12000);
  out.mini = await ev(state);
  out.miniSpace = await ev(key(' '));
  // 回播放页
  out.backClick = await ev(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'') === '回到播放页'); b && b.click(); return !!b; })()`
  );
  await sleep(12000);
  out.back = await ev(state);
  out.backRate = await ev(
    `document.querySelector('[data-tm-player-mount] video').playbackRate`
  );
  // 重新打开：倍速记忆
  await go(
    `/play?source=directplay&id=${base58(mediaUrl)}&title=${encodeURIComponent(
      '检查用'
    )}`
  );
  await sleep(10000);
  out.reloadRate = await ev(
    `(() => { const v = document.querySelector('[data-tm-player-mount] video'); return v ? v.playbackRate : null; })()`
  );
  await ev(`localStorage.removeItem('preferredPlaybackRate')`);
  out.errors = errors;
} finally {
  chrome.kill();
  media.close();
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(0);
