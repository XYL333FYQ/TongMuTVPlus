// 改前改后计算样式对比（本机测试站）。
//
//   node scripts/e2e/style-snapshot.mjs snap <输出目录> [页面...]
//   node scripts/e2e/style-snapshot.mjs diff <改前目录> <改后目录> [噪声目录]
//
// 用本机 Chrome 无头模式 + DevTools 协议（Node 自带 WebSocket，不加依赖）：
// 登录本机测试站（测试账号见 test-env.mjs），按 5 种窗口 × 深浅两种主题打开每个页面，
// 记录每个元素的位置、大小和主要计算样式。diff 只报差异；噪声目录（同一份代码跑两次的差异）里出现过的键不算。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { BASE, CHROME, readRoomId, readTestEnv } from './test-env.mjs';

const PORT = 9333;

export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, touch: true, mobile: true },
  { name: 'phone-land', width: 844, height: 390, touch: true, mobile: true },
  { name: 'tablet', width: 820, height: 1180, touch: true, mobile: true },
  { name: 'tablet-land', width: 1280, height: 800, touch: true, mobile: true },
  { name: 'laptop', width: 1280, height: 800, touch: false, mobile: false },
  { name: 'desktop', width: 1440, height: 900, touch: false, mobile: false },
];
const THEMES = ['dark', 'light'];

const PROPS = [
  'display',
  'position',
  'z-index',
  'visibility',
  'opacity',
  'color',
  'background-color',
  'background-image',
  'border-top-width',
  'border-top-color',
  'border-bottom-width',
  'border-left-width',
  'border-right-width',
  'border-radius',
  'box-shadow',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'padding',
  'margin',
  'gap',
  'flex-direction',
  'justify-content',
  'align-items',
  'grid-template-columns',
  'overflow',
  'transform',
  'filter',
  'backdrop-filter',
  'pointer-events',
  'cursor',
  'object-fit',
  'inset',
];

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

const COLLECT = `(() => {
  const PROPS = ${JSON.stringify(PROPS)};
  document.getAnimations().forEach((a) => { try { a.finish(); } catch {} });
  const out = {};
  const seen = new Map();
  const keyOf = (el) => {
    const parts = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const cls = [...node.classList].filter((c) => !/^(art-|__|css-)/.test(c) || c.startsWith('art-video-player')).sort().join('.');
      let part = node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + (cls ? '.' + cls : '');
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ':' + same.indexOf(node);
      }
      parts.unshift(part);
      if (parts.length > 7) break;
    }
    return parts.join(' > ');
  };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const rec = { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',') };
    for (const p of PROPS) rec[p] = cs.getPropertyValue(p);
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      const content = ps.getPropertyValue('content');
      if (content && content !== 'none' && content !== 'normal') {
        rec[pseudo] = [content, ps.display, ps.position, ps.width, ps.height, ps.backgroundColor, ps.backgroundImage, ps.opacity, ps.transform, ps.zIndex, ps.inset, ps.borderRadius].join(' | ');
      }
    }
    let key = keyOf(el);
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (n) key += ' #' + n;
    out[key] = rec;
  }
  const html = document.documentElement;
  out['<html>'] = {
    attrs: [...html.attributes].filter((a) => a.name !== 'style').map((a) => a.name + '=' + a.value).sort().join(' '),
    scroll: document.documentElement.scrollWidth + 'x' + document.documentElement.scrollHeight,
  };
  return JSON.stringify(out);
})()`;

