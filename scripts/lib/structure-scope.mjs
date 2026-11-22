// 检查范围只有一个来源：scripts/structure-scope.json。结构检查、设计检查、代码警告基线和
// .eslintrc.js 都从它读，不再各抄一份。三档的含义见 docs/STANDARD.md “三档范围”。
//
// 列表里以 / 结尾的是目录前缀，其余是单个文件。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scopePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../structure-scope.json'
);
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

/** 核心样式：块名归属、令牌、z-index、像素宽度媒体查询 */
export const CORE_CSS = scope.coreCss;

/** 核心代码：整文件 eslint-disable、写死的 z-index、文件行数、不许 any */
export const CORE_CODE = scope.coreCode;

/** 上游来的、但用户天天在用的文件（第二档） */
export const DAILY_UPSTREAM = scope.dailyUpstream;

/** 不属于核心的文件（理由见 docs/STANDARD.md “允许的例外”） */
const EXCLUDED = scope.excluded;

const matches = (file, prefixes) =>
  prefixes.some((prefix) =>
    prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix
  );

export function inScope(file, prefixes) {
  if (EXCLUDED.includes(file)) return false;
  return matches(file, prefixes);
}

/** 1 = 核心，2 = 常用上游，3 = 其余上游 */
export function tierOf(file) {
  if (inScope(file, CORE_CODE) || inScope(file, CORE_CSS)) return 1;
  if (matches(file, DAILY_UPSTREAM)) return 2;
  return 3;
}
