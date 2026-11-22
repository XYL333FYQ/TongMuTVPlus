import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countMatches, DETECTORS } from './detectors.mjs';

test('counts each ingredient', () => {
  assert.equal(
    countMatches('createPortal(a, b); createPortal(c, d)', 'portal'),
    2
  );
  assert.equal(
    countMatches(
      "localStorage.getItem('k'); sessionStorage.setItem('k', v)",
      'storage'
    ),
    2
  );
  assert.equal(
    countMatches("window.innerWidth > 3 && matchMedia('(x)')", 'screen'),
    2
  );
  assert.equal(
    countMatches(
      'new Artplayer({}); new Hls(); flvjs.createPlayer({})',
      'player'
    ),
    3
  );
  assert.equal(countMatches('const formatTime = (s) => s', 'timeFormat'), 1);
  assert.equal(countMatches("<Toast message='x' />", 'toast'), 1);
  assert.equal(countMatches("className='animate-spin'", 'spinner'), 1);
  assert.equal(countMatches("label: '🎬 电影'", 'emoji'), 1);
});

test('CRLF and LF count the same', () => {
  assert.equal(countMatches('createPortal(a)\r\ncreatePortal(b)', 'portal'), 2);
});

test('repeated calls give the same count (no lastIndex leak)', () => {
  const text = 'createPortal(a); createPortal(b)';
  assert.equal(countMatches(text, 'portal'), 2);
  assert.equal(countMatches(text, 'portal'), 2);
});

test('unknown detector id throws', () => {
  assert.throws(() => countMatches('x', 'nope'));
  assert.ok(DETECTORS.portal.label);
});