async function snap(outDir, pages) {
  const env = readTestEnv();
  const profile = path.join(outDir, '..', '.chrome-profile');
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
    const s = (method, params) => cdp.send(method, params, sessionId);
    await s('Page.enable');
    await s('Runtime.enable');
    await s('DOM.enable');
    await s('CSS.enable');
    // 离开页面的确认框（播放中）会卡住导航：一律确认
    cdp.listeners.push((msg) => {
      if (
        msg.method === 'Page.javascriptDialogOpening' &&
        msg.sessionId === sessionId
      ) {
        s('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
    });

    const go = async (href) => {
      const loaded = cdp.waitFor('Page.loadEventFired', sessionId, 240000);
      await s('Page.navigate', { url: BASE + href });
      await loaded;
    };
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await s('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (exceptionDetails)
        throw new Error(JSON.stringify(exceptionDetails).slice(0, 500));
      return result.value;
    };

    await go('/login');
    const login = await evaluate(
      `fetch('/api/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(${JSON.stringify(
        process.env.SNAP_USER === 'member'
          ? {
              username: env.TEST_MEMBER_USERNAME,
              password: env.TEST_MEMBER_PASSWORD,
            }
          : { username: env.USERNAME, password: env.PASSWORD }
      )})}).then((r) => r.status)`
    );
    if (login !== 200) throw new Error(`登录失败：${login}`);

    fs.mkdirSync(outDir, { recursive: true });
    for (const viewport of VIEWPORTS) {
      await s('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
      });
      await s('Emulation.setTouchEmulationEnabled', {
        enabled: viewport.touch,
        ...(viewport.touch ? { maxTouchPoints: 5 } : {}),
      });
      await s('Emulation.setEmulatedMedia', {
        features: [
          { name: 'pointer', value: viewport.touch ? 'coarse' : 'fine' },
          { name: 'hover', value: viewport.touch ? 'none' : 'hover' },
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ],
      });
      for (const theme of THEMES) {
        // 换主题：先离开上一个页面（播放中的页面卸载时可能把旧主题写回去），再写、再确认
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await go('/login');
          await evaluate(`localStorage.setItem('theme', '${theme}')`);
          await go('/login');
          await sleep(800);
          if (
            await evaluate(
              `document.documentElement.classList.contains('${theme}')`
            )
          )
            break;
        }
        for (const page of pages) {
          // 续拍：测试站中途崩了，重跑时跳过已拍好的
          if (
            fs.existsSync(
              path.join(outDir, `${page.name}__${viewport.name}__${theme}.json`)
            )
          )
            continue;
          // SNAP_NO_ROOM=1：拍房间以外的页面前忘掉记住的房间（不在房间里的状态，没有房间小窗）
          // SNAP_INIT_JS：每页导航前在当前页执行一段脚本（比如把小窗位置设成和改前一样）
          if (process.env.SNAP_INIT_JS)
            await evaluate(process.env.SNAP_INIT_JS);
          if (process.env.SNAP_NO_ROOM && !page.name.startsWith('room'))
            await evaluate(`localStorage.removeItem('watch_room_info')`);
          await go(page.href.replace('{ROOM}', () => readRoomId()));
          await sleep(page.wait ?? 3500);
          const prepared = page.prepare ? await evaluate(page.prepare) : null;
          // hover：页面里先给要悬停的元素打上 data-snap-hover，这里用 DevTools 强制 :hover（悬停样式也能对比）
          if (page.hover) {
            const { root } = await s('DOM.getDocument', { depth: 0 });
            const { nodeIds } = await s('DOM.querySelectorAll', {
              nodeId: root.nodeId,
              selector: '[data-snap-hover]',
            });
            for (const nodeId of nodeIds)
              await s('CSS.forcePseudoState', {
                nodeId,
                forcedPseudoClasses: ['hover'],
              });
          }
          await sleep(500);
          let json = await evaluate(COLLECT);
          if (prepared)
            json = JSON.stringify({
              '<prepare>': { result: String(prepared) },
              ...JSON.parse(json),
            });
          const file = path.join(
            outDir,
            `${page.name}__${viewport.name}__${theme}.json`
          );
          fs.writeFileSync(file, json);
          process.stderr.write(`${page.name}/${viewport.name}/${theme} ${
            Object.keys(JSON.parse(json)).length
          }
`);
        }
      }
    }
    process.stdout.write('\n');
  } finally {
    cdp.ws.close();
    chrome.kill();
  }
}

