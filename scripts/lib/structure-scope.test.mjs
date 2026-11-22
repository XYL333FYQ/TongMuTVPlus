import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CORE_CODE,
  CORE_CSS,
  DAILY_UPSTREAM,
  inScope,
  tierOf,
} from './structure-scope.mjs';

test('tierOf sorts files into three tiers', () => {
  assert.equal(tierOf('src/features/room/view/RoomView.tsx'), 1);
  assert.equal(tierOf('src/components/VideoCard.tsx'), 1);
  assert.equal(tierOf('src/components/UserMenu.tsx'), 2);
  assert.equal(tierOf('src/app/api/favorites/route.ts'), 2);
  assert.equal(tierOf('src/app/admin/page.tsx'), 3);
  assert.equal(tierOf('src/features/room/MusicPage.tsx'), 3); // excluded
});

test('core lists are unchanged', () => {
  assert.ok(CORE_CODE.includes('src/app/watch-room/'));
  assert.ok(CORE_CSS.includes('src/components/VideoCard.css'));
  assert.ok(DAILY_UPSTREAM.includes('src/lib/utils.ts'));
});

test('inScope keeps prefix and exact-file matching, and honours excluded', () => {
  assert.equal(inScope('src/features/a.tsx', ['src/features/']), true);
  assert.equal(inScope('src/components/VideoCard.tsx', CORE_CODE), true);
  assert.equal(inScope('src/components/VideoCard.tsx.bak', CORE_CODE), false);
  assert.equal(inScope('src/styles/media.css', CORE_CSS), false);
});
