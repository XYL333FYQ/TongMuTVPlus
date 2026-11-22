import assert from 'node:assert/strict';
import { test } from 'node:test';

import { coreFiles, scanText } from './check-design.mjs';

test('em is relative and not judged', () => {
  assert.equal(scanText('.a { font-size: 0.68em; }').length, 0);
  assert.equal(scanText("<p className='text-[0.5em]'>").length, 0);
});

test('px and rem below 12px are violations', () => {
  assert.equal(scanText('.a { font-size: 0.7rem; }').length, 1);
  assert.equal(scanText("<p className='text-[11px]'>").length, 1);
  assert.equal(scanText('.a { font-size: 12px; }').length, 0);
});

test('hex outside token definitions is a violation', () => {
  assert.equal(scanText('.a { color: #fff; }').length, 1);
  assert.equal(scanText(':root { --tm-x: #fff; }').length, 0);
  assert.equal(scanText('  --tm-x: #fff;').length, 0);
  assert.equal(scanText('.a { --tm-x: #fff; color: #000; }').length, 1);
});

test('--core lists core css and code, without tests or excluded files', () => {
  const files = coreFiles();
  assert.ok(files.includes('src/features/room/view/RoomView.css'));
  assert.ok(files.includes('src/components/VideoCard.tsx'));
  assert.ok(!files.some((file) => /\.test\.tsx?$/.test(file)));
  assert.ok(!files.includes('src/styles/media.css'));
  assert.ok(!files.includes('src/features/room/MusicPage.tsx'));
});