// SNAP_RENAME=<json 文件>：[["正则", "替换"], ...]，改名后把改前快照里的类名换成新名再比较
const RENAMES = process.env.SNAP_RENAME
  ? JSON.parse(fs.readFileSync(process.env.SNAP_RENAME, 'utf8')).map(
      ([re, to]) => [new RegExp(re, 'g'), to]
    )
  : [];
const stripClasses = (raw) =>
  Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key
        .split(' > ')
        .map((part) =>
          part.replace(
            /^([a-z0-9-]+(?:#[^.\s]+)?)\..*?((?::\d+)?(?: #\d+)?)$/i,
            '$1$2'
          )
        )
        .join(' > '),
      value,
    ])
  );
function loadAfter(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return process.env.SNAP_NOCLASS ? stripClasses(raw) : raw;
}
function loadBefore(file) {
  const raw0 = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (process.env.SNAP_NOCLASS) return stripClasses(raw0);
  const raw = raw0;
  if (!RENAMES.length) return raw;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    // 只处理改名碰到的那一段：改名、去重、按新名字重新排序（和采集时的写法一致）
    const k = key
      .split(' > ')
      .map((part) => {
        let renamed = part;
        for (const [re, to] of RENAMES) renamed = renamed.replace(re, to);
        if (renamed === part) return part;
        const suffix = renamed.match(/(:\d+)?( #\d+)?$/)[0];
        const body = renamed.slice(0, renamed.length - suffix.length);
        const [head, ...classes] = body.split('.');
        const list = [...new Set(classes)].sort();
        return `${head}${list.length ? `.${list.join('.')}` : ''}${suffix}`;
      })
      .join(' > ');
    out[k] = value;
  }
  return out;
}
function diff(beforeDir, afterDir, noiseDir) {
  const noise = new Set();
  if (noiseDir) {
    for (const file of fs.readdirSync(noiseDir)) {
      if (!file.endsWith('.json')) continue;
      const a = loadBefore(path.join(beforeDir, file));
      const b = loadBefore(path.join(noiseDir, file));
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key]))
          noise.add(`${file}|${key}`);
      }
    }
  }
  let total = 0;
  const report = [];
  for (const file of fs.readdirSync(beforeDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const afterFile = path.join(afterDir, file);
    if (!fs.existsSync(afterFile)) {
      report.push(`${file}: 改后没有这个快照`);
      continue;
    }
    const a = loadBefore(path.join(beforeDir, file));
    const b = loadAfter(afterFile);
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (noise.has(`${file}|${key}`)) continue;
      if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
      total += 1;
      if (!a[key]) report.push(`${file}\n  + ${key}`);
      else if (!b[key]) report.push(`${file}\n  - ${key}`);
      else {
        const changes = Object.keys({ ...a[key], ...b[key] })
          .filter((p) => a[key][p] !== b[key][p])
          .map((p) => `${p}: ${a[key][p]} → ${b[key][p]}`);
        report.push(`${file}\n  ~ ${key}\n      ${changes.join('\n      ')}`);
      }
    }
  }
  console.log(report.slice(0, Number(process.env.SNAP_LIMIT || 80)).join('\n'));
  console.log(`\n差异 ${total} 处（噪声已排除 ${noise.size} 个键）`);
  process.exitCode = total ? 1 : 0;
}

const [command, ...args] = process.argv.slice(2);
if (command === 'snap') {
  const pagesFile = path.join(
    import.meta.dirname,
    process.env.SNAP_USER === 'member'
      ? 'snapshot-pages-member.json'
      : 'snapshot-pages.json'
  );
  const all = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
  const wanted = args.slice(1);
  const pages = wanted.length
    ? all.filter((p) => wanted.includes(p.name))
    : all;
  await snap(path.resolve(args[0]), pages);
} else if (command === 'diff') {
  diff(
    path.resolve(args[0]),
    path.resolve(args[1]),
    args[2] && path.resolve(args[2])
  );
} else {
  console.log('用法：snap <目录> [页面...] | diff <改前> <改后> [噪声]');
}
