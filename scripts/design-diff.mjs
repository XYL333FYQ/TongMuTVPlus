import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Reuse the installed/cached Playwright CLI; never install a project dependency.
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const session = option('session', 'tm-design-diff');
const phase = option('phase', 'before');
const output = path.resolve(
  option('out', 'output/playwright/static-design-20261013')
);
const tolerance = 2;
const fallbackFont = "'Microsoft YaHei', sans-serif";
const cliCandidates = [process.env.TM_PLAYWRIGHT_CLI];
const cache = path.join(os.homedir(), 'AppData/Local/npm-cache/_npx');
if (fs.existsSync(cache)) {
  for (const directory of fs.readdirSync(cache)) {
    cliCandidates.push(
      path.join(
        cache,
        directory,
        'node_modules/@playwright/cli/playwright-cli.js'
      )
    );
  }
}
const cliPath = cliCandidates.find(
  (candidate) => candidate && fs.existsSync(candidate)
);
if (!cliPath)
  throw new Error(
    'Existing Playwright CLI not found. Set TM_PLAYWRIGHT_CLI to its JavaScript entrypoint.'
  );
const cli = (...commands) => {
  const result = spawnSync(
    process.execPath,
    [cliPath, `-s=${session}`, ...commands],
    {
      encoding: 'utf8',
      maxBuffer: 30 * 1024 * 1024,
      windowsHide: true,
    }
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
};
fs.mkdirSync(output, { recursive: true });

export function compare(reference, implementation, rules = {}) {
  const rows = [];
  const types = ['text', 'button', 'card'];
  for (const kind of types) {
    const left = reference.elements.filter((element) => element.kind === kind);
    const right = implementation.elements.filter(
      (element) => element.kind === kind
    );
    const used = new Set();
    for (const item of left) {
      const index = right.findIndex(
        (candidate, i) => !used.has(i) && candidate.key === item.key
      );
      if (index < 0) {
        rows.push({
          category: '不确定需要我决定',
          kind,
          key: item.key,
          property: 'missing',
          reference: item,
          implementation: null,
          reason: '没有同文案/同语义容器；未把数据或状态差异自动视为允许',
        });
        continue;
      }
      used.add(index);
      const actual = right[index];
      for (const property of [
        'x',
        'y',
        'width',
        'height',
        'fontSize',
        'fontWeight',
        'letterSpacing',
        'color',
        'textAlign',
        'background',
        'radius',
      ]) {
        if (item[property] === undefined || actual[property] === undefined)
          continue;
        const a = item[property],
          b = actual[property];
        const numeric = [
          'x',
          'y',
          'width',
          'height',
          'fontSize',
          'letterSpacing',
          'radius',
        ].includes(property);
        const typography = [
          'fontSize',
          'fontWeight',
          'letterSpacing',
          'textAlign',
        ].includes(property);
        if (
          numeric ? Math.abs(a - b) <= (typography ? 0.01 : tolerance) : a === b
        )
          continue;
        const approved = rules.approved?.find(
          (rule) =>
            rule.kind === kind &&
            rule.key === item.key &&
            rule.properties.includes(property)
        );
        rows.push({
          category: typography
            ? '按 TYPOGRAPHY 覆盖'
            : approved
            ? approved.category
            : '必须修正',
          kind,
          key: item.key,
          property,
          reference: a,
          implementation: b,
          delta: numeric ? b - a : null,
          reason: typography
            ? '原画板字号/字重/字距/标题对齐由新版排版规范覆盖；不据此宣布实现符合新版规范'
            : approved?.reason || '同文案/同语义容器的实测差异超过容差',
          referenceSelector: item.selector,
          implementationSelector: actual.selector,
        });
      }
    }
    right.forEach((item, index) => {
      if (!used.has(index))
        rows.push({
          category: '不确定需要我决定',
          kind,
          key: item.key,
          property: 'extra',
          reference: null,
          implementation: item,
          reason: '实现额外可见文案/容器；未自主删除或伪造参考状态',
        });
    });
  }
  return rows;
}

function capture(settings) {
  const root = document.querySelector(settings.scope || 'body');
  if (!root) throw new Error('Measurement scope missing: ' + settings.scope);
  const modal = document.querySelector('dialog:modal');
  const selector = (element) => {
    const parts = [];
    for (
      let current = element;
      current && current.nodeType === 1;
      current = current.parentElement
    ) {
      if (current.id) {
        parts.unshift('#' + CSS.escape(current.id));
        break;
      }
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter(
            (node) => node.tagName === current.tagName
          )
        : [current];
      parts.unshift(
        current.localName +
          ':nth-of-type(' +
          (siblings.indexOf(current) + 1) +
          ')'
      );
      if (current === root) break;
    }
    return parts.join(' > ');
  };
  const normalized = (value) => value.replace(/\s+/g, ' ').trim();
  const visible = (element, rect) => {
    if (!rect.width || !rect.height) return false;
    if (modal && !modal.contains(element) && !element.contains(modal))
      return false;
    let current = element;
    while (current && current.nodeType === 1) {
      const style = getComputedStyle(current);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0
      )
        return false;
      const clip = current.getBoundingClientRect();
      if (
        /(hidden|clip|auto|scroll)/.test(style.overflowX) &&
        (rect.right <= clip.left || rect.left >= clip.right)
      )
        return false;
      if (
        /(hidden|clip|auto|scroll)/.test(style.overflowY) &&
        (rect.bottom <= clip.top || rect.top >= clip.bottom)
      )
        return false;
      current = current.parentElement;
    }
    return (
      settings.fullPage ||
      (rect.bottom > 0 &&
        rect.top < innerHeight &&
        rect.right > 0 &&
        rect.left < innerWidth)
    );
  };
  const properties = (element, rect) => {
    const style = getComputedStyle(element);
    return {
      x: rect.x + scrollX,
      y: rect.y + scrollY,
      width: rect.width,
      height: rect.height,
      fontSize: parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
      letterSpacing:
        style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing),
      color: style.color,
      textAlign: style.textAlign,
      background: style.backgroundColor,
      radius: parseFloat(style.borderTopLeftRadius) || 0,
      selector: selector(element),
    };
  };
  const elements = [];
  const textOwners = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode,
      owner = node.parentElement;
    const text = normalized(node.textContent || '');
    if (!text || !owner || owner.closest('script,style,svg,option,.sr-only'))
      continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (!visible(owner, rect)) continue;
    const group = textOwners.get(owner) || { nodes: [], rects: [] };
    group.nodes.push(node.textContent || '');
    group.rects.push(rect);
    textOwners.set(owner, group);
  }
  for (const [owner, group] of textOwners) {
    const x = Math.min(...group.rects.map((rect) => rect.x)),
      y = Math.min(...group.rects.map((rect) => rect.y));
    const right = Math.max(...group.rects.map((rect) => rect.right)),
      bottom = Math.max(...group.rects.map((rect) => rect.bottom));
    const text = normalized(group.nodes.join(''));
    const data = properties(owner, {
      x,
      y,
      width: right - x,
      height: bottom - y,
    });
    delete data.background;
    delete data.radius;
    elements.push({ kind: 'text', key: text, text, ...data });
  }
  for (const element of root.querySelectorAll(
    'button,a[href],input,textarea,select,[role="button"]'
  )) {
    const rect = element.getBoundingClientRect();
    if (!visible(element, rect)) continue;
    const text = normalized(
      element.innerText ||
        element.getAttribute('aria-label') ||
        element.getAttribute('placeholder') ||
        element.getAttribute('title') ||
        ''
    );
    if (!text) continue;
    elements.push({
      kind: 'button',
      key: settings.buttonAliases?.[text] || text,
      text,
      ...properties(element, rect),
    });
  }
  for (const group of settings.containers || []) {
    [...root.querySelectorAll(group.selector)].forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      if (!visible(element, rect)) return;
      elements.push({
        kind: 'card',
        key: group.name + ':' + index,
        ...properties(element, rect),
      });
    });
  }
  return {
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    documentHeight: document.documentElement.scrollHeight,
    elements,
  };
}

