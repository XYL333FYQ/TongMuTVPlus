/** @jest-environment ./src/test/node-web-environment.cjs */
import { createHash, pbkdf2Sync, randomBytes } from 'crypto';

import { hashPassword, verifyPassword } from './password-hash';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

test('new hashes are salted PBKDF2 and verify only the right password', async () => {
  const a = await hashPassword('correct horse');
  const b = await hashPassword('correct horse');
  expect(a).toMatch(/^pbkdf2\$sha256\$100000\$[^$]+\$[^$]+$/);
  expect(a).not.toBe(b);
  await expect(verifyPassword('correct horse', a)).resolves.toEqual({
    ok: true,
    needsRehash: false,
  });
  await expect(verifyPassword('wrong', a)).resolves.toEqual({
    ok: false,
    needsRehash: false,
  });
});

test('legacy unsalted SHA-256 hashes still log in and ask to be upgraded', async () => {
  const legacy = sha256('old-password');
  await expect(verifyPassword('old-password', legacy)).resolves.toEqual({
    ok: true,
    needsRehash: true,
  });
  await expect(verifyPassword('other', legacy)).resolves.toEqual({
    ok: false,
    needsRehash: false,
  });
});

test('the stored iteration count is part of the check', async () => {
  const current = await hashPassword('pw');
  const weaker = current.replace('$100000$', '$1000$');
  // 篡改迭代次数后不再匹配，攻击者不能把哈希改成低成本的版本
  await expect(verifyPassword('pw', weaker)).resolves.toMatchObject({
    ok: false,
  });
});

test.each([
  undefined,
  null,
  '',
  'plain',
  'pbkdf2$sha1$1$a$b',
  'pbkdf2$sha256$x$a$b',
])('malformed stored value %p never verifies', async (stored) => {
  await expect(verifyPassword('pw', stored)).resolves.toEqual({
    ok: false,
    needsRehash: false,
  });
});

test('hashes written by the init scripts (Node pbkdf2Sync) verify in the app', async () => {
  // 与 scripts/init-sqlite.js、init-turso.js 的写法一致
  const salt = randomBytes(16);
  const hash = pbkdf2Sync('owner-pw', salt, 100000, 32, 'sha256');
  const stored = [
    'pbkdf2',
    'sha256',
    100000,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
  await expect(verifyPassword('owner-pw', stored)).resolves.toEqual({
    ok: true,
    needsRehash: false,
  });
});
