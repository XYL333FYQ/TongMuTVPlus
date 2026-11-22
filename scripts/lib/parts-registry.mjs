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

/** 文件是否落在某个主人路径里（/ 结尾是目录前缀） */
export function ownedBy(file, owners) {
  return owners.some((owner) =>
    owner.endsWith('/') ? file.startsWith(owner) : file === owner
  );
}
