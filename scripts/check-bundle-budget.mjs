#!/usr/bin/env node
// 首屏脚本体积预算：`pnpm build` 之后运行。
// 读取 .next/app-build-manifest.json，算出每个页面打开时要先下载的脚本（gzip 后）有多大，
// 超过预算就失败——防止哪次改动又把大块代码（比如繁简字典）塞回每个页面。
//
// 用法：node scripts/check-bundle-budget.mjs [--report]
//   --report 只打印表格，不判失败。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = process.cwd();
const manifestPath = path.join(root, '.next', 'app-build-manifest.json');

// 预算（KB，gzip 后）。数字来自 2026-10-30 全站优化（首屏瘦身、账号菜单拆分、
// 房间连接库按需下载）后的实测值再留约 10%～15% 余量：最重的普通页（我的）257KB、
// 管理后台 246KB。原来的 480/640 是瘦身前定的，太松，大块代码塞回首屏也拦不住。
// 页面真的需要变大时，改这里并在提交说明里写清原因。
export const BUDGET_KB = {
  default: 290,
  '/admin/page': 280,
};

export function gzipSize(file) {
  return zlib.gzipSync(fs.readFileSync(file)).length;
}

export function measurePages(manifest, readSize) {
  const cache = new Map();
  const result = [];
  for (const [route, files] of Object.entries(manifest.pages || {})) {
    if (!route.endsWith('/page')) continue;
    let total = 0;
    for (const file of new Set(files)) {
      if (!file.endsWith('.js')) continue;
      if (!cache.has(file)) cache.set(file, readSize(file));
      total += cache.get(file);
    }
    result.push({ route, kb: Math.round(total / 1024) });
  }
  return result.sort((a, b) => b.kb - a.kb);
}

export function overBudget(rows, budget = BUDGET_KB) {
  return rows.filter((row) => row.kb > (budget[row.route] ?? budget.default));
}

function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error('找不到 .next/app-build-manifest.json，请先运行 pnpm build');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const rows = measurePages(manifest, (file) =>
    gzipSize(path.join(root, '.next', file))
  );
  for (const row of rows) {
    const limit = BUDGET_KB[row.route] ?? BUDGET_KB.default;
    console.log(
      `${row.kb > limit ? '超出' : '  ok'}  ${String(row.kb).padStart(
        5
      )} KB / ${limit} KB  ${row.route}`
    );
  }
  if (process.argv.includes('--report')) return;
  const failed = overBudget(rows);
  if (failed.length) {
    console.error(`\n${failed.length} 个页面首屏脚本超出预算`);
    process.exit(1);
  }
  console.log('\n全部页面首屏脚本在预算内');
}

// 直接运行时才执行；被别的脚本 import 时只提供函数
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