if (args.includes('--self-test')) {
  const text = {
    kind: 'text',
    key: '播放',
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgb(0, 0, 0)',
  };
  const baseline = { elements: [text] };
  assert.equal(compare(baseline, { elements: [{ ...text, x: 12 }] }).length, 0);
  assert.equal(
    compare(baseline, { elements: [{ ...text, x: 12.1 }] }).at(0).category,
    '必须修正'
  );
  assert.equal(
    compare(baseline, { elements: [{ ...text, fontWeight: '700' }] }).at(0)
      .category,
    '按 TYPOGRAPHY 覆盖'
  );
  assert.equal(
    compare(baseline, { elements: [] }).at(0).category,
    '不确定需要我决定'
  );
  assert.equal(
    compare(baseline, { elements: [{ ...text, key: '一起看' }] }).filter(
      (row) => row.category === '不确定需要我决定'
    ).length,
    2
  );
  assert.equal(
    compare(baseline, {
      elements: [{ ...text, color: 'rgb(250, 250, 250)' }],
    }).at(0).category,
    '必须修正'
  );
  assert.equal(
    compare(
      { elements: [text, { ...text, x: 80 }] },
      { elements: [text, { ...text, x: 100 }] }
    ).at(0).delta,
    20
  );
  assert.equal(
    compare(
      { elements: [{ ...text, kind: 'card' }] },
      { elements: [{ ...text, kind: 'card', width: 23 }] }
    ).at(0).property,
    'width'
  );
  console.log('design-diff: 8 comparison assertions passed');
  process.exit(0);
}

