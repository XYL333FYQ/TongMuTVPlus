#!/usr/bin/env node
// 结构检查：把 docs/STANDARD.md 里能机器判断的规则落成检查（S2 / S4 / S5 / S6 / S8）。
//
//   node scripts/check-structure.mjs            检查；有新违规或名单里有已修好的条目就失败
//   node scripts/check-structure.mjs --shrink   把已修好的条目从待清理名单里删掉（只删不加）
//
// 待清理名单：scripts/structure-allowlist.json。只允许变短，全部做完时必须为空。
// 依赖方向（S1）由 ESLint 的 no-restricted-imports 检查，它的待清理名单也在同一个文件里。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseRules,
  splitSelectorList,
  selectorSpine,
  subjectClass,
} from './lib/css-rules.mjs';
import { CORE_CODE, CORE_CSS, inScope } from './lib/structure-scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowlistPath = path.join(root, 'scripts/structure-allowlist.json');
const standardPath = path.join(root, 'docs/STANDARD.md');
const TOKENS_FILE = 'src/styles/tokens.css';
const MAX_LINES = 400;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

const allFiles = walk('src');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/** 块名登记表：STANDARD.md “块名登记表”一节里的表格，第一列是类名前缀，第二列是归属文件 */
function readRegistry() {
  const text = read(path.relative(root, standardPath));
  const start = text.indexOf('## 块名登记表');
  if (start === -1) throw new Error('docs/STANDARD.md 缺少“块名登记表”一节');
  const section = text.slice(start).split(/\n## /)[0];
  const owners = new Map();
  const problems = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 4 || !cells[1].includes('`tm-')) continue;
    const file = cells[2].replace(/`/g, '');
    for (const [, prefix] of cells[1].matchAll(/`(tm-[a-z0-9-]+)`/g)) {
      if (owners.has(prefix)) {
        problems.push(
          `块 ${prefix} 登记了两次（${owners.get(prefix)} / ${file}）`
        );
      }
      owners.set(prefix, file);
    }
    if (!fs.existsSync(path.join(root, file))) {
      problems.push(`登记表里的文件不存在：${file}`);
    }
  }
  return { owners, problems };
}

/** 类名按最长的已登记前缀找归属块 */
function blockOf(className, owners) {
  let best = null;
  for (const prefix of owners.keys()) {
    if (
      (className === prefix || className.startsWith(`${prefix}-`)) &&
      (!best || prefix.length > best.length)
    ) {
      best = prefix;
    }
  }
  return best;
}

const PX_WIDTH_MEDIA =
  /\b(min-|max-)?width\s*:\s*[\d.]+px|\bwidth\s*[<>]=?\s*[\d.]+px/;
// 选中根元素本身（:root、html.light、html[data-tm-device='phone']），不是根下面的某个组件。
// 组件在自己的块上局部改写令牌（比如深色画面上的加载动画）不算定义令牌。
const isRootSelector = (selector) =>
  /^(:root|html)([.:[][^\s>+~]*)?$/.test(selectorSpine(selector).trim());
// 层级令牌，或紧贴某一层的上下：calc(var(--tm-z-overlay) - 1)
const Z_TOKEN =
  /^(var\(--tm-z-[a-z-]+\)|calc\(var\(--tm-z-[a-z-]+\)\s*[+-]\s*[1-3]\))$/;
const Z_SMALL = /^-?[0-3]$/;
const Z_KEYWORD = /^(auto|inherit|initial|unset)$/;

function checkCss(file, owners, violations) {
  const rules = parseRules(read(file));
  const seenSelectors = new Set();
  for (const rule of rules) {
    const selectors = splitSelectorList(rule.selector);

    // S5：同一个选择器（在同样的 @media 之下）在一个文件里只能出现一次
    for (const selector of selectors) {
      const key = [...rule.atRules, selector].join(' ⟩ ');
      if (seenSelectors.has(key))
        violations.duplicates.add(`${file} :: ${key}`);
      seenSelectors.add(key);
    }

    if (file !== TOKENS_FILE && selectors.some(isRootSelector)) {
      for (const decl of rule.declarations) {
        if (decl.prop.startsWith('--tm-')) {
          violations.tokens.add(`${file} :: ${decl.prop}`);
        }
      }
    }

    for (const decl of rule.declarations) {
      if (decl.prop !== 'z-index') continue;
      const value = decl.value.replace(/\s*!important$/, '');
      if (
        !Z_TOKEN.test(value) &&
        !Z_SMALL.test(value) &&
        !Z_KEYWORD.test(value)
      ) {
        violations.zIndex.add(`${file} :: z-index: ${value}`);
      }
    }

    if (file.startsWith('src/features/')) {
      for (const media of rule.atRules) {
        if (PX_WIDTH_MEDIA.test(media)) {
          violations.pxMedia.add(`${file} :: ${media}`);
        }
      }
    }

    for (const selector of selectors) {
      const subject = subjectClass(selector);
      // tm-app 是 body 上的全站根标记，挂在它下面的原生元素规则属于全局基础样式
      if (!subject || subject === 'tm-app') continue;
      const block = blockOf(subject, owners);
      if (!block) violations.blocks.add(`${file} :: 未登记 ${subject}`);
      else if (owners.get(block) !== file) {
        violations.blocks.add(
          `${file} :: ${block}（属于 ${owners.get(block)}）`
        );
      }
    }
  }
}

const TSX_Z = [
  /\bz-(\d+)\b/g, // Tailwind z-10 / z-50
  /\bz-\[([^\]]+)\]/g, // Tailwind z-[9999]
  /zIndex\s*:\s*['"]?([^,'"}\s]+)/g, // style={{ zIndex: 20 }}
];

function checkCode(file, violations, warnings) {
  const text = read(file);
  const lines = text.split('\n');

  // 块注释形式的 eslint-disable 从所在行一直关到文件末尾，等于整文件关掉
  if (lines.some((line) => /^\/\*\s*eslint-disable(?!-)/.test(line.trim()))) {
    violations.eslintDisable.add(file);
  }

  for (const pattern of TSX_Z) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1];
      if (Z_SMALL.test(value) || /^var\(--tm-z-/.test(value)) continue;
      if (/^[a-zA-Z_]/.test(value) && !value.startsWith('var(')) continue; // 变量，由它的来源负责
      violations.zIndex.add(`${file} :: ${match[0]}`);
    }
  }

  if (lines.length > MAX_LINES) warnings.push(`${file}（${lines.length} 行）`);
}

function run() {
  const { owners, problems } = readRegistry();
  const violations = {
    tokens: new Set(),
    zIndex: new Set(),
    pxMedia: new Set(),
    duplicates: new Set(),
    blocks: new Set(),
    eslintDisable: new Set(),
  };
  const warnings = [];

  for (const file of allFiles) {
    if (file.endsWith('.css') && inScope(file, CORE_CSS)) {
      checkCss(file, owners, violations);
      const lines = read(file).split('\n').length;
      if (lines > MAX_LINES) warnings.push(`${file}（${lines} 行）`);
    } else if (
      /\.(ts|tsx)$/.test(file) &&
      !/\.test\.tsx?$/.test(file) &&
      inScope(file, CORE_CODE)
    ) {
      checkCode(file, violations, warnings);
    }
  }

  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const shrink = process.argv.includes('--shrink');
  const failures = [...problems];
  let removed = 0;

  for (const [rule, found] of Object.entries(violations)) {
    const allowed = new Set(allowlist[rule] ?? []);
    for (const item of found) {
      if (!allowed.has(item)) failures.push(`[${rule}] ${item}`);
    }
    const fixed = [...allowed].filter((item) => !found.has(item));
    if (fixed.length && shrink) {
      allowlist[rule] = (allowlist[rule] ?? []).filter((item) =>
        found.has(item)
      );
      removed += fixed.length;
    } else {
      for (const item of fixed) {
        failures.push(
          `[${rule}] 已修好，请用 --shrink 从待清理名单删掉：${item}`
        );
      }
    }
  }

  // ESLint 依赖方向的待清理名单：文件必须还在
  for (const file of allowlist.imports ?? []) {
    if (!fs.existsSync(path.join(root, file))) {
      if (shrink) {
        allowlist.imports = allowlist.imports.filter((item) => item !== file);
        removed += 1;
      } else
        failures.push(`[imports] 文件已不存在，请用 --shrink 删掉：${file}`);
    }
  }

  if (shrink && removed) {
    fs.writeFileSync(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);
    console.log(`待清理名单删掉了 ${removed} 条。`);
  }

  const remaining = Object.values(allowlist).reduce(
    (sum, list) => sum + list.length,
    0
  );

  if (warnings.length) {
    console.log(
      `提醒：${warnings.length} 个核心文件超过 ${MAX_LINES} 行（S6，只提醒）`
    );
  }
  if (failures.length) {
    console.error(`结构检查没通过（${failures.length} 条）：`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error('规则见 docs/STANDARD.md。');
    process.exit(1);
  }
  console.log(`结构检查通过。待清理名单还剩 ${remaining} 条。`);
  if (process.argv.includes('--verbose')) {
    for (const warning of warnings) console.log(`  ${warning}`);
  }
}

run();
