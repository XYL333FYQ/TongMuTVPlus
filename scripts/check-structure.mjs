#!/usr/bin/env node
// 结构检查：把 docs/STANDARD.md 里能机器判断的规则落成检查（S2 / S4 / S5 / S6 / S8）。
//
//   node scripts/check-structure.mjs                    检查；有新违规或名单里有已修好的条目就失败
//   node scripts/check-structure.mjs --shrink           把变少、修好的条目写回待清理名单（只减不加）
//   node scripts/check-structure.mjs --baseline <类别>  给名单里还没有的类别第一次生成旧账（每个类别只能一次）
//   node scripts/check-structure.mjs --verbose          另外列出超过 400 行的文件
//
// 待清理名单：scripts/structure-allowlist.json。每条是“键 ×数量”，只许减少（scripts/lib/ratchet.mjs）。
// 依赖方向（S1）由 ESLint 的 no-restricted-imports 检查，它的待清理名单也在同一个文件里（imports）；
// 代码警告的基线（lintWarnings）由 scripts/check-lint-baseline.mjs 维护。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseRules,
  splitSelectorList,
  selectorSpine,
  subjectClass,
} from './lib/css-rules.mjs';
import { countMatches, isAllowedImportant } from './lib/detectors.mjs';
import {
  findMissingPaths,
  ownedBy,
  readPartsRegistry,
  readSizeExceptions,
} from './lib/parts-registry.mjs';
import { baseline, compareCounts } from './lib/ratchet.mjs';
import {
  CORE_CODE,
  CORE_CSS,
  inScope,
  tierOf,
} from './lib/structure-scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowlistPath = path.join(root, 'scripts/structure-allowlist.json');
const standardPath = path.join(root, 'docs/STANDARD.md');
const TOKENS_FILE = 'src/styles/tokens.css';
// STANDARD.md“允许的例外”里登记的不拆大文件：只有行数提醒跳过它们
const SIZE_EXCEPTIONS = new Set(
  readSizeExceptions(fs.readFileSync(standardPath, 'utf8'))
);
const tooLong = (file, lines) =>
  lines > MAX_LINES && !SIZE_EXCEPTIONS.has(file);
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
const texts = new Map();
const read = (file) => {
  if (!texts.has(file)) {
    texts.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  }
  return texts.get(file);
};
const isTest = (file) => /\.test\.[cm]?[jt]sx?$/.test(file);
const isCode = (file) => /\.tsx?$/.test(file) && !isTest(file);
const isScript = (file) => /\.[cm]?[jt]sx?$/.test(file);
// 公共零件目录：里面的每个文件都必须是登记表里某个零件的主人
const PART_DIRS = ['src/components/feedback/', 'src/components/ui/'];
// 规范的“法律文件”：里面写的路径由检查保证存在
const LAW_DOCS = ['AGENTS.md', 'docs/README.md', 'docs/STANDARD.md'];

/** 计数：同一个键出现一次加一 */
const bump = (counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1);

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
        bump(violations.duplicates, `${file} :: ${key}`);
      seenSelectors.add(key);
    }

    if (file !== TOKENS_FILE && selectors.some(isRootSelector)) {
      for (const decl of rule.declarations) {
        if (decl.prop.startsWith('--tm-')) {
          bump(violations.tokens, `${file} :: ${decl.prop}`);
        }
      }
    }

    // S5：!important 只许压第三方内联样式、减弱动效、关闭玻璃、主题切换动画，其余按文件计数
    for (const decl of rule.declarations) {
      if (
        /!\s*important$/i.test(decl.value) &&
        !isAllowedImportant(rule.selector, rule.atRules)
      ) {
        bump(violations.important, file);
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
        bump(violations.zIndex, `${file} :: z-index: ${value}`);
      }
    }

    if (file.startsWith('src/features/')) {
      for (const media of rule.atRules) {
        if (PX_WIDTH_MEDIA.test(media)) {
          bump(violations.pxMedia, `${file} :: ${media}`);
        }
      }
    }

    for (const selector of selectors) {
      const subject = subjectClass(selector);
      // tm-app 是 body 上的全站根标记，挂在它下面的原生元素规则属于全局基础样式
      if (!subject || subject === 'tm-app') continue;
      const block = blockOf(subject, owners);
      if (!block) bump(violations.blocks, `${file} :: 未登记 ${subject}`);
      else if (owners.get(block) !== file) {
        bump(
          violations.blocks,
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
    bump(violations.eslintDisable, file);
  }

  for (const pattern of TSX_Z) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1];
      if (Z_SMALL.test(value) || /^var\(--tm-z-/.test(value)) continue;
      if (/^[a-zA-Z_]/.test(value) && !value.startsWith('var(')) continue; // 变量，由它的来源负责
      bump(violations.zIndex, `${file} :: ${match[0]}`);
    }
  }

  if (tooLong(file, lines.length))
    warnings.push(`${file}（${lines.length} 行）`);
}

const TIERS = ['核心', '常用上游', '上游'];

/** 按三档（scripts/structure-scope.json）汇总一个类别的数量 */
function tierSummary(found) {
  const tiers = [0, 0, 0];
  for (const [file, count] of found) tiers[tierOf(file) - 1] += count;
  const total = tiers.reduce((sum, n) => sum + n, 0);
  const parts = TIERS.map((name, i) => `${name} ${tiers[i]}`).join(' / ');
  return `剩 ${total}（${parts}）`;
}