const manifestPath = option('manifest');
const cases = manifestPath
  ? JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'))
  : [
      {
        id: option('name', 'comparison'),
        reference: option('reference'),
        url: option('url'),
        width: Number(option('width', 1280)),
        height: Number(option('height', 960)),
        fullPage: args.includes('--full-page'),
      },
    ];
if (!cases.every((item) => item.reference && item.url))
  throw new Error('Provide --manifest, or --reference and --url.');
cli('open', 'about:blank');
const summary = [];
for (const item of cases) {
  const referenceUrl = pathToFileURL(path.resolve(item.reference)).href;
  const directory = path.join(output, phase, item.id);
  fs.mkdirSync(directory, { recursive: true });
  const prepare = item.prepare
    ? fs.readFileSync(path.resolve(item.prepare), 'utf8')
    : 'async () => {}';
  const config = { ...item, referenceUrl, directory, fallbackFont };
  const program = `async (page) => {
    const config=${JSON.stringify(config)};
    const context=page.context();
    await context.route('https://fonts.googleapis.com/**', route=>route.abort());
    await context.route('https://fonts.gstatic.com/**', route=>route.abort());
    const ref=await context.newPage(), actual=await context.newPage();
    await ref.setViewportSize({width:config.width,height:config.height});
    await actual.setViewportSize({width:config.width,height:config.height});
    await ref.emulateMedia({reducedMotion:'reduce'});await actual.emulateMedia({reducedMotion:'reduce'});
    const freeze='*,*::before,*::after{font-family:'+config.fallbackFont+' !important;animation:none !important;transition:none !important}';
    await ref.goto(config.referenceUrl,{waitUntil:'domcontentloaded'});
    await ref.addStyleTag({content:freeze});await ref.evaluate(()=>document.fonts.ready);
    if(config.fullPage){
      config.height=await ref.evaluate(()=>Math.ceil(document.documentElement.scrollHeight));
      await ref.setViewportSize({width:config.width,height:config.height});
      await actual.setViewportSize({width:config.width,height:config.height});
    }
    const collect=${capture.toString()};
    const raw=await ref.evaluate(collect,{...config.referenceSettings,fullPage:config.fullPage});
    await ref.screenshot({path:config.directory+'/reference.png',fullPage:false});
    if(config.typographyCss) await ref.addStyleTag({content:config.typographyCss});
    if(config.referenceTypeProfile) await ref.evaluate(profile=>{
      for(const element of document.body.querySelectorAll('*')){
        const raw=getComputedStyle(element),size=parseFloat(raw.fontSize);
        const text=[...element.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
        element.style.setProperty('letter-spacing','0','important');
        if(size<13 && !/^\\d+\\.\\d+$/.test(text))element.style.setProperty('font-size','13px','important');
        if(size===15){element.style.setProperty('font-size','16px','important');element.style.setProperty('line-height','1.7','important')}
        if(/^\\d+\\.\\d+$/.test(text)&&size===12)element.style.setProperty('font-weight','500','important');
        if(element.tagName==='P'){element.style.setProperty('font-size','16px','important');element.style.setProperty('line-height','1.7','important')}
        if(element.tagName==='H1'){element.style.setProperty('font-size',(profile.kind==='home'&&!profile.mobile?56:profile.mobile?28:32)+'px','important');element.style.setProperty('line-height','1.15','important')}
        if(text==='巴黎绽放的星辰'){element.style.setProperty('font-size',(profile.mobile?34:56)+'px','important');element.style.setProperty('line-height','1.15','important');element.style.setProperty('font-weight','700','important')}
        if(['继续观看','我的房间'].includes(text)){element.style.setProperty('font-size',(profile.mobile?20:24)+'px','important');element.style.setProperty('font-weight','500','important');element.style.setProperty('text-align','left','important')}
        if(['简介','信息','选集'].includes(text)){element.style.setProperty('font-size','18px','important');element.style.setProperty('font-weight','500','important')}
        if(['电影','剧集','动漫','综艺','短剧'].includes(text)&&size>=18){element.style.setProperty('font-size','18px','important');element.style.setProperty('font-weight','500','important');element.parentElement.style.setProperty('justify-content','flex-start','important')}
      }
    },config.referenceTypeProfile);
    const effective=await ref.evaluate(collect,{...config.referenceSettings,fullPage:config.fullPage});
    await ref.screenshot({path:config.directory+'/reference-typography.png',fullPage:false});
    await (${prepare})(actual,config);
    if(!config.prepare)await actual.goto(config.url,{waitUntil:'domcontentloaded'});
    await actual.addStyleTag({content:freeze});await actual.evaluate(()=>document.fonts.ready);await actual.mouse.move(0,0);await actual.waitForTimeout(400);
    if(config.fullPage){
      const height=await actual.evaluate(()=>Math.max(document.documentElement.scrollHeight,document.body.scrollHeight));
      for(let offset=0;offset<height;offset+=Math.max(200,config.height*.75)){
        await actual.evaluate(y=>{window.scrollTo(0,y);document.documentElement.scrollTop=y;document.body.scrollTop=y},offset);await actual.waitForTimeout(160);
      }
      await actual.evaluate(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0});await actual.waitForTimeout(400);
    }
    const implementation=await actual.evaluate(collect,{...config.implementationSettings,fullPage:config.fullPage});
    await actual.screenshot({path:config.directory+'/implementation.png',fullPage:false});
    await ref.close();await actual.close();return{raw,effective,implementation};
  }`;
  const rawResult = cli('run-code', program);
  fs.writeFileSync(path.join(directory, 'browser.log'), rawResult);
  const match = rawResult.match(/### Result\r?\n([\s\S]*?)\r?\n### Ran/);
  if (!match)
    throw new Error(
      'Capture failed; inspect ' + path.join(directory, 'browser.log')
    );
  const snapshots = JSON.parse(match[1]);
  fs.writeFileSync(
    path.join(directory, 'measurements.json'),
    JSON.stringify(snapshots, null, 2)
  );
  const differences = compare(
    snapshots.effective,
    snapshots.implementation,
    item.rules
  );
  const rawTypography = compare(snapshots.raw, snapshots.implementation).filter(
    (row) => row.category === '按 TYPOGRAPHY 覆盖'
  );
  const effectiveTypography = differences
    .filter((row) => row.category === '按 TYPOGRAPHY 覆盖')
    .map((row) => ({
      ...row,
      reason:
        '实现与 TYPOGRAPHY 对照值仍有差异；本类不计必须修正，但必须单独验收排版',
      status: 'pending-typography',
    }));
  const coveredTypography = rawTypography
    .filter(
      (row) =>
        !effectiveTypography.some(
          (e) =>
            e.kind === row.kind &&
            e.key === row.key &&
            e.property === row.property
        )
    )
    .map((row) => ({ ...row, status: 'covered-typography' }));
  const combined = [
    ...differences.filter((row) => row.category !== '按 TYPOGRAPHY 覆盖'),
    ...effectiveTypography,
    ...coveredTypography,
  ];
  fs.writeFileSync(
    path.join(directory, 'diff.json'),
    JSON.stringify(combined, null, 2)
  );
  const encode = (value) =>
    '"' +
    String(
      typeof value === 'object' ? JSON.stringify(value) : value ?? ''
    ).replaceAll('"', '""') +
    '"';
  const fields = [
    'category',
    'kind',
    'key',
    'property',
    'reference',
    'implementation',
    'delta',
    'reason',
    'referenceSelector',
    'implementationSelector',
  ];
  fs.writeFileSync(
    path.join(directory, 'diff.csv'),
    '\uFEFF' +
      [
        fields.join(','),
        ...combined.map((row) =>
          fields.map((field) => encode(row[field])).join(',')
        ),
      ].join('\n')
  );
  const counts = Object.fromEntries(
    [
      '必须修正',
      '真实数据导致允许',
      '不确定需要我决定',
      '按 TYPOGRAPHY 覆盖',
    ].map((category) => [
      category,
      combined.filter((row) => row.category === category).length,
    ])
  );
  const record = {
    id: item.id,
    width: item.width,
    height: snapshots.raw.viewport.height,
    tolerance,
    fallbackFont,
    counts,
  };
  summary.push(record);
  fs.writeFileSync(
    path.join(output, phase, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(record));
  const html =
    '<!doctype html><meta charset="utf-8"><title>' +
    item.id +
    '</title><style>body{margin:24px;font-family:sans-serif}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%;border:1px solid #ccc}</style><h1>' +
    item.id +
    '</h1><p>原始参考与实现；相同回退字体。布局统计另使用 reference-typography.png。</p><main><section><h2>参考</h2><img src="reference.png"></section><section><h2>实现</h2><img src="implementation.png"></section></main>';
  fs.writeFileSync(path.join(directory, 'comparison.html'), html);
}
