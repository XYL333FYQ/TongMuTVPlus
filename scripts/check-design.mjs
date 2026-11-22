// 设计检查（AGENTS.md “视觉硬规则”）：彩色类、写死 hex、bg-gradient、小于 12px 的字号。
//
//   node scripts/check-design.mjs <文件> [更多文件]   检查指定文件
//   node scripts/check-design.mjs --core               检查整个核心范围（scripts/structure-scope.json）

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CORE_CODE, CORE_CSS, inScope } from './lib/structure-scope.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const palettes =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const colors = new RegExp(
  `\\b(?:bg|text|border|ring|outline|decoration|shadow|divide|accent|caret|fill|stroke|from|via|to)-(?:${palettes})-\\d{2,3}(?:\\/[^\\s'"\x60}]+)?`,
  'g'
);

/** Static source check; it cannot prove computed CSS or dynamic class values. */
export function scanText(source, file = '') {
  const findings = [];
  const lines = source.split(/\r?\n/);
  let blockComment = false;
  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    const todo =
      /TODO-P5:\s*\S/.test(original) ||
      /\/\*\s*TODO-P5:\s*[^*]+\*\//.test(lines[index - 1] || '');
    // Strip comments while preserving columns; never suppress an entire file.
    let line = '';
    for (let col = 0; col < original.length; col += 1) {
      if (!blockComment && original.slice(col, col + 2) === '/*') {
        blockComment = true;
        line += '  ';
        col += 1;
      } else if (blockComment && original.slice(col, col + 2) === '*/') {
        blockComment = false;
        line += '  ';
        col += 1;
      } else line += blockComment ? ' ' : original[col];
    }
    if (/^\s*\/\//.test(line)) continue;
    const add = (kind, match) =>
      findings.push({
        file,
        line: index + 1,
        column: match.index + 1,
        kind,
        value: match[0],
        todo,
      });
    for (const match of line.matchAll(colors)) add('彩色类', match);
    for (const match of line.matchAll(
      /#[\da-fA-F]{8}\b|#[\da-fA-F]{6}\b|#[\da-fA-F]{4}\b|#[\da-fA-F]{3}\b/g
    )) {
      const before = line.slice(0, match.index);
      if (/(?:href|src|url)\s*(?:=|:)\s*['"]?[^'"\s]*$/.test(before)) continue;
      // --tm-* 令牌的定义是 DESIGN.md 认可的颜色来源：hex 落在 --tm-x: 的值里就不算
      if (/--tm-[\w-]+\s*:[^;{}]*$/.test(before)) continue;
      add('写死 hex', match);
    }
    for (const match of line.matchAll(/\bbg-gradient-[\w-]+/g))
      add('bg-gradient', match);
    // em 相对父元素，静态算不出实际大小，不判断；px 和 rem（按 16px）照旧
    for (const match of line.matchAll(
      /\btext-\[(\d*\.?\d+)(px|rem)\]|\bfontSize\s*:\s*(\d*\.?\d+)\b|\bfont(?:-size|Size)\s*:\s*['"]?(\d*\.?\d+)(px|rem)\b/g
    )) {
      const value = Number(match[1] ?? match[3] ?? match[4]);
      const unit = match[2] ?? match[5] ?? 'px';
      if (value * (unit === 'px' ? 1 : 16) < 12) add('小于 12px', match);
    }
  }
  return findings;
}

/** 核心范围里的 .css / .ts / .tsx（不含测试），正斜杠、相对仓库根目录 */
export function coreFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(resolve(root, 'src'));
  return out
    .filter((file) =>
      file.endsWith('.css')
        ? inScope(file, CORE_CSS)
        : /\.tsx?$/.test(file) &&
          !/\.test\.tsx?$/.test(file) &&
          inScope(file, CORE_CODE)
    )
    .sort();
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const paths = args.includes('--core')
    ? [...coreFiles(), ...args.filter((arg) => arg !== '--core')]
    : args;
  if (!paths.length) {
    console.error(
      '用法：node scripts/check-design.mjs <文件路径> [更多文件路径]，或 --core 检查整个核心范围'
    );
    process.exitCode = 2;
  } else {
    let violations = 0;
    let todos = 0;
    for (const path of paths) {
      try {
        for (const finding of scanText(readFileSync(path, 'utf8'), path)) {
          if (finding.todo) todos += 1;
          else violations += 1;
          console.log(
            `${path}:${finding.line}:${finding.column} ${
              finding.todo ? 'TODO' : '违规'
            } ${finding.kind}: ${finding.value}`
          );
        }
      } catch (error) {
        violations += 1;
        console.error(`${path}: 读取失败：${error.message}`);
      }
    }
    console.log(
      `违规 ${violations}；TODO ${todos}（TODO 不计入违规，但仍须人工验收）`
    );
    process.exitCode = violations ? 1 : 0;
  }
}
