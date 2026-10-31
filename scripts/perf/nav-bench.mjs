#!/usr/bin/env node
// 手机底栏切页基准测试（本机用，不进 CI）。
//
// 用本机的 Edge / Chrome（无界面模式）打开网站，按手机尺寸、CPU 放慢若干倍，
// 依次点底栏的几个标签，每次记录：
//   - 滑块第一次移动：点下去之后多久，底栏有反应
//   - 页面挂载：新页面的内容容器出现的时间
//   - 主线程长任务：点下去后 1 秒内，超过 50ms 的"忙碌块"总时长与最长一块
// 最后打印每项的中位数。每次改动前后各跑一次，用数字说话。
//
// 用法（先启动网站，例如 pnpm dev 或生产服务）：
//   node scripts/perf/nav-bench.mjs --url http://localhost:3000 --cpu 4 --rounds 3
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
const rounds = Number(args.rounds || 3);
const port = Number(args.port || 9333);

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

// 在页面里执行：点第 index 个底栏项，逐帧记录滑块与页面
const MEASURE = (index) => `new Promise((resolve) => {
  const nav = document.querySelector('.tm-mobile-nav');
  const link = nav && nav.querySelectorAll('a')[${index}];
  if (!link) return resolve({ error: 'no-nav' });
  const thumbEl = () => nav.querySelector('.tm-mobile-nav-thumb');
  const left0 = thumbEl() ? thumbEl().getBoundingClientRect().left : null;
  const page0 = document.querySelector('.tm-page-transition');
  const long = [];
  let observer;
  try {
    observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => long.push(e.duration)));
    observer.observe({ type: 'longtask' });
  } catch (e) {}
  let thumbMs = null, pageMs = null;
  const t0 = performance.now();
  link.click();
  const loop = () => {
    const t = performance.now() - t0;
    const th = thumbEl();
    if (thumbMs === null && th && left0 !== null && Math.abs(th.getBoundingClientRect().left - left0) > 0.5) thumbMs = t;
    const page = document.querySelector('.tm-page-transition');
    if (pageMs === null && page && page !== page0) pageMs = t;
    if (t < 1000) requestAnimationFrame(loop);
    else {
      if (observer) observer.disconnect();
      resolve({ thumbMs, pageMs, longTotal: long.reduce((a, b) => a + b, 0), longMax: Math.max(0, ...long) });
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-nav-bench-'));
  const browser = spawn(
    findBrowser(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=390,844',
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
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
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
    // 等底栏出现（开发模式首次编译可能要几十秒）
    for (let i = 0; i < 120; i++) {
      if (await evaluate('!!document.querySelector(".tm-mobile-nav a")')) break;
      await sleep(500);
    }
    if (!(await evaluate('!!document.querySelector(".tm-mobile-nav a")'))) {
      throw new Error(
        '首页上没有底栏，当前地址：' + (await evaluate('location.href'))
      );
    }
    // 预热：每个标签点一遍，让开发模式编译、生产模式预取完成
    for (const index of [1, 2, 3, 0, 1, 2, 3, 0]) {
      await evaluate(MEASURE(index));
      await sleep(800);
    }
    await send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    const names = ['发现', '片库', '房间', '搜索'];
    const samples = [];
    for (let r = 0; r < rounds; r++) {
      for (const index of [2, 3, 1, 0]) {
        await sleep(900);
        const result = await evaluate(MEASURE(index));
        if (result?.error) throw new Error('页面上没有底栏：' + result.error);
        samples.push({ to: names[index], ...result });
      }
    }
    console.log(
      `\n手机 390×844，CPU 放慢 ${cpuRate} 倍，${samples.length} 次切页（${baseUrl}）\n`
    );
    console.log('去往   滑块起步ms  页面挂载ms  长任务合计ms  最长长任务ms');
    for (const s of samples) {
      const f = (v) => String(v === null ? '-' : Math.round(v)).padStart(10);
      console.log(
        `${s.to.padEnd(4)} ${f(s.thumbMs)} ${f(s.pageMs)} ${f(s.longTotal)} ${f(
          s.longMax
        )}`
      );
    }
    console.log(
      `\n中位数：滑块起步 ${median(
        samples.map((s) => s.thumbMs)
      )}ms，页面挂载 ${median(
        samples.map((s) => s.pageMs)
      )}ms，长任务合计 ${median(
        samples.map((s) => s.longTotal)
      )}ms，最长长任务 ${median(samples.map((s) => s.longMax))}ms`
    );
  } finally {
    cdp.close();
    browser.kill();
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
