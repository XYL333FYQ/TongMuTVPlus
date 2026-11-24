import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countMatches, DETECTORS, isAllowedImportant } from './detectors.mjs';

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
  assert.equal(countMatches("authInfo.role !== 'admin'", 'roleCheck'), 1);
  assert.equal(countMatches("role === 'owner' && x", 'roleCheck'), 1);
  assert.equal(
    countMatches("document.body.style.overflow = 'hidden'", 'scrollLock'),
    1
  );
  assert.equal(
    countMatches(
      "<button role='switch' className='tm-switch-btn'><span className='tm-switch-btn-thumb' /></button>",
      'switch'
    ),
    3
  );
  assert.equal(countMatches("getByRole('switch')", 'switch'), 0);
  assert.equal(
    countMatches(
      "<div className='tm-empty'><p className='tm-empty-title'>x</p></div><main className='tm-empty-page' />",
      'emptyState'
    ),
    2
  );
  assert.equal(
    countMatches(
      "<div className='tm-library-feedback' role='alert' />",
      'retryNotice'
    ),
    1
  );
  assert.equal(
    countMatches(
      "<img src={item.poster} alt='' /><Image fill src={displayPoster} /><div className='tm-poster' />",
      'poster'
    ),
    3
  );
  assert.equal(
    countMatches(
      "<img onLoad={() => x} src={item.poster} /> <div className='tm-poster-grid' />",
      'poster'
    ),
    1
  );
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

test('counts inline eslint disables', () => {
  assert.equal(
    countMatches(
      '// eslint-disable-next-line no-console\n// eslint-disable-line x',
      'eslintDisableInline'
    ),
    2
  );
});

test('allows !important only in the agreed contexts', () => {
  assert.equal(
    isAllowedImportant("html[data-tm-reduced-motion='true'] .a", []),
    true
  );
  assert.equal(
    isAllowedImportant('.a', ['@media (prefers-reduced-motion: reduce)']),
    true
  );
  assert.equal(isAllowedImportant('.tm-player .art-video-player', []), true);
  assert.equal(isAllowedImportant('.tm-btn', []), false);
});
