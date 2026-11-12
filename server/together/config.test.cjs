'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getTogetherConfig } = require('./config.cjs');
test('legacy default requires no SyncTV credentials', () => {
  assert.deepEqual(getTogetherConfig({}), { mode: 'legacy' });
});
test('unknown modes and incomplete enabled configuration fail closed', () => {
  assert.throws(
    () => getTogetherConfig({ TOGETHER_BACKEND: 'other' }),
    /TOGETHER_BACKEND/
  );
  assert.throws(
    () => getTogetherConfig({ TOGETHER_BACKEND: 'synctv' }),
    /SYNCTV_INTERNAL_URL/
  );
});
test('enabled mode validates upstream URL and keeps secrets server side', () => {
  const env = {
    TOGETHER_BACKEND: 'synctv',
    SYNCTV_INTERNAL_URL: 'http://synctv:8080',
    SYNCTV_ADMIN_USERNAME: 'root',
    SYNCTV_ADMIN_PASSWORD: 'secret',
    TOGETHER_ENCRYPTION_KEY: 'a'.repeat(64),
  };
  const config = getTogetherConfig(env);
  assert.equal(config.mode, 'synctv');
  assert.equal(config.internalUrl, 'http://synctv:8080');
  assert.equal(config.encryptionKey, env.TOGETHER_ENCRYPTION_KEY);
  for (const url of [
    'https://evil.test/path',
    'file:///etc/passwd',
    'http://user:pass@host',
    'https://host/?secret=x',
  ]) {
    assert.throws(
      () => getTogetherConfig({ ...env, SYNCTV_INTERNAL_URL: url }),
      /SYNCTV_INTERNAL_URL/
    );
  }
  assert.throws(
    () => getTogetherConfig({ ...env, TOGETHER_ENCRYPTION_KEY: 'short' }),
    /TOGETHER_ENCRYPTION_KEY/
  );
});
