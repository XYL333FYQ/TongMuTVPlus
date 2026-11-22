#!/usr/bin/env node
// 代码警告基线：现有的 ESLint 警告按“文件 :: 规则”计数，记在待清理名单的 lintWarnings 类别里，
// 只许减少；新代码不许新增警告。错误（severity 2）一律失败。
//
//   pnpm check:lint              检查
//   pnpm check:lint --shrink     把变少、修好的条目写回名单（只减不加）
//   pnpm check:lint --baseline   第一次生成基线（名单里已有 lintWarnings 时拒绝）
//
// 计数和比较全部用 scripts/lib/ratchet.mjs，这里只负责跑 ESLint、收集结果。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

import { baseline, compareCounts } from './lib/ratchet.mjs';

const CATEGORY = 'lintWarnings';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowlistPath = path.join(root, 'scripts/structure-allowlist.json');

const args = process.argv.slice(2);
const shrink = args.includes('--shrink');
const makeBaseline = args.includes('--baseline');

const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(['src']);

const warnings = new Map();
const errors = [];
for (const result of results) {
  const file = path.relative(root, result.filePath).split(path.sep).join('/');
  for (const message of result.messages) {
    if (message.severity === 2) {
      errors.push(
        `${file}:${message.line}:${message.column} ${
          message.ruleId ?? '解析'
        } ${message.message}`
      );
    } else if (message.severity === 1) {
      const key = `${file} :: ${message.ruleId ?? 'unknown'}`;
      warnings.set(key, (warnings.get(key) ?? 0) + 1);
    }
  }
}

const total = [...warnings.values()].reduce((sum, n) => sum + n, 0);
if (errors.length) {
  console.error(`代码检查有 ${errors.length} 个错误：`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const writeAllowlist = () =>
  fs.writeFileSync(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);

if (makeBaseline) {
  try {
    allowlist[CATEGORY] = baseline(CATEGORY, warnings, allowlist);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  writeAllowlist();
  console.log(
    `已生成代码警告基线：${total} 条警告，按 文件 × 规则 汇总为 ${allowlist[CATEGORY].length} 条。`
  );
  process.exit(0);
}

if (!Object.hasOwn(allowlist, CATEGORY)) {
  console.error(
    `待清理名单里还没有 ${CATEGORY}，先用 pnpm check:lint --baseline 生成一次`
  );
  process.exit(1);
}

const { failures, next } = compareCounts(
  CATEGORY,
  warnings,
  allowlist[CATEGORY],
  shrink
);
if (shrink && JSON.stringify(next) !== JSON.stringify(allowlist[CATEGORY])) {
  allowlist[CATEGORY] = next;
  writeAllowlist();
  console.log('代码警告基线已按现在的数量写回（只减不加）。');
}
if (failures.length) {
  console.error(`代码警告检查没通过（${failures.length} 条）：`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('新代码不许新增警告，见 docs/STANDARD.md S10。');
  process.exit(1);
}
console.log(`代码警告检查通过：还剩 ${total} 条警告（只许减少）。`);
