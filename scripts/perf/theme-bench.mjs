#!/usr/bin/env node
// 主题切换基准测试（本机用，不进 CI）。
//
// 用本机的 Edge / Chrome（无界面模式）按手机尺寸、CPU 放慢若干倍，反复在深色 ⇄ 浅色之间切换，
// 分方向统计切换过程中的逐帧间隔：
//   - 帧数：切换期间浏览器出了多少帧（越多越流畅）
//   - 慢帧：间隔超过 24ms 的帧数（60Hz 下一帧 16.7ms，超过说明掉帧）
//   - 最长帧：最长的一次间隔
//   - 长任务：主线程超过 50ms 的忙碌块总时长
// 用来对比"深→浅"和"浅→深"是否对称，以及每次改动前后的变化。
//
// 用法（先启动网站，例如生产服务）：
//   node scripts/perf/theme-bench.mjs --url http://localhost:3001 --cpu 4 --rounds 4
// 只依赖 Node 24 自带的 fetch / WebSocket，不新增任何依赖。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, index, all) =>
      arg.startsWith('--') ? [arg.slice(2), all[index + 1]] : null
    )
    .filter(Boolean)
);
const baseUrl = (args.url || 'http://localhost:3000').replace(/\/$/, '');
const cpuRate = Number(args.cpu || 4);
const rounds = Number(args.rounds || 4);
const port = Number(args.port || 9334);
const wide = args.wide === 'true';

function findBrowser() {
  if (args.browser) return args.browser;
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) throw new Error('找不到 Edge / Chrome，用 --browser 指定路径');
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      // 浏览器还没起来
    }
    await sleep(100);
  }
  throw new Error('浏览器调试端口没有响应');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { ready, send, close: () => ws.close() };
}

// 在页面里执行：点“浅色”或“深色”，记录接下来 1.6 秒的逐帧间隔与主线程长任务。
// 手机宽度用游客菜单里的主题按钮，电脑宽度用顶栏里的主题切换按钮。
const MEASURE = (target) => `new Promise((resolve) => {
  const menu = document.querySelector('.tm-guest-menu');
  const button = menu && [...menu.querySelectorAll('button')].find((b) => b.textContent.trim() === '${target}');
  if (!button) return resolve({ error: 'no-theme-button' });
  const long = [];
  let observer;
  try {
    observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => long.push(e.duration)));
    observer.observe({ type: 'longtask' });
  } catch (e) {}
  const frames = [];
  let last = performance.now();
  const t0 = last;
  button.click();
  const loop = (now) => {
    frames.push(now - last);
    last = now;
    if (now - t0 < 1600) requestAnimationFrame(loop);
    else {
      if (observer) observer.disconnect();
      resolve({
        frames: frames.length,
        slow: frames.filter((d) => d > 24).length,
        worst: Math.max(...frames),
        longTotal: long.reduce((a, b) => a + b, 0),
        isDark: document.documentElement.classList.contains('dark'),
      });
    }
  };
  requestAnimationFrame(loop);
})`;

const median = (values) => {
  const list = values
    .filter((v) => typeof v === 'number')
    .sort((a, b) => a - b);
  if (!list.length) return null;
  return Math.round(list[Math.floor(list.length / 2)]);
};

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-theme-bench-'));
  const browser = spawn(
    findBrowser(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${wide ? '1280,800' : '390,844'}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  const cdp = connect(await waitForDebugger());
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: wide ? 1280 : 390,
      height: wide ? 800 : 844,
      deviceScaleFactor: wide ? 1 : 3,
      mobile: !wide,
    });
    if (!wide)
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Page.navigate', { url: baseUrl + '/' });
    const evaluate = async (expression) =>
      (
        await send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        })
      ).result.value;
    for (let i = 0; i < 120; i++) {
      if (await evaluate('!!document.querySelector(".tm-guest-menu")')) break;
      await sleep(500);
    }
    // 游客菜单是 <details>，先展开才能点到主题按钮
    await evaluate(
      'document.querySelector(".tm-guest-account")?.setAttribute("open","")'
    );
    // 预热：来回切一轮，等字体、图片、样式都就位
    for (const target of ['浅色', '深色', '浅色', '深色']) {
      await evaluate(MEASURE(target));
      await sleep(900);
    }
    await send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    const toLight = [];
    const toDark = [];
    for (let r = 0; r < rounds; r++) {
      await sleep(900);
      const a = await evaluate(MEASURE('浅色'));
      if (a?.error) throw new Error('找不到主题按钮：' + a.error);
      toLight.push(a);
      await sleep(900);
      toDark.push(await evaluate(MEASURE('深色')));
    }
    const line = (name, list) =>
      `${name.padEnd(6)} 帧数 ${String(
        median(list.map((x) => x.frames))
      ).padStart(3)}  慢帧 ${String(median(list.map((x) => x.slow))).padStart(
        3
      )}  最长帧 ${String(median(list.map((x) => x.worst))).padStart(
        4
      )}ms  长任务 ${String(median(list.map((x) => x.longTotal))).padStart(
        4
      )}ms`;
    console.log(
      `CPU 放慢 ${cpuRate} 倍，${
        wide ? '1280 宽' : '390 宽'
      }，${rounds} 轮，取中位数`
    );
    console.log(line('深→浅', toLight));
    console.log(line('浅→深', toDark));
  } finally {
    cdp.close();
    browser.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
