import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  baseline,
  compareCounts,
  formatEntry,
  parseEntry,
} from './ratchet.mjs';

test('rejects growth and new keys', () => {
  const { failures } = compareCounts(
    'portal',
    new Map([
      ['a.tsx', 3],
      ['b.tsx', 1],
    ]),
    ['a.tsx ×2'],
    false
  );
  assert.equal(failures.length, 2);
});

test('shrinks only with --shrink', () => {
  assert.equal(
    compareCounts('portal', new Map([['a.tsx', 1]]), ['a.tsx ×2'], false)
      .failures.length,
    1
  );
  assert.deepEqual(
    compareCounts('portal', new Map([['a.tsx', 1]]), ['a.tsx ×2'], true).next,
    ['a.tsx ×1']
  );
});

test('drops fixed keys on shrink', () => {
  assert.deepEqual(
    compareCounts('portal', new Map(), ['a.tsx ×2'], true).next,
    []
  );
});

test('hints at renames', () => {
  const { failures } = compareCounts(
    'portal',
    new Map([['new/a.tsx', 2]]),
    ['old/a.tsx ×2'],
    false
  );
  assert.ok(failures.some((f) => f.includes('像是改名')));
});

test('baseline refuses an existing category', () => {
  assert.throws(() => baseline('portal', new Map(), { portal: [] }));
  assert.deepEqual(baseline('portal', new Map([['a.tsx', 2]]), {}), [
    'a.tsx ×2',
  ]);
});

test('old entries without a count mean 1', () => {
  assert.deepEqual(parseEntry('src/x.tsx'), { key: 'src/x.tsx', count: 1 });
  assert.deepEqual(parseEntry(formatEntry('src/a b.tsx :: no-console', 7)), {
    key: 'src/a b.tsx :: no-console',
    count: 7,
  });
});