/**
 * S2 公共零件登记表：每个零件只有主人能直接用原材料。统计主人以外的文件，
 * 结果放进 counted 的 parts:<探测器> 类别，和名单比。
 */
function checkParts(counted, failures) {
  const { rows, problems } = readPartsRegistry(
    read(path.relative(root, standardPath))
  );
  failures.push(...problems.map((problem) => `[parts] ${problem}`));
  const code = allFiles.filter(isCode);

  for (const row of rows) {
    for (const owner of row.owners) {
      if (!fs.existsSync(path.join(root, owner))) {
        failures.push(`[parts] 零件“${row.part}”的主人不存在：${owner}`);
      }
    }
    if (!row.detector) continue;
    const found = new Map();
    for (const file of code) {
      if (ownedBy(file, row.owners)) continue;
      const count = countMatches(read(file), row.detector);
      if (count) found.set(file, count);
    }
    counted[`parts:${row.detector}`] = found;
  }

  // 公共零件目录里的文件，都必须是登记表里某个零件的主人
  const allOwners = rows.flatMap((row) => row.owners);
  for (const file of code) {
    if (
      PART_DIRS.some((dir) => file.startsWith(dir)) &&
      !ownedBy(file, allOwners)
    ) {
      failures.push(`[parts] 公共零件未登记：${file}`);
    }
  }
  return rows.filter((row) => row.detector);
}

function run() {
  const { owners, problems } = readRegistry();
  const violations = {
    tokens: new Map(),
    zIndex: new Map(),
    pxMedia: new Map(),
    duplicates: new Map(),
    blocks: new Map(),
    eslintDisable: new Map(),
    important: new Map(),
    eslintDisableInline: new Map(),
  };
  const warnings = [];

  for (const file of allFiles) {
    if (file.endsWith('.css') && inScope(file, CORE_CSS)) {
      checkCss(file, owners, violations);
      const lines = read(file).split('\n').length;
      if (tooLong(file, lines)) warnings.push(`${file}（${lines} 行）`);
    } else if (isCode(file) && inScope(file, CORE_CODE)) {
      checkCode(file, violations, warnings);
    }
  }

  // S8：行内跳过代码检查的注释，全部 src（含测试）按文件计数，只许减少
  for (const file of allFiles.filter(isScript)) {
    const count = countMatches(read(file), 'eslintDisableInline');
    if (count) violations.eslintDisableInline.set(file, count);
  }

  const failures = [...problems];
  const counted = { ...violations };
  const partRows = checkParts(counted, failures);

  // “法律文件”里写的路径必须真的存在（历史记录类文档不查）
  for (const doc of LAW_DOCS) {
    for (const missing of findMissingPaths(read(doc), (p) =>
      fs.existsSync(path.join(root, p))
    )) {
      failures.push(`[docs] ${doc} 写了不存在的路径：${missing}`);
    }
  }

  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const args = process.argv.slice(2);
  const shrink = args.includes('--shrink');
  const writeAllowlist = () =>
    fs.writeFileSync(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);

  const baselineAt = args.indexOf('--baseline');
  if (baselineAt !== -1) {
    const category = args[baselineAt + 1];
    if (!category || !Object.hasOwn(counted, category)) {
      console.error(
        `--baseline 后面要写一个类别：${Object.keys(counted).join(' ')}`
      );
      process.exit(1);
    }
    if (failures.length) {
      console.error('登记表有问题，先修好再生成基线：');
      for (const failure of failures) console.error(`  ${failure}`);
      process.exit(1);
    }
    try {
      allowlist[category] = baseline(category, counted[category], allowlist);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
    writeAllowlist();
    console.log(
      `已生成 ${category} 的旧账基线：${
        allowlist[category].length
      } 条，${tierSummary(counted[category])}。`
    );
    return;
  }

  let changed = false;
  for (const [category, found] of Object.entries(counted)) {
    if (!Object.hasOwn(allowlist, category)) {
      failures.push(
        `[${category}] 待清理名单里还没有这个类别，先用 --baseline ${category} 生成一次`
      );
      continue;
    }
    const result = compareCounts(category, found, allowlist[category], shrink);
    failures.push(...result.failures);
    if (
      shrink &&
      JSON.stringify(result.next) !== JSON.stringify(allowlist[category])
    ) {
      allowlist[category] = result.next;
      changed = true;
    }
  }

  // ESLint 依赖方向的待清理名单：文件必须还在
  for (const file of allowlist.imports ?? []) {
    if (!fs.existsSync(path.join(root, file))) {
      if (shrink) {
        allowlist.imports = allowlist.imports.filter((item) => item !== file);
        changed = true;
      } else
        failures.push(`[imports] 文件已不存在，请用 --shrink 删掉：${file}`);
    }
  }

  if (changed) {
    writeAllowlist();
    console.log('待清理名单已按现在的数量写回（只减不加）。');
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
  console.log('公共零件旧账（主人以外直接用原材料的次数，只许减少）：');
  for (const row of partRows) {
    console.log(
      `  ${row.detector}（${row.part}）${tierSummary(
        counted[`parts:${row.detector}`]
      )}`
    );
  }
  if (args.includes('--verbose')) {
    for (const warning of warnings) console.log(`  ${warning}`);
  }
}

run();
