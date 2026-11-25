import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findMissingPaths,
  readPartsRegistry,
  readSizeExceptions,
} from './parts-registry.mjs';

test('reads rows with several owners and a dash', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| 弹窗层 | `src/components/feedback/` `src/components/ui/Select.tsx` | x | `portal` |\n| 海报卡片 | `src/components/VideoCard.tsx` | x | — |\n';
  const { rows, problems } = readPartsRegistry(md);
  assert.deepEqual(rows[0].owners, [
    'src/components/feedback/',
    'src/components/ui/Select.tsx',
  ]);
  assert.equal(rows[0].detector, 'portal');
  assert.equal(rows[1].detector, null);
  assert.deepEqual(problems, []);
});

test('a dash owner means no owner', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| 图标 | — | x | `emoji` |\n';
  assert.deepEqual(readPartsRegistry(md).rows[0].owners, []);
});

test('flags unknown detectors and duplicate parts', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| a | `src/x.ts` | x | `nope` |\n| a | `src/y.ts` | x | — |\n';
  assert.equal(readPartsRegistry(md).problems.length, 2);
});

test('one detector belongs to one part', () => {
  const md =
    '## 公共零件登记表\n\n| 零件 | 主人 | 用法 | 检查 |\n| --- | --- | --- | --- |\n| a | `src/x.ts` | x | `portal` |\n| b | `src/y.ts` | x | `portal` |\n';
  const { rows, problems } = readPartsRegistry(md);
  assert.equal(problems.length, 1);
  assert.equal(rows[1].detector, null);
});

test('stops at the next section and tolerates padded cells', () => {
  const md =
    '## 公共零件登记表\n\n|  零件  | 主人 | 用法 |  检查  |\n| ------ | --- | --- | ------ |\n| 提示   | `src/components/feedback/` | x | `toast` |\n\n## 块名登记表\n\n| 块 | 文件 | 说明 |\n| --- | --- | --- |\n| `tm-btn` | `src/styles/primitives.css` | x |\n';
  const { rows, problems } = readPartsRegistry(md);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].part, '提示');
  assert.deepEqual(problems, []);
});

test('a missing section or header is a problem', () => {
  assert.equal(readPartsRegistry('# nothing\n').problems.length, 1);
  assert.equal(
    readPartsRegistry('## 公共零件登记表\n\n| a | b |\n| - | - |\n').problems
      .length,
    1
  );
});

test('finds missing backticked paths', () => {
  const md = 'see `src/a.ts` and `docs/b.md` and `npm run x`';
  assert.deepEqual(
    findMissingPaths(md, (p) => p === 'src/a.ts'),
    ['docs/b.md']
  );
});

test('checks every path inside a code span, ignores globs and placeholders', () => {
  const md =
    '`src/a/` `src/b/` and `scripts/lib/**` and `src/**/*.{ts,tsx}` and `src/features/<名字>/` and `server/x.cjs:12`';
  assert.deepEqual(
    findMissingPaths(md, (p) => p === 'src/a/'),
    ['src/b/', 'server/x.cjs']
  );
});

test('reads the S6 size exceptions listed under their item, and nothing after it', () => {
  const md = [
    '## 允许的例外',
    '',
    '- `src/other.tsx`：别的例外',
    '',
    '- 超过约 400 行但不拆（S6）：',
    '  - `src/a.ts`：理由，提到 `src/c.ts` 不算',
    '  - `src/b.ts`：理由',
    '',
    '- `src/d.ts`：下一条',
  ].join('\r\n');
  assert.deepEqual(readSizeExceptions(md), ['src/a.ts', 'src/b.ts']);
  assert.deepEqual(readSizeExceptions('## 允许的例外\n'), []);
});
