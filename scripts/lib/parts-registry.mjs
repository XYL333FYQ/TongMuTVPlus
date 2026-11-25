// 读 docs/STANDARD.md 的“公共零件登记表”：每行一个公共零件、它的主人（唯一能直接用原材料的
// 文件或目录）和一种原材料探测器。

import { DETECTORS } from './detectors.mjs';

const SECTION = '## 公共零件登记表';
const HEADER = ['零件', '主人', '用法', '检查'];
const DASH = '—';

// 按没被转义的 | 切开，去掉首尾空格和行首行尾的空单元格
const cellsOf = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());

const backticked = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

/**
 * @returns {{ rows: { part: string, owners: string[], usage: string, detector: string | null }[], problems: string[] }}
 */
export function readPartsRegistry(markdown) {
  const text = markdown.replace(/\r\n/g, '\n');
  const start = text.indexOf(`${SECTION}\n`);
  if (start === -1) {
    return { rows: [], problems: [`缺少“${SECTION.slice(3)}”一节`] };
  }
  const section = text.slice(start).split(/\n## /)[0];
  const lines = section
    .split('\n')
    .filter((line) => line.trim().startsWith('|'));

  const header = lines[0] ? cellsOf(lines[0]) : [];
  if (header.join('|') !== HEADER.join('|')) {
    return {
      rows: [],
      problems: [`公共零件登记表的表头必须是 | ${HEADER.join(' | ')} |`],
    };
  }

  const rows = [];
  const problems = [];
  const seen = new Set();
  const usedDetectors = new Set();
  // 第二行是分隔行（| --- |）
  for (const line of lines.slice(2)) {
    const cells = cellsOf(line);
    if (cells.length !== HEADER.length) {
      problems.push(`公共零件登记表这一行不是 ${HEADER.length} 列：${line}`);
      continue;
    }
    const [part, ownerCell, usage, checkCell] = cells;

    if (seen.has(part)) problems.push(`公共零件登记了两次：${part}`);
    seen.add(part);

    const owners = ownerCell === DASH ? [] : backticked(ownerCell);
    if (ownerCell !== DASH && owners.length === 0) {
      problems.push(`零件“${part}”的主人要写反引号路径，或写 ${DASH}`);
    }

    let detector = null;
    if (checkCell !== DASH) {
      [detector = null] = backticked(checkCell);
      if (!detector || !Object.hasOwn(DETECTORS, detector)) {
        problems.push(`零件“${part}”的检查不是已知的探测器：${checkCell}`);
        detector = null;
      } else if (usedDetectors.has(detector)) {
        // 一个探测器只能归一个零件，否则名单里的类别会撞在一起
        problems.push(`探测器 ${detector} 被两个零件用了：${part}`);
        detector = null;
      }
      if (detector) usedDetectors.add(detector);
    }

    rows.push({ part, owners, usage, detector });
  }
  return { rows, problems };
}

const SIZE_EXCEPTIONS_ITEM = '- 超过约 400 行但不拆（S6）：';

/**
 * “允许的例外”一节里登记的“超过约 400 行但不拆”的文件：那一条下面缩进的每个子项，
 * 取第一个反引号里的路径。只有 S6 的行数提醒跳过它们，别的检查照常。
 * @returns {string[]}
 */
export function readSizeExceptions(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === SIZE_EXCEPTIONS_ITEM);
  if (start === -1) return [];
  const files = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+- /.test(line)) break;
    const [file] = backticked(line);
    if (file) files.push(file);
  }
  return files;
}

const PATH_ROOTS = /^(?:src|scripts|docs|server)\//;

/**
 * “法律文件”（AGENTS.md、docs/README.md、docs/STANDARD.md）里写的路径必须真的存在。
 * 找反引号里以 src/、scripts/、docs/、server/ 开头的路径（一个代码片段里可以有几个，
 * 例如命令里的脚本路径），返回不存在的那些。通配（* 、{}）和占位（<名字>）不查；
 * 末尾的 :行号 去掉再查。围起来的代码块（```）不查。
 */
export function findMissingPaths(markdown, exists) {
  const text = markdown.replace(/\r\n/g, '\n').replace(/```[\s\S]*?```/g, '');
  const missing = [];
  for (const [, span] of text.matchAll(/`([^`\n]+)`/g)) {
    for (const token of span.split(/\s+/)) {
      if (!PATH_ROOTS.test(token) || /[*{}<>]/.test(token)) continue;
      const file = token.replace(/:\d+(?:-\d+)?$/, '');
      if (!exists(file) && !missing.includes(file)) missing.push(file);
    }
  }
  return missing;
}

/** 文件是否落在某个主人路径里（/ 结尾是目录前缀） */
export function ownedBy(file, owners) {
  return owners.some((owner) =>
    owner.endsWith('/') ? file.startsWith(owner) : file === owner
  );
}
